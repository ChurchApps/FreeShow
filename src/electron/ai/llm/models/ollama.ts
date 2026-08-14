import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import type { ProviderQuirks } from "./APIModel"
import { APIModel } from "./APIModel"

const API_URL = "http://127.0.0.1:11434"
const DETECT_TIMEOUT = 30000
const TEST_TIMEOUT = 10000

// ollama error bodies are { error: "<string>" } - a missing model is a 404, but older versions used other statuses, so also match the message
const ollamaQuirks: ProviderQuirks = (status, data) => {
    const bodyError = typeof data?.error === "string" ? data.error : ""
    if (status === 404 || bodyError.toLowerCase().includes("not found")) return { code: "model_not_found", message: bodyError || undefined }

    return null
}

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
            return { ok: false as const, error: "model_not_found" }
        } catch {
            // everything runs on localhost - any failure here means the server is not there
            return { ok: false as const, error: "ollama_not_running" }
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
            // rethrow with a stable code so callers can react to the class of failure
            // (everything runs on localhost, so a network level failure means the server is not there)
            throw this.toLLMError(err, ollamaQuirks)
        }
    }
}

export const ollamaProvider = new OllamaProvider()
