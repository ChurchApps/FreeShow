import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import type { ProviderQuirks } from "./APIModel"
import { APIModel, codedError } from "./APIModel"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODELS_URL = "https://api.openai.com/v1/models"

// a 429 with insufficient_quota is a billing problem, not a transient rate limit
const openaiQuirks: ProviderQuirks = (status, data) => {
    if (status === 429 && data?.error?.code === "insufficient_quota") {
        const message = typeof data.error.message === "string" ? data.error.message : undefined
        return { code: "rate_limited", message: message || "API quota exceeded, check your OpenAI plan and billing" }
    }

    return null
}

export class OpenAIProvider extends APIModel {
    readonly id = "openai"
    readonly fallbackModel = "gpt-4o-mini"
    protected testQuirks = openaiQuirks

    private getHeaders(apiKey: string) {
        return { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }
    }

    async testConnection(apiKey: string, model: string) {
        if (!model) model = this.fallbackModel
        return this.testEndpoint(`${MODELS_URL}/${encodeURIComponent(model)}`, this.getHeaders(apiKey), "GET")
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        if (!model) model = this.fallbackModel
        const messages: any[] = []
        if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt })
        messages.push({ role: "user", content: options.prompt })

        const body: any = {
            model,
            temperature: options.temperature ?? 0,
            max_tokens: options.maxTokens ?? 1024,
            messages
        }

        if (options.jsonSchema) {
            body.response_format = {
                type: "json_schema",
                json_schema: { name: "response_schema", strict: true, schema: options.jsonSchema }
            }
        }

        try {
            const response = await axios.post(API_URL, body, {
                headers: this.getHeaders(apiKey),
                timeout: this.REQUEST_TIMEOUT,
                signal: options.signal
            })
            const choice = response.data?.choices?.[0]

            if (choice?.message?.refusal) throw codedError("refusal", "Request was refused by the model: " + String(choice.message.refusal))
            if (choice?.finish_reason === "length") throw codedError("bad_response", "Response was cut off at the token limit")

            return choice?.message?.content || ""
        } catch (err) {
            // rethrow with a stable code so callers can react to the class of failure
            throw this.toLLMError(err, openaiQuirks)
        }
    }
}

export const openaiProvider = new OpenAIProvider()
