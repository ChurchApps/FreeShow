import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"

export const LLM_API_TIMEOUT = 12000

export abstract class APIModel {
    readonly REQUEST_TIMEOUT: number = LLM_API_TIMEOUT
    abstract readonly id: string
    abstract fallbackModel: string

    abstract testConnection(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; error: string }>
    abstract complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string>

    protected async testEndpoint(url: string, headers: Record<string, string>, method: "GET" | "POST" = "GET", body?: any): Promise<{ ok: true } | { ok: false; error: string }> {
        try {
            if (method === "POST") {
                await axios.post(url, body, { headers, timeout: this.REQUEST_TIMEOUT })
            } else {
                await axios.get(url, { headers, timeout: this.REQUEST_TIMEOUT })
            }
            return { ok: true }
        } catch (err) {
            return { ok: false, error: String(err) }
        }
    }
}
