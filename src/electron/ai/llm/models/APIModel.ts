import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"

export const LLM_API_TIMEOUT = 12000

export type LLMErrorCode = "invalid_key" | "forbidden" | "model_not_found" | "rate_limited" | "invalid_request" | "server_error" | "timeout" | "network" | "refusal" | "bad_response"
const LLM_ERROR_CODES: LLMErrorCode[] = ["invalid_key", "forbidden", "model_not_found", "rate_limited", "invalid_request", "server_error", "timeout", "network", "refusal", "bad_response"]

export interface LLMError extends Error {
    code: LLMErrorCode
    retryAfter?: number // seconds, from a 429 Retry-After header
}

// map provider specific HTTP error responses that the generic mapping below can't infer from the status alone
export type ProviderQuirks = (status: number, data: any, headers: { [key: string]: any }) => { code: LLMErrorCode; message?: string } | null

// provider error bodies can echo the submitted credentials (OpenAI 401s include a partially redacted copy of the key) -
// strip anything key shaped before the message leaves the provider module for the renderer/UI/logs
const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]{8,}/g, /AIza[0-9A-Za-z_-]{20,}/g]
function redactSecrets(message: string | undefined): string | undefined {
    if (!message) return message
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), message)
}

export function codedError(code: LLMErrorCode, message?: string, retryAfter?: number): LLMError {
    const error = new Error(redactSecrets(message) || code) as LLMError
    error.code = code
    if (retryAfter !== undefined) error.retryAfter = retryAfter
    return error
}

export abstract class APIModel {
    readonly REQUEST_TIMEOUT: number = LLM_API_TIMEOUT
    abstract readonly id: string
    abstract fallbackModel: string

    abstract testConnection(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; error: string }>
    abstract complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string>

    // normalize any thrown error to one with a stable code, so callers can react to the class of failure
    protected toLLMError(err: unknown, quirks?: ProviderQuirks): LLMError {
        const e = err as any

        // errors thrown by the providers themselves (refusal/bad_response) are already coded
        if (e && typeof e.code === "string" && (LLM_ERROR_CODES as string[]).includes(e.code)) return e as LLMError

        // axios timeout / aborted request
        if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT" || e?.code === "ERR_CANCELED") return codedError("timeout", String(e.message || "Request timed out"))

        const status = e?.response?.status
        if (typeof status === "number") {
            const data = e.response.data
            const quirk = quirks?.(status, data, e.response.headers || {})
            if (quirk) return codedError(quirk.code, quirk.message)

            // the remote providers all use an { error: { message } } body shape
            const message = typeof data?.error?.message === "string" ? data.error.message : undefined
            if (status === 401) return codedError("invalid_key", message)
            if (status === 403) return codedError("forbidden", message)
            if (status === 404) return codedError("model_not_found", message)
            if (status === 429) {
                const retryAfter = Number(e.response.headers?.["retry-after"])
                return codedError("rate_limited", message, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
            }
            if (status >= 500) return codedError("server_error", message)
            return codedError("invalid_request", message || `HTTP ${status}`)
        }

        return codedError("network", String(e?.message || e || "Network error"))
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
            // the code is the stable, translatable identity of the failure - the UI looks it up in ai.error_*
            return { ok: false, error: this.toLLMError(err, this.testQuirks).code }
        }
    }

    // subclasses can extend the generic HTTP mapping for their endpoint's quirks
    protected testQuirks: ProviderQuirks | undefined = undefined
}
