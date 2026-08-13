import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import { APIModel } from "./APIModel"

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

export class GeminiProvider extends APIModel {
    readonly id = "gemini"
    readonly fallbackModel = "gemini-2.5-flash"

    private getHeaders(apiKey: string) {
        return { "x-goog-api-key": apiKey, "content-type": "application/json" }
    }

    private removeAdditionalProperties(schema: any): any {
        if (Array.isArray(schema)) return schema.map((s) => this.removeAdditionalProperties(s))
        if (!schema || typeof schema !== "object") return schema

        const copy: any = {}
        Object.keys(schema).forEach((key) => {
            if (key === "additionalProperties") return
            copy[key] = this.removeAdditionalProperties(schema[key])
        })
        return copy
    }

    async testConnection(apiKey: string, model: string) {
        return this.testEndpoint(`${API_BASE}/${encodeURIComponent(model)}`, this.getHeaders(apiKey), "GET")
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        const generationConfig: any = {
            temperature: options.temperature ?? 0,
            maxOutputTokens: options.maxTokens ?? 1024
        }
        if (options.jsonSchema) {
            generationConfig.responseMimeType = "application/json"
            generationConfig.responseSchema = this.removeAdditionalProperties(options.jsonSchema)
        }

        const body: any = {
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            generationConfig
        }
        if (options.systemPrompt) {
            body.systemInstruction = { parts: [{ text: options.systemPrompt }] }
        }

        try {
            const response = await axios.post(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, body, {
                headers: this.getHeaders(apiKey),
                timeout: this.REQUEST_TIMEOUT,
                signal: options.signal
            })
            const data = response.data

            if (data?.promptFeedback?.blockReason) throw new Error("Request was refused by the model: " + String(data.promptFeedback.blockReason))

            const candidate = data?.candidates?.[0]
            if (candidate?.finishReason === "SAFETY") throw new Error("Request was refused by the model due to safety reasons")

            const parts = candidate?.content?.parts
            return Array.isArray(parts) ? parts.map((part: any) => part?.text || "").join("") : ""
        } catch (err) {
            throw new Error("Failed to complete request: " + (err instanceof Error ? err.message : String(err)))
        }
    }
}

export const geminiProvider = new GeminiProvider()
