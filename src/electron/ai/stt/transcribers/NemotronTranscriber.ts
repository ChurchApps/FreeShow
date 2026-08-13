import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { NemotronDriver } from "../../speech/nemotron/driver"
import { NemotronModelPaths, getModelDir } from "../../speech/nemotron/manager"

export class NemotronTranscriber {
    transcriber: NemotronDriver | null = null

    constructor(_options: SttEngineOptions & { nemotron: NemotronModelPaths | null }, onSegment: (segment: any) => void, onError: (message: string) => void) {
        const options = {
            paths: _options.nemotron!,
            vadModelPath: _options.customModelPath || getModelDir(),
            language: _options.language || "en",
            onSegment: onSegment,
            onError: onError
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
