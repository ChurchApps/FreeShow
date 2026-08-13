import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { getModelPath } from "../../speech/whisper/manager"
import { Transcriber } from "../../speech/whisper/transcriber"

export class WhisperTranscriber {
    transcriber: Transcriber | null = null

    constructor(
        _options: SttEngineOptions & { whisper: any },
        private onSegment: (segment: any) => void,
        private onError: (message: string) => void
    ) {
        const options = {
            binary: _options.whisper,
            modelPath: _options.customModelPath || getModelPath((_options.model || "base") as any),
            language: _options.language || "en",
            onSegment: this.onSegment,
            onError: this.onError
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
