// AI AUTO SCRIPTURE: OpenAI provider - raw REST, no SDK

import axios from "axios"
import type { AIError } from "../../../types/AiScripture"
import type { AIProvider } from "./types"
import { buildUserContent, DETECTION_PROMPT, DETECTION_SCHEMA, parseDetectionResponse, REQUEST_TIMEOUT, toAIError } from "./types"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODELS_URL = "https://api.openai.com/v1/models"

function getHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }
}

function mapOpenAiError(status: number, data: any): AIError | null {
    if (status === 429 && data?.error?.code === "insufficient_quota") {
        const message = typeof data.error.message === "string" ? data.error.message : undefined
        return { code: "rate_limited", message: message || "API quota exceeded, check your OpenAI plan and billing" }
    }

    return null
}

export const openaiProvider: AIProvider = {
    id: "openai",

    async detectScripture(apiKey, model, req, signal) {
        const body = {
            model,
            temperature: 0,
            max_tokens: 1024,
            messages: [
                { role: "system", content: DETECTION_PROMPT },
                { role: "user", content: buildUserContent(req) }
            ],
            response_format: { type: "json_schema", json_schema: { name: "scripture_references", strict: true, schema: DETECTION_SCHEMA } }
        }

        try {
            const response = await axios.post(API_URL, body, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT, signal })
            const choice = response.data?.choices?.[0]

            if (choice?.message?.refusal) throw { code: "refusal", message: String(choice.message.refusal) } as AIError
            if (choice?.finish_reason === "length") throw { code: "bad_response", message: "Response was cut off at the token limit" } as AIError

            return { references: parseDetectionResponse(choice?.message?.content) }
        } catch (err) {
            throw toAIError(err, mapOpenAiError)
        }
    },

    async testConnection(apiKey, model) {
        try {
            // retrieving the model metadata is free & verifies both the key and the model id
            await axios.get(`${MODELS_URL}/${encodeURIComponent(model)}`, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT })
            return { ok: true }
        } catch (err) {
            return { ok: false, error: toAIError(err, mapOpenAiError) }
        }
    }
}
