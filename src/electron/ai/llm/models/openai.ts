import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import { APIModel } from "./APIModel"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODELS_URL = "https://api.openai.com/v1/models"

export class OpenAIProvider extends APIModel {
    readonly id = "openai"
    readonly fallbackModel = "gpt-4o-mini"

    private getHeaders(apiKey: string) {
        return { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }
    }

    async testConnection(apiKey: string, model: string) {
        return this.testEndpoint(`${MODELS_URL}/${encodeURIComponent(model)}`, this.getHeaders(apiKey), "GET")
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
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

            if (choice?.message?.refusal) throw new Error("Request was refused by the model: " + String(choice.message.refusal))
            if (choice?.finish_reason === "length") throw new Error("Response was cut off at the token limit")

            return choice?.message?.content || ""
        } catch (err) {
            throw new Error("Failed to complete request: " + (err instanceof Error ? err.message : String(err)))
        }
    }
}

export const openaiProvider = new OpenAIProvider()
