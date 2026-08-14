import { get, writable } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../IPC/main"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { ai } from "../../stores"
import audioProcessor from "./audioProcessor.ts?worker&url"

export const audioLevelStore = writable<number>(0.0)

type AudioLevelCallback = (level: number) => void

export class SpeechToText {
    private static ac: AudioContext | null = null
    private static stream: MediaStream | null = null
    private static sourceNode: MediaStreamAudioSourceNode | null = null
    private static captureNode: AudioWorkletNode | null = null
    private static analyserNode: AnalyserNode | null = null
    private static animFrameId: number | null = null
    private static listeners: Set<AudioLevelCallback> = new Set()

    static async enable(): Promise<{ ok: boolean; error?: string }> {
        const captured = await this.restartCapture()
        if (!captured.ok) return captured

        const started = await this.restartEngine()
        if (!started.ok) this.stopCapture()
        return started
    }

    // (re)start only the engine - switching whisper <-> nemotron mid-session goes through here,
    // so the capture keeps running and the electron manager just swaps the transcriber
    static async restartEngine(): Promise<{ ok: boolean; error?: string }> {
        const engine = get(ai)?.stt?.engine || "whisper"
        const engineOptions = get(ai)?.stt?.engineOptions?.[engine] || {}
        // whisper might need a moment to spin up on first start
        const result = await requestMain(Main.AI_LISTEN_START, { engine, engineOptions }, undefined, 60000)
        if (!result?.started) return { ok: false, error: result?.error || "start_failed" }

        return { ok: true }
    }

    // (re)start only the microphone capture - switching the input mid-session goes through here,
    // so the engine in the electron process keeps running and just sees a short gap in audio
    static async restartCapture(): Promise<{ ok: boolean; error?: string }> {
        this.stopCapture()

        const savedDeviceId = get(ai).stt?.micDeviceId || ""
        const deviceId = await this.resolveMicDeviceId(savedDeviceId)
        if (deviceId && deviceId !== savedDeviceId) {
            // persist the auto-selected device so the settings dropdown shows what is actually capturing
            ai.update((a) => {
                if (!a.stt) a.stt = {}
                a.stt.micDeviceId = deviceId
                return a
            })
        }

        const stream = await this.getMicStream(deviceId)
        if (!stream) return { ok: false, error: "microphone_access" }

        this.stream = stream
        this.captureAudioContext(stream)

        return { ok: true }
    }

    static disable() {
        sendMain(Main.AI_LISTEN_STOP)
        this.stopCapture()
    }

    // prefer the saved device, else the system default, else the first available input -
    // an unset device leaves the choice to Chromium, which can capture an input the user is not speaking into
    private static async resolveMicDeviceId(saved: string): Promise<string> {
        try {
            const devices = await AudioMicrophone.getList()
            if (!devices.length) return saved
            if (saved && devices.some((device) => device.deviceId === saved)) return saved

            return devices.find((device) => device.deviceId === "default")?.deviceId || devices[0].deviceId
        } catch (err) {
            console.error("Could not enumerate microphones:", err)
            return saved
        }
    }

    static async getMicStream(deviceId: string = ""): Promise<MediaStream | null> {
        // gain control & noise suppression for better results
        const audioConstraints: MediaTrackConstraints = {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
        }

        try {
            return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
        } catch (err) {
            if (err?.name === "NotReadableError") {
                sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                return null
            }

            // saved device is probably unplugged - retry once with the default device
            if (err?.name === "OverconstrainedError" && deviceId) {
                try {
                    const defaultStream = await this.getMicStream("")
                    return defaultStream || null
                } catch (retryErr: any) {
                    console.error("Failed to start AI scripture microphone:", retryErr)
                    return null
                }
            }

            console.error("Error accessing microphone:", err)
            return null
        }
    }

    static async captureAudioContext(stream: MediaStream): Promise<AudioContext | null> {
        try {
            const ac = new AudioContext({ sampleRate: 48000 })
            this.ac = ac

            // 1. Create source node
            const sourceNode = ac.createMediaStreamSource(stream)
            this.sourceNode = sourceNode

            // 2. Setup AnalyserNode for audio visualizer level computation
            const analyserNode = ac.createAnalyser()
            analyserNode.fftSize = 256
            this.analyserNode = analyserNode
            sourceNode.connect(analyserNode)

            const dataArray = new Uint8Array(analyserNode.frequencyBinCount)

            const updateLevel = () => {
                if (!this.analyserNode || !this.ac || this.ac !== ac || ac.state === "closed") return

                analyserNode.getByteTimeDomainData(dataArray)
                let sum = 0
                for (let i = 0; i < dataArray.length; i++) {
                    const sample = (dataArray[i] - 128) / 128
                    sum += sample * sample
                }
                const rms = Math.sqrt(sum / dataArray.length)
                this.emitAudioLevel(Math.min(1.0, Math.round(rms * 4.5 * 100) / 100))

                this.animFrameId = requestAnimationFrame(updateLevel)
            }
            updateLevel()

            // 3. Load AudioWorklet module
            await ac.audioWorklet.addModule(audioProcessor)

            if (this.ac !== ac || ac.state === "closed") {
                ac.close().catch(() => {})
                return null
            }

            // 4. Create and connect capture node
            const captureNode = new AudioWorkletNode(ac, "ai-scripture-processor")
            this.captureNode = captureNode

            captureNode.port.onmessage = (e) => {
                sendMain(Main.AI_AUDIO_DATA, { buffer: e.data })
            }

            sourceNode.connect(captureNode)
            captureNode.connect(ac.destination)

            return ac
        } catch (err: any) {
            console.error("Failed to capture audio context:", err)
            this.stopCapture()
            return null
        }
    }

    static onAudioLevel(callback: AudioLevelCallback): () => void {
        this.listeners.add(callback)
        return () => {
            this.listeners.delete(callback)
        }
    }

    private static emitAudioLevel(level: number) {
        level = level < 0.04 ? 0 : level
        audioLevelStore.set(level)
        this.listeners.forEach((callback) => callback(level))
    }

    static stopCapture() {
        // Cancel animation frame loop
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId)
            this.animFrameId = null
        }

        // Disconnect audio nodes
        if (this.sourceNode) {
            try {
                this.sourceNode.disconnect()
            } catch (_) {}
            this.sourceNode = null
        }

        if (this.captureNode) {
            try {
                this.captureNode.disconnect()
            } catch (_) {}
            this.captureNode = null
        }

        if (this.analyserNode) {
            try {
                this.analyserNode.disconnect()
            } catch (_) {}
            this.analyserNode = null
        }

        // Stop all tracks on current stream
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop())
            this.stream = null
        }

        // Close and clean up AudioContext
        if (this.ac) {
            if (this.ac.state !== "closed") {
                this.ac.close().catch(() => {})
            }
            this.ac = null
        }

        this.emitAudioLevel(0.0)
    }
}
