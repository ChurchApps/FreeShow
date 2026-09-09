import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/Ai"
import { APIModel, buildMessages, type ModelOption } from "./APIProvider"

const API_URL = "http://127.0.0.1:11434"

class OllamaProvider extends APIModel {
    readonly id = "ollama"
    readonly fallbackModel = "gemma3:4b"

    async fetchModels(): Promise<ModelOption[]> {
        try {
            const { data } = await axios.get(`${API_URL}/api/tags`, { timeout: 10000 })
            const models = Array.isArray(data?.models) ? data.models : []
            return models.map((m: any) => ({ id: m.name, name: m.name }))
        } catch {
            return []
        }
    }

    async testConnection(_apiKey: string, model: string) {
        try {
            const models = await this.fetchModels()
            const base = model.split(":")[0]
            const found = models.some((entry) => entry.id === model || entry.id.split(":")[0] === base)

            return found ? { ok: true as const } : { ok: false as const, error: "Model not found" }
        } catch {
            return { ok: false as const, error: "Ollama server is not running on localhost" }
        }
    }

    async complete(_apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const body: any = {
            model: model || this.fallbackModel,
            stream: false,
            options: { temperature: options.temperature ?? 0, num_predict: options.maxTokens ?? 1024 },
            messages: buildMessages(options)
        }
        if (options.jsonSchema) body.format = options.jsonSchema

        try {
            const { data } = await axios.post(`${API_URL}/api/chat`, body, { timeout: 30000, signal: options.signal })
            return data?.message?.content || ""
        } catch (err) {
            throw this.toLLMError(err)
        }
    }
}

export const ollamaProvider = new OllamaProvider()
