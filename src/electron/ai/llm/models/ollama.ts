import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import { APIModel } from "./APIModel"

const API_URL = "http://127.0.0.1:11434"
const DETECT_TIMEOUT = 30000
const TEST_TIMEOUT = 10000

export class OllamaProvider extends APIModel {
    readonly id = "ollama"
    readonly fallbackModel = "gemma3:4b"

    async testConnection(_apiKey: string, model: string) {
        try {
            const response = await axios.get(`${API_URL}/api/tags`, { timeout: TEST_TIMEOUT })

            const installed = Array.isArray(response.data?.models) ? response.data.models : []
            const base = model.split(":")[0]
            const found = installed.some((entry: any) => typeof entry?.name === "string" && (entry.name === model || entry.name.split(":")[0] === base))

            if (found) return { ok: true as const }
            return { ok: false as const, error: "Model not found" }
        } catch (err) {
            return { ok: false as const, error: String(err) }
        }
    }

    async complete(_apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const messages: any[] = []
        if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt })
        messages.push({ role: "user", content: options.prompt })

        const body: any = {
            model,
            stream: false,
            options: { temperature: options.temperature ?? 0, num_predict: options.maxTokens ?? 1024 },
            messages
        }
        if (options.jsonSchema) body.format = options.jsonSchema

        try {
            const response = await axios.post(`${API_URL}/api/chat`, body, {
                timeout: DETECT_TIMEOUT,
                signal: options.signal
            })
            return response.data?.message?.content || ""
        } catch (err) {
            throw new Error("Failed to complete request: " + (err instanceof Error ? err.message : String(err)))
        }
    }
}

export const ollamaProvider = new OllamaProvider()
