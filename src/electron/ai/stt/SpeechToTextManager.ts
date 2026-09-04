import { existsSync } from "fs"
import type { SttEngineOptions } from "../../../types/ai/AiSettings"
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { LocalModelManager } from "../setup/LocalModelManager"
import { NemotronTranscriber } from "./models/NemotronTranscriber"
import { WhisperTranscriber } from "./models/WhisperTranscriber"
import type { TranscriberSegment } from "./sttHelper"

type SttEngine = WhisperTranscriber | NemotronTranscriber
type SegmentListener = (segment: TranscriberSegment) => void

export class SpeechToText {
    static transcriberEngine: SttEngine | null = null
    // bumped on every start/stop so a slow start that got superseded can tell it no longer owns the session
    static sessionToken = 0
    // features (e.g. downstream detectors) subscribe to the transcript stream while their toggle is on
    private static segmentListeners: Set<SegmentListener> = new Set()

    static async listen(engine: string, options: SttEngineOptions): Promise<{ started: boolean; error?: string }> {
        this.stopInternal(false)
        const token = ++this.sessionToken

        const created = await this.createEngine(engine, options)
        if ("error" in created) return { started: false, error: created.error }

        // a newer start/stop may have superseded this while the engine was resolving
        if (token !== this.sessionToken) {
            created.transcriber.stop()
            return { started: false, error: "superseded" }
        }

        this.transcriberEngine = created.transcriber

        try {
            await this.transcriberEngine.start()
        } catch (err) {
            console.error("STT start failed:", err)
            if (token === this.sessionToken) this.stopInternal(false)
            // a start failure can carry a raw require/spawn stack - sanitize before it reaches the UI
            return { started: false, error: sanitizeErrorMessage(String((err as Error)?.message || err)) }
        }

        if (token !== this.sessionToken) return { started: false, error: "superseded" }

        sendToMain(ToMain.AI_STATUS, { state: "listening" })
        return { started: true }
    }

    static stop() {
        this.stopInternal(true)
    }

    private static stopInternal(emitStatus: boolean) {
        this.sessionToken++

        const active = this.transcriberEngine
        this.transcriberEngine = null
        if (!active) return

        Promise.resolve(active.stop()).catch((err) => console.error("Error stopping STT engine:", err))
        // whatever interim tail was showing is dead now - a crashed/killed worker never gets to
        // clear it itself, so the authoritative clear lives here on every engine stop
        sendToMain(ToMain.AI_TRANSCRIPT_INTERIM, { text: "" })
        if (emitStatus) sendToMain(ToMain.AI_STATUS, { state: "stopped" })
    }

    // audio arriving before START or after STOP is a safe no-op: the engine is null outside a session
    static pushAudio(buffer: Uint8Array) {
        this.transcriberEngine?.pushAudio(buffer)
    }

    private static async createEngine(engine: string, options: SttEngineOptions): Promise<{ transcriber: SttEngine } | { error: string }> {
        const onSegment = this.onSegment.bind(this)
        const onError = this.onError.bind(this)

        if (engine === "whisper") {
            // interpretation mode needs per-window language detection, which only the whisper cli's -oj output provides
            const whisperStatus = await LocalModelManager.getStatus("whisper", undefined, options.customPath)
            if (!whisperStatus.ready) return { error: "whisper_not_installed" }
            const whisper = { kind: "cli", binaryPath: whisperStatus.localPath || "" } as const

            const customModel = options.customModelPath && existsSync(options.customModelPath) ? options.customModelPath : ""
            // default model matches the options popup's derivation: English-only speech uses the smaller .en variant
            let model = options.model || ((options.language || "en").startsWith("en") && !options.interpretationMode ? "base.en" : "base")
            // interpretation mode needs a multilingual model for per-window language detection - never an .en variant
            if (options.interpretationMode) model = model.replace(".en", "")
            if (!customModel) {
                const modelStatus = await LocalModelManager.getStatus("whisper", model)
                if (!modelStatus.ready) return { error: "whisper_model_missing" }
            }

            return { transcriber: new WhisperTranscriber({ ...options, customModelPath: customModel, model, whisper }, onSegment, onError, this.onInterim.bind(this)) }
        }

        if (engine === "nemotron") {
            const nemotronStatus = await LocalModelManager.getStatus("nemotron")
            if (!nemotronStatus.ready) return { error: "nemotron_unsupported" }

            return { transcriber: new NemotronTranscriber({ ...options }, onSegment, onError, this.onInterim.bind(this)) }
        }

        console.error(`Unknown STT engine: ${engine}`)
        return { error: "unknown_engine" }
    }

    static addSegmentListener(listener: SegmentListener) {
        this.segmentListeners.add(listener)
    }

    static removeSegmentListener(listener: SegmentListener) {
        this.segmentListeners.delete(listener)
    }

    private static onSegment(segment: TranscriberSegment) {
        // the full transcript always reaches the renderer - detection only listens to the selected language
        sendToMain(ToMain.AI_TRANSCRIPT, segment)
        this.segmentListeners.forEach((listener) => listener(segment))
    }

    // the open utterance's unstable tail - display only (shown greyed), detection never sees it
    private static onInterim(text: string) {
        sendToMain(ToMain.AI_TRANSCRIPT_INTERIM, { text })
    }

    private static onError(message: string) {
        console.error("STT error:", message)
        // a fatal transcriber error ends the whole session - the renderer stops mic capture on "error"
        this.stopInternal(false)
        sendToMain(ToMain.AI_STATUS, { state: "error", message: sanitizeErrorMessage(message) })
    }
}

// error messages can contain provider response bodies / whisper stderr - never pass those to the renderer verbatim
function sanitizeErrorMessage(message: string): string {
    return message.replace(/\s+/g, " ").trim().slice(0, 200)
}
