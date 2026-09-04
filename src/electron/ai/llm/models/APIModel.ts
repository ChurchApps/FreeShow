import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"

export const LLM_API_TIMEOUT = 12000

export function buildMessages(options: LLMCompletionOptions): any[] {
    const messages: any[] = []
    if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt })
    messages.push({ role: "user", content: options.prompt })
    return messages
}

export abstract class APIModel {
    readonly REQUEST_TIMEOUT: number = LLM_API_TIMEOUT
    abstract readonly id: string
    abstract fallbackModel: string

    abstract testConnection(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; error: string }>
    abstract complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string>

    protected toLLMError(err: unknown): Error {
        if (err instanceof Error) return err

        const e = err as any
        if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT" || e?.code === "ERR_CANCELED") {
            return new Error(String(e.message || "Request timed out"))
        }

        const status = e?.response?.status
        if (typeof status === "number") {
            const message = typeof e.response?.data?.error?.message === "string" ? e.response.data.error.message : undefined
            if (message) return new Error(message)

            if (status === 401) return new Error("Invalid API key")
            if (status === 403) return new Error("Access forbidden")
            if (status === 404) return new Error("Model not found")
            if (status === 429) return new Error("Rate limit exceeded")
            if (status >= 500) return new Error("Server error")
            return new Error(`HTTP ${status}`)
        }

        return new Error(String(e?.message || e || "Network error"))
    }

    protected async testEndpoint(url: string, headers: Record<string, string>, method: "GET" | "POST" = "GET", body?: any): Promise<{ ok: true } | { ok: false; error: string }> {
        try {
            if (method === "POST") {
                await axios.post(url, body, { headers, timeout: this.REQUEST_TIMEOUT })
            } else {
                await axios.get(url, { headers, timeout: this.REQUEST_TIMEOUT })
            }
            return { ok: true }
        } catch (err) {
            return { ok: false, error: this.toLLMError(err).message }
        }
    }
}
