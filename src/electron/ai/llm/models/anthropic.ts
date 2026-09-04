import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import { APIModel } from "./APIModel"

const API_URL = "https://api.anthropic.com/v1/messages"

export class AnthropicProvider extends APIModel {
    readonly id = "anthropic"
    readonly fallbackModel = "claude-haiku-4-5"

    private getHeaders(apiKey: string) {
        return { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }
    }

    async testConnection(apiKey: string, model: string) {
        return this.testEndpoint(API_URL, this.getHeaders(apiKey), "POST", {
            model: model || this.fallbackModel,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
        })
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const body: any = {
            model: model || this.fallbackModel,
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

            if (data?.stop_reason === "refusal") {
                throw new Error("Request was refused by the model")
            }
            if (data?.stop_reason === "length") {
                throw new Error("Response was cut off at the token limit")
            }

            const textBlock = Array.isArray(data?.content) ? data.content.find((block: any) => block?.type === "text") : undefined
            return textBlock?.text || ""
        } catch (err) {
            throw this.toLLMError(err)
        }
    }
}

export const anthropicProvider = new AnthropicProvider()
