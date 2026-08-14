import axios from "axios"
import { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import type { ProviderQuirks } from "./APIModel"
import { APIModel, codedError } from "./APIModel"

const API_URL = "https://api.anthropic.com/v1/messages"

// error shapes the generic HTTP status mapping can't infer on its own
const anthropicQuirks: ProviderQuirks = (status, data, headers) => {
    const type = data?.error?.type
    const message = typeof data?.error?.message === "string" ? data.error.message : undefined

    if (status === 401 || type === "authentication_error") return { code: "invalid_key", message }
    if (status === 404 || type === "not_found_error") return { code: "model_not_found", message }
    if (status === 429) {
        const retryAfter = headers["retry-after"]
        return { code: "rate_limited", message: retryAfter ? `Rate limited, retry after ${retryAfter}s` : message }
    }
    if (type === "overloaded_error") return { code: "server_error", message }

    // 403/400/500/529 are covered by the generic status mapping
    return null
}

export class AnthropicProvider extends APIModel {
    readonly id = "anthropic"
    readonly fallbackModel = "claude-haiku-4-5"
    protected testQuirks = anthropicQuirks

    private getHeaders(apiKey: string) {
        return { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }
    }

    async testConnection(apiKey: string, model: string) {
        return this.testEndpoint(API_URL, this.getHeaders(apiKey), "POST", {
            model,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
        })
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        if (!model) model = this.fallbackModel

        const body: any = {
            model,
            max_tokens: options.maxTokens ?? 4096,
            messages: [{ role: "user", content: options.prompt }]
        }
        if (options.systemPrompt) body.system = options.systemPrompt
        if (options.jsonSchema) body.output_config = { format: { type: "json_schema", schema: options.jsonSchema } }

        try {
            const response = await axios.post(API_URL, body, {
                headers: this.getHeaders(apiKey),
                timeout: this.REQUEST_TIMEOUT,
                signal: options.signal
            })
            const data = response.data

            if (data?.stop_reason === "refusal") throw codedError("refusal", "Request was refused by the model")
            if (data?.stop_reason === "length") throw codedError("bad_response", "Response was cut off at the token limit")

            const textBlock = Array.isArray(data?.content) ? data.content.find((block: any) => block?.type === "text") : undefined
            return textBlock?.text || ""
        } catch (err) {
            // rethrow with a stable code so callers can react to the class of failure
            throw this.toLLMError(err, anthropicQuirks)
        }
    }
}

export const anthropicProvider = new AnthropicProvider()
