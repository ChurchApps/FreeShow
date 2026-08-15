import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { getModelPath } from "../../speech/whisper/manager"
import { composeBiblePrompt } from "../../speech/whisper/prompt"
import { Transcriber } from "../../speech/whisper/transcriber"
import type { TranscriberSegment } from "../../speech/types"

interface WhisperTranscriberOptions extends SttEngineOptions {
    whisper: { kind: "cli" | "server"; binaryPath: string }
    model: string // resolved by the manager (defaults & interpretation-mode variant applied)
}

// the current book plus the previous one keeps the prompt stable across a sermon that jumps between two passages
const CONTEXT_BOOK_COUNT = 2

export class WhisperTranscriber {
    transcriber: Transcriber | null = null
    // the bias prompt is English biblical vocabulary - it would degrade decoding of any other language
    private promptEnabled = false
    private contextBooks: number[] = []

    constructor(_options: WhisperTranscriberOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void) {
        const interpretation = !!_options.interpretationMode
        this.promptEnabled = !interpretation && (_options.language || "en").startsWith("en")
        const options = {
            binary: _options.whisper,
            modelPath: _options.customModelPath || getModelPath(_options.model),
            // interpretation mode: a multilingual model detects the language of each window on its own
            language: interpretation ? "auto" : _options.language || "en",
            // ...but the free guess is constrained to the languages the user declared - anything else gets re-checked against the listen language
            declaredLanguages: interpretation ? _options.spokenLanguages : undefined,
            primaryLanguage: _options.listenLanguage,
            prompt: this.promptEnabled ? composeBiblePrompt() : undefined,
            onSegment,
            onError
        }
        this.transcriber = new Transcriber(options)
    }

    // scripture detection reports which bible book is being preached from - bias upcoming windows
    // toward that book's names (the vocabulary's long tail never fits in one static prompt)
    setContextBook(bookNumber: number) {
        if (!this.promptEnabled || !this.transcriber) return
        if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > 66) return
        if (this.contextBooks[0] === bookNumber) return

        this.contextBooks = [bookNumber, ...this.contextBooks.filter((book) => book !== bookNumber)].slice(0, CONTEXT_BOOK_COUNT)
        this.transcriber.setPrompt(composeBiblePrompt(this.contextBooks))
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
