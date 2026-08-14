import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { NemotronDriver } from "../../speech/nemotron/driver"
import type { NemotronModelPaths } from "../../speech/nemotron/manager"
import type { TranscriberSegment } from "../../speech/types"

interface NemotronTranscriberOptions extends SttEngineOptions {
    nemotron: NemotronModelPaths
    vadModelPath: string // resolved by the manager - a file path, not the model directory
}

export class NemotronTranscriber {
    transcriber: NemotronDriver | null = null

    constructor(_options: NemotronTranscriberOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void) {
        const options = {
            paths: _options.nemotron,
            vadModelPath: _options.vadModelPath,
            language: _options.language || "en",
            onSegment,
            onError
        }
        this.transcriber = new NemotronDriver(options)
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
