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

    private static sessionToken = 0

    static async enable() {
        const operationId = ++this.sessionToken

        const captured = await this.restartCapture(operationId)
        if (operationId !== this.sessionToken) {
            this.stopCapture()
            return { ok: false, aborted: true }
        }
        if (!captured.ok) return captured

        const started = await this.restartEngine(operationId)
        if (operationId !== this.sessionToken) {
            this.stopCapture()
            return { ok: false, aborted: true }
        }

        if (!started.ok) {
            this.stopCapture()
            return started
        }

        return { ok: true }
    }

    static async restartEngine(operationId?: number) {
        const token = operationId ?? ++this.sessionToken
        const engine = resolveSttEngine()
        const engineOptions = get(ai)?.stt?.engineOptions?.[engine] || {}

        const result = await requestMain(Main.AI_LISTEN_START, { engine, engineOptions }, undefined, 60000)

        if (token !== this.sessionToken) return { ok: false, aborted: true }
        if (!result?.started) return { ok: false, error: result?.error }

        return { ok: true }
    }

    static async restartCapture(operationId?: number) {
        const token = operationId ?? ++this.sessionToken
        this.stopCapture()

        const savedDeviceId = get(ai).stt?.micDeviceId || ""
        const deviceId = await this.resolveMicDeviceId(savedDeviceId)

        if (token !== this.sessionToken) return { ok: false, aborted: true }

        // Mute store update during initialization to avoid re-triggering component reactivity loop
        if (deviceId && deviceId !== savedDeviceId) {
            const currentAi = get(ai)
            if (currentAi?.stt) {
                currentAi.stt.micDeviceId = deviceId
            }
        }

        const stream = await this.getMicStream(deviceId)
        if (token !== this.sessionToken) {
            stream?.getTracks().forEach((track) => track.stop())
            return { ok: false, aborted: true }
        }

        if (!stream) return { ok: false, error: "No microphone access" }

        this.stream = stream
        const ac = await this.captureAudioContext(stream, token)

        if (token !== this.sessionToken) {
            this.stopCapture()
            return { ok: false, aborted: true }
        }

        if (!ac) return { ok: false, error: "Could not create audio context" }

        return { ok: true }
    }

    static disable() {
        this.sessionToken++
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

    static async getMicStream(deviceId = "", retries = 3, delayMs = 150): Promise<MediaStream | null> {
        const audioConstraints: MediaTrackConstraints = {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
            } catch (err: any) {
                if (err?.name === "NotReadableError" && attempt < retries - 1) {
                    console.warn(`[AI STT] Mic hardware busy, retrying (${attempt + 1}/${retries})...`)
                    await new Promise((resolve) => setTimeout(resolve, delayMs))
                    continue
                }

                if (err?.name === "NotReadableError") {
                    sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                    return null
                }

                if (err?.name === "OverconstrainedError" && deviceId) {
                    return this.getMicStream("", retries, delayMs)
                }

                console.error("Error accessing microphone:", err)
                return null
            }
        }

        return null
    }

    static async captureAudioContext(stream: MediaStream, operationId?: number): Promise<AudioContext | null> {
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

            if ((operationId && operationId !== this.sessionToken) || this.ac !== ac || ac.state === "closed") {
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

        const updateLevel = () => {
            if (!this.analyserNode || !this.ac || this.ac !== ac || ac.state === "closed") return

            analyser.getByteTimeDomainData(dataArray)
            let sum = 0

            for (const byte of dataArray) {
                const sample = (byte - 128) / 128
                sum += sample * sample
            }

            const rms = Math.sqrt(sum / dataArray.length)
            this.emitAudioLevel(Math.min(1.0, Math.round(rms * 4.5 * 100) / 100))

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

        if (this.stream) {
            this.stream.getTracks().forEach((track) => {
                track.enabled = false
                track.stop()
            })
            this.stream = null
        }

        if (this.ac) {
            if (this.ac.state !== "closed") {
                this.ac.close().catch(() => {})
            }
            this.ac = null
        }

        this.emitAudioLevel(0.0)
    }
}
