// AI AUTO SCRIPTURE: Anthropic (Claude) provider - raw REST, no SDK

import axios from "axios"
import type { AIError } from "../../../types/ai/AiScripture"
import type { AIProvider } from "./types"
import { buildUserContent, DETECTION_PROMPT, DETECTION_SCHEMA, parseDetectionResponse, REQUEST_TIMEOUT, toAIError } from "./types"

const API_URL = "https://api.anthropic.com/v1/messages"

function getHeaders(apiKey: string) {
    return { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }
}

function mapAnthropicError(status: number, data: any, headers: { [key: string]: any }): AIError | null {
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

export const anthropicProvider: AIProvider = {
    id: "anthropic",

    async detectScripture(apiKey, model, req, signal) {
        const body = {
            model,
            // generous cap: on thinking-enabled models (e.g. claude-opus-5) max_tokens covers thinking + text,
            // so a small value could truncate the JSON payload
            max_tokens: 4096,
            // no temperature - not supported on newer Anthropic models
            system: DETECTION_PROMPT,
            messages: [{ role: "user", content: buildUserContent(req) }],
            output_config: { format: { type: "json_schema", schema: DETECTION_SCHEMA } }
        }

        try {
            const response = await axios.post(API_URL, body, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT, signal })
            const data = response.data

            if (data?.stop_reason === "refusal") throw { code: "refusal" } as AIError

            // thinking-enabled models lead the content array with a thinking block - find the text block explicitly
            const textBlock = Array.isArray(data?.content) ? data.content.find((block: any) => block?.type === "text") : undefined
            return { references: parseDetectionResponse(textBlock?.text) }
        } catch (err) {
            throw toAIError(err, mapAnthropicError)
        }
    },

    async testConnection(apiKey, model) {
        try {
            await axios.post(API_URL, { model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }, { headers: getHeaders(apiKey), timeout: REQUEST_TIMEOUT })
            return { ok: true }
        } catch (err) {
            return { ok: false, error: toAIError(err, mapAnthropicError) }
        }
    }
}
