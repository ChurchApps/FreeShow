// AI AUTO SCRIPTURE: Google Gemini provider - raw REST, no SDK

import axios from "axios"
import type { AIError } from "../../../types/ai/AiScripture"
import type { AIProvider } from "./types"
import { buildUserContent, DETECTION_PROMPT, DETECTION_SCHEMA, parseDetectionResponse, REQUEST_TIMEOUT, schemaWithoutAdditionalProperties, toAIError } from "./types"

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

const GEMINI_DETECTION_SCHEMA = schemaWithoutAdditionalProperties(DETECTION_SCHEMA)

// the key goes in a header, NEVER as a ?key= query param (would end up in logs/proxies)
function getHeaders(apiKey: string) {
    return { "x-goog-api-key": apiKey, "content-type": "application/json" }
}

function mapGeminiError(status: number, data: any): AIError | null {
    const message = typeof data?.error?.message === "string" ? data.error.message : undefined

    // a bad key is reported as HTTP 400 INVALID_ARGUMENT, not 401 - only the message identifies it
    if (status === 400 && message && message.includes("API key not valid")) return { code: "invalid_key", message }

    return null
}

export const geminiProvider: AIProvider = {
    id: "gemini",

    async detectScripture(apiKey, model, req, signal) {
        const body = {
            systemInstruction: { parts: [{ text: DETECTION_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: buildUserContent(req) }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: GEMINI_DETECTION_SCHEMA }
        }

        try {
            const response = await axios.post(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, body, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT, signal })
            const data = response.data

            if (data?.promptFeedback?.blockReason) throw { code: "refusal", message: String(data.promptFeedback.blockReason) } as AIError

            const candidate = data?.candidates?.[0]
            if (candidate?.finishReason === "SAFETY") throw { code: "refusal" } as AIError

            const parts = candidate?.content?.parts
            const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || "").join("") : undefined

            return { references: parseDetectionResponse(text) }
        } catch (err) {
            throw toAIError(err, mapGeminiError)
        }
    },

    async testConnection(apiKey, model) {
        try {
            await axios.get(`${API_BASE}/${encodeURIComponent(model)}`, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT })
            return { ok: true }
        } catch (err) {
            return { ok: false, error: toAIError(err, mapGeminiError) }
        }
    }
}
