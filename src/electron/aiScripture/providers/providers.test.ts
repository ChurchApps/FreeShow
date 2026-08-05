import axios from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("axios", () => ({
    default: { post: vi.fn(), get: vi.fn() }
}))

import { anthropicProvider } from "./anthropic"
import { geminiProvider } from "./gemini"
import { getProvider } from "./index"
import { openaiProvider } from "./openai"
import type { AIDetectionRequest, RawDetection } from "./types"

const post = vi.mocked(axios.post)
const get = vi.mocked(axios.get)

const signal = new AbortController().signal
const request: AIDetectionRequest = { transcript: "turn with me to John chapter 3 verse 16", alreadyDetected: ["Romans 8:28"] }
const detection: RawDetection = { book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high", type: "explicit" }

function httpError(status: number, data: any, headers: any = {}) {
    return { response: { status, data, headers } }
}

beforeEach(() => {
    post.mockReset()
    get.mockReset()
})

// ANTHROPIC

function anthropicResponse(references: any[], stopReason = "end_turn") {
    return { data: { stop_reason: stopReason, content: [{ type: "text", text: JSON.stringify({ references }) }] } }
}

describe("anthropic provider", () => {
    it("parses references from a successful structured output response", async () => {
        post.mockResolvedValueOnce(anthropicResponse([{ ...detection, quote: "" }]) as any)

        const result = await anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)
        expect(result.references).toEqual([detection])

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://api.anthropic.com/v1/messages")
        expect(body.model).toBe("claude-haiku-4-5")
        expect(body.max_tokens).toBe(1024)
        expect(body.temperature).toBeUndefined() // anthropic must not receive a temperature
        expect(body.output_config.format.type).toBe("json_schema")
        expect(body.messages[0].content).toContain("Romans 8:28")
        expect(body.messages[0].content).toContain(request.transcript)
        expect(config.headers["x-api-key"]).toBe("sk-key")
        expect(config.headers["anthropic-version"]).toBe("2023-06-01")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
    })

    it("filters out entries that do not match the reference shape", async () => {
        post.mockResolvedValueOnce(anthropicResponse([detection, { book: "Nowhere" }, { ...detection, verseStart: "16" }]) as any)

        const result = await anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)
        expect(result.references).toEqual([detection])
    })

    it("throws refusal when stop_reason is refusal", async () => {
        post.mockResolvedValueOnce({ data: { stop_reason: "refusal", content: [] } } as any)
        await expect(anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)).rejects.toMatchObject({ code: "refusal" })
    })

    it("maps 401 to invalid_key", async () => {
        post.mockRejectedValueOnce(httpError(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }))
        await expect(anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)).rejects.toMatchObject({ code: "invalid_key" })
    })

    it("maps 429 to rate_limited & reads the retry-after header into the message", async () => {
        post.mockRejectedValueOnce(httpError(429, { error: { type: "rate_limit_error" } }, { "retry-after": "8" }))
        const error = await anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal).catch((err: any) => err)
        expect(error.code).toBe("rate_limited")
        expect(error.message).toContain("8")
    })

    it("maps unparseable JSON content to bad_response", async () => {
        post.mockResolvedValueOnce({ data: { stop_reason: "end_turn", content: [{ type: "text", text: "not json {" }] } } as any)
        await expect(anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)).rejects.toMatchObject({ code: "bad_response" })
    })

    it("maps an axios timeout to timeout", async () => {
        post.mockRejectedValueOnce({ code: "ECONNABORTED", message: "timeout of 12000ms exceeded" })
        await expect(anthropicProvider.detectScripture("sk-key", "claude-haiku-4-5", request, signal)).rejects.toMatchObject({ code: "timeout" })
    })

    it("testConnection returns ok on 200 & sends a minimal message without output_config", async () => {
        post.mockResolvedValueOnce({ data: { id: "msg_1" } } as any)

        const result = await anthropicProvider.testConnection("sk-key", "claude-haiku-4-5")
        expect(result).toEqual({ ok: true })

        const body = post.mock.calls[0][1] as any
        expect(body.max_tokens).toBe(1)
        expect(body.output_config).toBeUndefined()
    })

    it("testConnection maps 401 to invalid_key", async () => {
        post.mockRejectedValueOnce(httpError(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }))
        const result = await anthropicProvider.testConnection("sk-key", "claude-haiku-4-5")
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe("invalid_key")
    })
})

