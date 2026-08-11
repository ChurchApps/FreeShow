// AI AUTO SCRIPTURE: local Ollama provider - native REST API on localhost, no auth & nothing leaves the computer

import axios from "axios"
import type { AIError } from "../../../types/ai/AiScripture"
import type { AIProvider } from "./types"
import { buildUserContent, DETECTION_PROMPT, DETECTION_SCHEMA, parseDetectionResponse, toAIError } from "./types"

const API_URL = "http://127.0.0.1:11434"

// loading a cold model into memory can take far longer than a cloud request
const DETECT_TIMEOUT = 30000
// a refused connection on localhost fails within a couple of seconds - the timeout only guards a hung server
const TEST_TIMEOUT = 10000

const NOT_RUNNING: AIError = { code: "network", message: "Ollama is not running - start it or install from ollama.com" }

function pullHint(model: string): AIError {
    return { code: "model_not_found", message: `Model missing - run: ollama pull ${model}` }
}

// ollama error bodies are { error: "<string>" } - a missing model is a 404, but older versions used other statuses, so also match the message
function mapOllamaError(model: string) {
    return (status: number, data: any): AIError | null => {
        const bodyError = typeof data?.error === "string" ? data.error : ""
        if (status === 404 || bodyError.toLowerCase().includes("not found")) return pullHint(model)
        return null
    }
}

// everything runs on localhost - any network level failure means the server is not there
function toOllamaError(err: unknown, model: string): AIError {
    const error = toAIError(err, mapOllamaError(model))
    if (error.code === "network") return NOT_RUNNING
    return error
}

// the local server has no authentication - the apiKey argument is ignored
export const ollamaProvider: AIProvider = {
    id: "ollama",

    async detectScripture(_apiKey, model, req, signal) {
        const body = {
            model,
            stream: false,
            format: DETECTION_SCHEMA, // structured outputs: generation is constrained to the schema
            options: { temperature: 0, num_predict: 1024 },
            messages: [
                { role: "system", content: DETECTION_PROMPT },
                { role: "user", content: buildUserContent(req) }
            ]
        }

        try {
            const response = await axios.post(`${API_URL}/api/chat`, body, { timeout: DETECT_TIMEOUT, signal })
            return { references: parseDetectionResponse(response.data?.message?.content) }
        } catch (err) {
            throw toOllamaError(err, model)
        }
    },

    async testConnection(_apiKey, model) {
        try {
            // listing the local models is free & verifies both the server and the pulled model
            const response = await axios.get(`${API_URL}/api/tags`, { timeout: TEST_TIMEOUT })

            // names match exactly or by the base name before the tag ("gemma3" matches "gemma3:4b")
            const installed = Array.isArray(response.data?.models) ? response.data.models : []
            const base = model.split(":")[0]
            const found = installed.some((entry: any) => typeof entry?.name === "string" && (entry.name === model || entry.name.split(":")[0] === base))

            if (found) return { ok: true }
            return { ok: false, error: pullHint(model) }
        } catch (err) {
            return { ok: false, error: toOllamaError(err, model) }
        }
    }
}
