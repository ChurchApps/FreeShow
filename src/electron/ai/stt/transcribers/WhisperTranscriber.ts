import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { getModelPath } from "../../speech/whisper/manager"
import { Transcriber } from "../../speech/whisper/transcriber"
import type { TranscriberSegment } from "../../speech/types"

interface WhisperTranscriberOptions extends SttEngineOptions {
    whisper: { kind: "cli" | "server"; binaryPath: string }
    model: string // resolved by the manager (defaults & interpretation-mode variant applied)
}

export class WhisperTranscriber {
    transcriber: Transcriber | null = null

    constructor(_options: WhisperTranscriberOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void) {
        const interpretation = !!_options.interpretationMode
        const options = {
            binary: _options.whisper,
            modelPath: _options.customModelPath || getModelPath(_options.model),
            // interpretation mode: a multilingual model detects the language of each window on its own
            language: interpretation ? "auto" : _options.language || "en",
            // ...but the free guess is constrained to the languages the user declared - anything else gets re-checked against the listen language
            declaredLanguages: interpretation ? _options.spokenLanguages : undefined,
            primaryLanguage: _options.listenLanguage,
            onSegment,
            onError
        }
        this.transcriber = new Transcriber(options)
    }

    async start() {
        if (!this.transcriber) return false
        await this.transcriber.start()
        return true
    }

    async stop() {
        if (!this.transcriber) return false
        await this.transcriber.stop()
        this.transcriber = null
        return true
    }

    pushAudio(buffer: Uint8Array) {
        if (!this.transcriber) return false
        this.transcriber.pushAudio(buffer)
        return true
    }
}