// OPENAI

function openaiResponse(references: any[]) {
    return { data: { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ references }), refusal: null } }] } }
}

describe("openai provider", () => {
    it("parses references from a successful structured output response", async () => {
        post.mockResolvedValueOnce(openaiResponse([detection]) as any)

        const result = await openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)
        expect(result.references).toEqual([detection])

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://api.openai.com/v1/chat/completions")
        expect(body.temperature).toBe(0)
        expect(body.response_format.json_schema.strict).toBe(true)
        expect(body.response_format.json_schema.name).toBe("scripture_references")
        expect(config.headers.Authorization).toBe("Bearer sk-key")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
    })

    it("throws refusal when message.refusal is set", async () => {
        post.mockResolvedValueOnce({ data: { choices: [{ finish_reason: "stop", message: { content: null, refusal: "I can't help with that." } }] } } as any)
        await expect(openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)).rejects.toMatchObject({ code: "refusal" })
    })

    it("maps a length finish_reason to bad_response", async () => {
        post.mockResolvedValueOnce({ data: { choices: [{ finish_reason: "length", message: { content: '{"references":[' } }] } } as any)
        await expect(openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)).rejects.toMatchObject({ code: "bad_response" })
    })

    it("maps 401 to invalid_key", async () => {
        post.mockRejectedValueOnce(httpError(401, { error: { message: "Incorrect API key provided" } }))
        await expect(openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)).rejects.toMatchObject({ code: "invalid_key" })
    })

    it("maps 429 to rate_limited", async () => {
        post.mockRejectedValueOnce(httpError(429, { error: { message: "Rate limit reached", code: "rate_limit_exceeded" } }))
        await expect(openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)).rejects.toMatchObject({ code: "rate_limited" })
    })

    it("maps 429 insufficient_quota to rate_limited with a quota message", async () => {
        post.mockRejectedValueOnce(httpError(429, { error: { code: "insufficient_quota", message: "You exceeded your current quota" } }))
        const error = await openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal).catch((err: any) => err)
        expect(error.code).toBe("rate_limited")
        expect(error.message).toContain("quota")
    })

    it("maps unparseable JSON content to bad_response", async () => {
        post.mockResolvedValueOnce({ data: { choices: [{ finish_reason: "stop", message: { content: "oops" } }] } } as any)
        await expect(openaiProvider.detectScripture("sk-key", "gpt-4o-mini", request, signal)).rejects.toMatchObject({ code: "bad_response" })
    })

    it("testConnection uses the free models endpoint & returns ok on 200", async () => {
        get.mockResolvedValueOnce({ data: { id: "gpt-4o-mini" } } as any)

        const result = await openaiProvider.testConnection("sk-key", "gpt-4o-mini")
        expect(result).toEqual({ ok: true })
        expect(get).toHaveBeenCalledWith("https://api.openai.com/v1/models/gpt-4o-mini", expect.objectContaining({ timeout: 12000 }))
        expect(post).not.toHaveBeenCalled()
    })

    it("testConnection maps 401 to invalid_key & 404 to model_not_found", async () => {
        get.mockRejectedValueOnce(httpError(401, { error: { message: "Incorrect API key provided" } }))
        let result = await openaiProvider.testConnection("sk-key", "gpt-4o-mini")
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe("invalid_key")

        get.mockRejectedValueOnce(httpError(404, { error: { message: "The model does not exist" } }))
        result = await openaiProvider.testConnection("sk-key", "gpt-nope")
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe("model_not_found")
    })
})

