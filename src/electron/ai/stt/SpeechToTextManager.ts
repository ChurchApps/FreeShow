import type { SttEngineOptions } from "../../../types/ai/AiSettings"
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { LocalModelManager } from "../setup/LocalModelManager"
import { NemotronTranscriber } from "./models/NemotronTranscriber"
import type { TranscriberSegment } from "./sttHelper"

type SttEngine = NemotronTranscriber
type SegmentListener = (segment: TranscriberSegment) => void

const sanitizeError = (msg: string) => msg.replace(/\s+/g, " ").trim().slice(0, 200)

export class SpeechToText {
    static transcriberEngine: SttEngine | null = null
    static sessionToken = 0
    private static segmentListeners = new Set<SegmentListener>()

    static async listen(engine: string, options: SttEngineOptions): Promise<{ started: boolean; error?: string }> {
        this.stopInternal(false)
        const token = ++this.sessionToken

        const created = await this.createEngine(engine, options)
        if ("error" in created) return { started: false, error: created.error }

        if (token !== this.sessionToken) {
            created.transcriber.stop()
            return { started: false, error: "Error: superseded" }
        }

        this.transcriberEngine = created.transcriber

        try {
            await this.transcriberEngine.start()
        } catch (err) {
            console.error("STT start failed:", err)
            if (token === this.sessionToken) this.stopInternal(false)
            return { started: false, error: sanitizeError(String((err as Error)?.message || err)) }
        }

        if (token !== this.sessionToken) return { started: false, error: "Error: superseded" }

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
        sendToMain(ToMain.AI_TRANSCRIPT, { text: "", interim: true })
        if (emitStatus) sendToMain(ToMain.AI_STATUS, { state: "stopped" })
    }

    static pushAudio(buffer: Uint8Array) {
        this.transcriberEngine?.pushAudio(buffer)
    }

    private static async createEngine(engine: string, options: SttEngineOptions): Promise<{ transcriber: SttEngine } | { error: string }> {
        if (engine === "nemotron") {
            const status = await LocalModelManager.getStatus("nemotron")
            if (!status.ready) return { error: "Nemotron could not be initialized" }
            return { transcriber: new NemotronTranscriber({ ...options }, this.onSegment, this.onError, this.onInterim) }
        }

        console.error(`Unknown STT engine: ${engine}`)
        return { error: "Unknown STT engine" }
    }

    static addSegmentListener = (listener: SegmentListener) => this.segmentListeners.add(listener)
    static removeSegmentListener = (listener: SegmentListener) => this.segmentListeners.delete(listener)

    private static onSegment = (segment: TranscriberSegment) => {
        sendToMain(ToMain.AI_TRANSCRIPT, segment)
        this.segmentListeners.forEach((listener) => listener(segment))
    }

    private static onInterim = (text: string) => {
        sendToMain(ToMain.AI_TRANSCRIPT, { text, interim: true })
    }

    private static onError = (message: string) => {
        console.error("STT error:", message)
        this.stopInternal(false)
        sendToMain(ToMain.AI_STATUS, { state: "error", message: sanitizeError(message) })
    }
}
