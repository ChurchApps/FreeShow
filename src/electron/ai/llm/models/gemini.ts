import axios from "axios"
import type { LLMCompletionOptions } from "../../../../types/ai/AiModels"
import type { ProviderQuirks } from "./APIModel"
import { APIModel, codedError } from "./APIModel"

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

// a bad key is reported as HTTP 400 INVALID_ARGUMENT, not 401 - only the message identifies it
const geminiQuirks: ProviderQuirks = (status, data) => {
    const message = typeof data?.error?.message === "string" ? data.error.message : undefined
    if (status === 400 && message && message.includes("API key not valid")) return { code: "invalid_key", message }

    return null
}

export class GeminiProvider extends APIModel {
    readonly id = "gemini"
    readonly fallbackModel = "gemini-2.5-flash"
    protected testQuirks = geminiQuirks

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
        if (!model) model = this.fallbackModel
        return this.testEndpoint(`${API_BASE}/${encodeURIComponent(model)}`, this.getHeaders(apiKey), "GET")
    }

    async complete(apiKey: string, model: string, options: LLMCompletionOptions): Promise<string> {
        if (!model) model = this.fallbackModel
        const generationConfig: any = {
            temperature: options.temperature ?? 0,
            maxOutputTokens: options.maxTokens ?? 1024
        }
        // gemini 2.5 "thinks" by default and the thinking tokens count against maxOutputTokens -
        // unbudgeted, a small cap is eaten by thinking before any answer exists and the response
        // comes back with no parts at all. Flash/Flash-Lite accept a zero budget; Pro's minimum
        // is 128, so it gets the smallest budget it allows
        if (/^gemini-2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: /pro/.test(model) ? 128 : 0 }
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

            if (data?.promptFeedback?.blockReason) throw codedError("refusal", "Request was refused by the model: " + String(data.promptFeedback.blockReason))

            const candidate = data?.candidates?.[0]
            if (candidate?.finishReason === "SAFETY") throw codedError("refusal", "Request was refused by the model due to safety reasons")

            const parts = candidate?.content?.parts
            // an answer-less MAX_TOKENS response means the budget went to thinking/overhead -
            // name it, or the failure surfaces as an inscrutable empty-parse downstream
            if (!Array.isArray(parts) && candidate?.finishReason === "MAX_TOKENS") throw codedError("bad_response", "The model spent its whole token budget without producing an answer (finishReason MAX_TOKENS)")
            return Array.isArray(parts) ? parts.map((part: any) => part?.text || "").join("") : ""
        } catch (err) {
            // rethrow with a stable code so callers can react to the class of failure
            throw this.toLLMError(err, geminiQuirks)
        }
    }
}

export const geminiProvider = new GeminiProvider()
