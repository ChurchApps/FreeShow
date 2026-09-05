import { get, writable } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../IPC/main"
import { ai, language } from "../../stores"
import audioProcessor from "./audioProcessor.ts?worker&url"

export const audioLevelStore = writable<number>(0.0)

// nemotron (english-only) is the default engine on english UIs - whisper otherwise, when
// interpretation mode is enabled (a whisper-only feature: per-window language detection), or
// when whisper was configured for non-english speech the streaming model cannot transcribe
export function resolveSttEngine(): string {
    const stt = get(ai)?.stt || {}
    if (stt.engine) return stt.engine

    const whisperOptions = stt.engineOptions?.whisper || {}
    const interpretation = whisperOptions.interpretationMode === true
    const englishSpeech = !whisperOptions.language || String(whisperOptions.language).startsWith("en")
    return get(language)?.includes("en") && !interpretation && englishSpeech ? "nemotron" : "whisper"
}

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
        const engine = resolveSttEngine()
        const engineOptions = get(ai)?.stt?.engineOptions?.[engine] || {}
        // whisper might need a moment to spin up on first start
        const result = await requestMain(Main.AI_LISTEN_START, { engine, engineOptions }, undefined, 60000)
        if (!result?.started) {
            // the defaulted pick can be unsupported (sherpa-onnx missing) or simply not downloaded
            // (the ~660MB model is a manual download) - only an explicit nemotron choice should
            // surface those errors instead of falling back to whisper
            const fallbackErrors = ["nemotron_unsupported", "nemotron_model_missing"]
            if (!get(ai)?.stt?.engine && engine === "nemotron" && fallbackErrors.includes(result?.error || "")) {
                console.info(`[AI STT] defaulted nemotron unavailable (${result?.error}) - falling back to whisper`)
                const retry = await requestMain(Main.AI_LISTEN_START, { engine: "whisper", engineOptions: get(ai)?.stt?.engineOptions?.whisper || {} }, undefined, 60000)
                if (retry?.started) return { ok: true }
                return { ok: false, error: retry?.error || "start_failed" }
            }

            return { ok: false, error: result?.error || "start_failed" }
        }

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

    // prefer the saved device, else the SYSTEM default input, else the first available input -
    // simply taking the first enumerated device can land on e.g. a continuity iPhone microphone
    static async resolveMicDeviceId(saved: string): Promise<string> {
        try {
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput")
            const inputs = devices.filter((device) => device.deviceId !== "default")
            if (!inputs.length) return saved
            if (saved && inputs.some((device) => device.deviceId === saved)) return saved

            // the "default" virtual device mirrors the system default input - resolve the concrete
            // device behind it (same groupId), so the settings dropdown shows the real device
            const virtualDefault = devices.find((device) => device.deviceId === "default")
            const systemDefault = virtualDefault?.groupId ? inputs.find((device) => device.groupId === virtualDefault.groupId) : undefined

            return systemDefault?.deviceId || inputs[0].deviceId
        } catch (err) {
            console.error("Could not enumerate microphones:", err)
            return saved
        }
    }

    static async getMicStream(deviceId: string = ""): Promise<MediaStream | null> {
        // capture the feed raw: chromium's telephony-tuned noise suppression eats low-energy
        // consonants & word tails, and gain control pumps levels - the engines were trained
        // on unprocessed audio, so with all three off the WebRTC processing chain is bypassed
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
            // the context runs at the engines' target rate, so chromium's high-quality sinc
            // resampler does device rate -> 16kHz upstream (any device rate, 44.1k included)
            // & the worklet only converts/frames samples - it either honors 16000 or throws
            const ac = new AudioContext({ sampleRate: 16000 })
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

            // with gain control off the board owns the level - clipping mangles decodes in ways
            // that read as transcription bugs, so a sustained hot feed gets called out loudly
            let clippedFrames = 0
            let clipCheckedFrames = 0
            let lastClipWarnAt = 0

            const updateLevel = () => {
                if (!this.analyserNode || !this.ac || this.ac !== ac || ac.state === "closed") return

                analyserNode.getByteTimeDomainData(dataArray)
                let sum = 0
                let clipped = false
                for (let i = 0; i < dataArray.length; i++) {
                    if (dataArray[i] === 0 || dataArray[i] === 255) clipped = true
                    const sample = (dataArray[i] - 128) / 128
                    sum += sample * sample
                }
                const rms = Math.sqrt(sum / dataArray.length)
                this.emitAudioLevel(Math.min(1.0, Math.round(rms * 4.5 * 100) / 100))

                clipCheckedFrames++
                if (clipped) clippedFrames++
                if (clipCheckedFrames >= 120) {
                    // ~2s of frames: >5% carrying full-scale samples means the input is genuinely hot
                    const now = Date.now()
                    if (clippedFrames > clipCheckedFrames * 0.05 && now - lastClipWarnAt > 30000) {
                        lastClipWarnAt = now
                        console.warn("[AI STT] input is clipping - reduce the microphone/board gain (clipped audio garbles transcription)")
                    }
                    clippedFrames = 0
                    clipCheckedFrames = 0
                }

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
