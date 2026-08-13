import type { SttEngineOptions } from "../../../types/ai/AiSettings"
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { getNemotronModelPaths } from "../speech/nemotron/manager"
import { resolveWhisper } from "../speech/whisper/manager"
import { NemotronTranscriber } from "./transcribers/NemotronTranscriber"
import { WhisperTranscriber } from "./transcribers/WhisperTranscriber"

export class SpeechToText {
    static transcriberEngine: WhisperTranscriber | NemotronTranscriber | null = null
    static sessionToken = 0

    static async listen(engine: string, options: SttEngineOptions) {
        const token = ++this.sessionToken
        this.stop()

        this.transcriberEngine = await this.getEngine(engine, options)
        if (!this.transcriberEngine) return false

        try {
            await this.transcriberEngine.start()
        } catch (err) {
            console.error("STT start failed:", err)
            if (token === this.sessionToken) this.stop()
            return false
        }

        return true
    }

    static stop() {
        // stop the current transcriber engine if it exists
        if (this.transcriberEngine) {
            this.transcriberEngine.stop()
            this.transcriberEngine = null
        }
    }

    static pushAudio(buffer: Uint8Array) {
        if (this.transcriberEngine) {
            this.transcriberEngine.pushAudio(buffer)
        }
    }

    private static async getEngine(engine: string, options: SttEngineOptions) {
        switch (engine) {
            case "whisper":
                const whisper = await resolveWhisper()
                return new WhisperTranscriber({ ...options, whisper }, this.onSegment.bind(this), this.onError.bind(this))
            case "nemotron":
                const nemotron = getNemotronModelPaths()
                return new NemotronTranscriber({ ...options, nemotron }, this.onSegment.bind(this), this.onError.bind(this))
            default:
                console.error(`Unknown STT engine: ${engine}`)
                return null
        }
    }

    private static onSegment(segment: any) {
        // the full transcript always reaches the renderer - detection only listens to the selected language
        sendToMain(ToMain.AI_TRANSCRIPT, segment)
    }

    private static onError(message: string) {
        console.error("STT error:", message)
    }
}