// GEMINI

function geminiResponse(references: any[]) {
    return { data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ references }) }] } }] } }
}

describe("gemini provider", () => {
    it("parses references from a successful structured output response", async () => {
        post.mockResolvedValueOnce(geminiResponse([detection]) as any)

        const result = await geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)
        expect(result.references).toEqual([detection])

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent")
        expect(url).not.toContain("key=") // the key must never be a query param
        expect(config.headers["x-goog-api-key"]).toBe("g-key")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
        expect(body.generationConfig.temperature).toBe(0)
        expect(body.generationConfig.responseMimeType).toBe("application/json")
        expect(JSON.stringify(body.generationConfig.responseSchema)).not.toContain("additionalProperties")
    })

    it("throws refusal on promptFeedback.blockReason", async () => {
        post.mockResolvedValueOnce({ data: { promptFeedback: { blockReason: "SAFETY" }, candidates: [] } } as any)
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "refusal" })
    })

    it("throws refusal on a SAFETY finishReason", async () => {
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "SAFETY" }] } } as any)
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "refusal" })
    })

    it("maps a 400 bad key response to invalid_key by matching the message", async () => {
        post.mockRejectedValueOnce(httpError(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key." } }))
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "invalid_key" })
    })

    it("maps other 400 responses to invalid_request", async () => {
        post.mockRejectedValueOnce(httpError(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "Invalid JSON payload received." } }))
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "invalid_request" })
    })

    it("maps 429 to rate_limited", async () => {
        post.mockRejectedValueOnce(httpError(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }))
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "rate_limited" })
    })

    it("maps unparseable JSON content to bad_response", async () => {
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "###" }] } }] } } as any)
        await expect(geminiProvider.detectScripture("g-key", "gemini-2.0-flash", request, signal)).rejects.toMatchObject({ code: "bad_response" })
    })

    it("testConnection gets the model with the header key & returns ok on 200", async () => {
        get.mockResolvedValueOnce({ data: { name: "models/gemini-2.0-flash" } } as any)

        const result = await geminiProvider.testConnection("g-key", "gemini-2.0-flash")
        expect(result).toEqual({ ok: true })

        const [url, config] = get.mock.calls[0] as any[]
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash")
        expect(url).not.toContain("key=")
        expect(config.headers["x-goog-api-key"]).toBe("g-key")
    })

    it("testConnection maps a 400 bad key response to invalid_key", async () => {
        get.mockRejectedValueOnce(httpError(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key." } }))
        const result = await geminiProvider.testConnection("g-key", "gemini-2.0-flash")
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe("invalid_key")
    })
})

// REGISTRY

describe("getProvider", () => {
    it("returns the matching provider for each id", () => {
        expect(getProvider("anthropic").id).toBe("anthropic")
        expect(getProvider("openai").id).toBe("openai")
        expect(getProvider("gemini").id).toBe("gemini")
    })

    it("falls back to the default model when the model string is empty", async () => {
        post.mockResolvedValueOnce(anthropicResponse([]) as any)
        await getProvider("anthropic").detectScripture("sk-key", "", request, signal)
        expect((post.mock.calls[0][1] as any).model).toBe("claude-haiku-4-5")

        get.mockResolvedValueOnce({ data: {} } as any)
        await getProvider("openai").testConnection("sk-key", "")
        expect(get.mock.calls[0][0]).toBe("https://api.openai.com/v1/models/gpt-4o-mini")
    })

    it("keeps an explicitly configured model", async () => {
        post.mockResolvedValueOnce(anthropicResponse([]) as any)
        await getProvider("anthropic").detectScripture("sk-key", "claude-opus-5", request, signal)
        expect((post.mock.calls[0][1] as any).model).toBe("claude-opus-5")
    })
})
