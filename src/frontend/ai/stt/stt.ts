import { get, writable } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../IPC/main"
import { ai } from "../../stores"

export const audioLevelStore = writable<number>(0.0)

export function resolveSttEngine(): string {
    return get(ai)?.stt?.engine || "nemotron"
}

type AudioLevelCallback = (level: number) => void

export class SpeechToText {
    private static ac: AudioContext | null = null
    private static stream: MediaStream | null = null
    private static sourceNode: MediaStreamAudioSourceNode | null = null
    private static captureNode: AudioWorkletNode | null = null
    private static analyserNode: AnalyserNode | null = null
    private static animFrameId: number | null = null
    private static listeners = new Set<AudioLevelCallback>()

    static async enable() {
        const captured = await this.restartCapture()
        if (!captured.ok) return captured

        const started = await this.restartEngine()
        if (!started.ok) this.stopCapture()
        return started
    }

    static async restartEngine() {
        const engine = resolveSttEngine()
        const engineOptions = get(ai)?.stt?.engineOptions?.[engine] || {}

        const result = await requestMain(Main.AI_LISTEN_START, { engine, engineOptions }, undefined, 60000)
        if (!result?.started) return { ok: false, error: result?.error }

        return { ok: true }
    }

    static async restartCapture() {
        this.stopCapture()

        const savedDeviceId = get(ai).stt?.micDeviceId || ""
        const deviceId = await this.resolveMicDeviceId(savedDeviceId)

        if (deviceId && deviceId !== savedDeviceId) {
            ai.update((a) => ({ ...a, stt: { ...a.stt, micDeviceId: deviceId } }))
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

    static async resolveMicDeviceId(saved: string): Promise<string> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const inputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")

            if (!inputs.length) return saved
            if (saved && inputs.some((d) => d.deviceId === saved)) return saved

            const virtualDefault = devices.find((d) => d.deviceId === "default")
            const systemDefault = virtualDefault?.groupId ? inputs.find((d) => d.groupId === virtualDefault.groupId) : undefined

            return systemDefault?.deviceId || inputs[0].deviceId
        } catch (err) {
            console.error("Could not enumerate microphones:", err)
            return saved
        }
    }

    static async getMicStream(deviceId = ""): Promise<MediaStream | null> {
        const audioConstraints: MediaTrackConstraints = {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
            console.info("[AI STT] mic settings:", stream.getAudioTracks()[0]?.getSettings())
            return stream
        } catch (err) {
            if (err?.name === "NotReadableError") {
                sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                return null
            }

            if (err?.name === "OverconstrainedError" && deviceId) {
                return this.getMicStream("")
            }

            console.error("Error accessing microphone:", err)
            return null
        }
    }

    static async captureAudioContext(stream: MediaStream): Promise<AudioContext | null> {
        try {
            const ac = new AudioContext({ sampleRate: 16000 })
            this.ac = ac

            const sourceNode = ac.createMediaStreamSource(stream)
            const analyserNode = ac.createAnalyser()
            analyserNode.fftSize = 256
            sourceNode.connect(analyserNode)

            this.sourceNode = sourceNode
            this.analyserNode = analyserNode

            this.startLevelMonitoring(ac, analyserNode)

            await ac.audioWorklet.addModule("./assets/stt-processor.js")
            if (this.ac !== ac || ac.state === "closed") {
                ac.close().catch(() => {})
                return null
            }
            console.info("STT processor module loaded")

            const captureNode = new AudioWorkletNode(ac, "stt-processor")
            this.captureNode = captureNode

            captureNode.port.onmessage = (e) => {
                sendMain(Main.AI_AUDIO_DATA, { buffer: e.data })
            }

            sourceNode.connect(captureNode)
            captureNode.connect(ac.destination)

            return ac
        } catch (err) {
            console.error("Failed to capture audio context:", err)
            this.stopCapture()
            return null
        }
    }

    private static startLevelMonitoring(ac: AudioContext, analyser: AnalyserNode) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let clippedFrames = 0,
            checkedFrames = 0,
            lastWarnAt = 0

        const updateLevel = () => {
            if (!this.analyserNode || !this.ac || this.ac !== ac || ac.state === "closed") return

            analyser.getByteTimeDomainData(dataArray)
            let sum = 0,
                clipped = false

            for (const byte of dataArray) {
                if (byte === 0 || byte === 255) clipped = true
                const sample = (byte - 128) / 128
                sum += sample * sample
            }

            const rms = Math.sqrt(sum / dataArray.length)
            this.emitAudioLevel(Math.min(1.0, Math.round(rms * 4.5 * 100) / 100))

            checkedFrames++
            if (clipped) clippedFrames++

            if (checkedFrames >= 120) {
                const now = Date.now()
                if (clippedFrames > checkedFrames * 0.05 && now - lastWarnAt > 30000) {
                    lastWarnAt = now
                    console.warn("[AI STT] input clipping detected.")
                }
                clippedFrames = 0
                checkedFrames = 0
            }

            this.animFrameId = requestAnimationFrame(updateLevel)
        }

        updateLevel()
    }

    static onAudioLevel(callback: AudioLevelCallback): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private static emitAudioLevel(level: number) {
        const value = level < 0.04 ? 0 : level
        audioLevelStore.set(value)
        this.listeners.forEach((fn) => fn(value))
    }

    static stopCapture() {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId)
            this.animFrameId = null
        }

        ;[this.sourceNode, this.captureNode, this.analyserNode].forEach((node) => {
            try {
                node?.disconnect()
            } catch (_) {}
        })
        this.sourceNode = this.captureNode = this.analyserNode = null

        this.stream?.getTracks().forEach((track) => track.stop())
        this.stream = null

        if (this.ac && this.ac.state !== "closed") {
            this.ac.close().catch(() => {})
        }
        this.ac = null

        this.emitAudioLevel(0.0)
    }
}
