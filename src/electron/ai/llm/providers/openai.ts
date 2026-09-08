import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/Ai"
import { APIModel, buildMessages, type ModelOption } from "./APIProvider"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODELS_URL = "https://api.openai.com/v1/models"

class OpenAIProvider extends APIModel {
    readonly id = "openai"
    readonly fallbackModel = "gpt-4o-mini"

    private getHeaders(apiKey: string) {
        return { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }
    }

    async fetchModels(apiKey: string): Promise<ModelOption[]> {
        if (!apiKey) return []
        try {
            const response = await axios.get(MODELS_URL, {
                headers: this.getHeaders(apiKey),
                timeout: this.REQUEST_TIMEOUT
            })
            const data = Array.isArray(response.data?.data) ? response.data.data : []
            return data
                .filter((m: any) => m.id && (m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3")))
                .map((m: any) => ({ id: m.id, name: m.id }))
                .sort((a: any, b: any) => a.id.localeCompare(b.id))
        } catch {
            return []
        }
    }

    async testConnection(apiKey: string, model: string) {
        return this.testEndpoint(`${MODELS_URL}/${encodeURIComponent(model || this.fallbackModel)}`, this.getHeaders(apiKey), "GET")
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const body: any = {
            model: model || this.fallbackModel,
            temperature: options.temperature ?? 0,
            max_tokens: options.maxTokens ?? 1024,
            messages: buildMessages(options)
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

            if (choice?.message?.refusal) {
                throw new Error(`Request was refused by the model: ${choice.message.refusal}`)
            }
            if (choice?.finish_reason === "length") {
                throw new Error("Response was cut off at the token limit")
            }

            return choice?.message?.content || ""
        } catch (err) {
            throw this.toLLMError(err)
        }
    }
}

export const openaiProvider = new OpenAIProvider()
