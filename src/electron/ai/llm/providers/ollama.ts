import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/Ai"
import { APIModel, buildMessages, type ModelOption } from "./APIProvider"

const API_URL = "http://127.0.0.1:11434"
const DETECT_TIMEOUT = 30000
const TEST_TIMEOUT = 10000

class OllamaProvider extends APIModel {
    readonly id = "ollama"
    readonly fallbackModel = "gemma3:4b"

    async fetchModels(): Promise<ModelOption[]> {
        try {
            const response = await axios.get(`${API_URL}/api/tags`, { timeout: TEST_TIMEOUT })
            const installed = Array.isArray(response.data?.models) ? response.data.models : []
            return installed.map((m: any) => ({
                id: m.name,
                name: m.name
            }))
        } catch {
            return []
        }
    }

    async testConnection(_apiKey: string, model: string) {
        const models = await this.fetchModels()
        try {
            const base = model.split(":")[0]
            const found = models.some((entry: any) => typeof entry?.name === "string" && (entry.name === model || entry.name.split(":")[0] === base))

            return found ? { ok: true as const } : { ok: false as const, error: "Model not found" }
        } catch {
            return { ok: false as const, error: "Ollama server is not running on localhost" }
        }
    }

    async complete(_apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const targetModel = model || this.fallbackModel
        const body: any = {
            model: targetModel,
            stream: false,
            options: { temperature: options.temperature ?? 0, num_predict: options.maxTokens ?? 1024 },
            messages: buildMessages(options)
        }
        if (options.jsonSchema) body.format = options.jsonSchema

        try {
            const response = await axios.post(`${API_URL}/api/chat`, body, {
                timeout: DETECT_TIMEOUT,
                signal: options.signal
            })
            return response.data?.message?.content || ""
        } catch (err) {
            throw this.toLLMError(err)
        }
    }
}

export const ollamaProvider = new OllamaProvider()
