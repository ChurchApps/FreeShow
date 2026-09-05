import axios from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getLLMProvider } from "./llmProviders"
import { anthropicProvider } from "./models/anthropic"
import { geminiProvider } from "./models/gemini"
import { ollamaProvider } from "./models/ollama"
import { openaiProvider } from "./models/openai"

vi.mock("axios", () => ({
    default: { post: vi.fn(), get: vi.fn() }
}))

const post = vi.mocked(axios.post)
const get = vi.mocked(axios.get)

const signal = new AbortController().signal

function httpError(status: number, data: any, headers: any = {}) {
    return { response: { status, data, headers } }
}

beforeEach(() => {
    post.mockReset()
    get.mockReset()
})

describe("Provider Registry", () => {
    it("returns the matching manager for each provider ID", () => {
        expect(getLLMProvider("anthropic").id).toBe("anthropic")
        expect(getLLMProvider("openai").id).toBe("openai")
        expect(getLLMProvider("gemini").id).toBe("gemini")
        expect(getLLMProvider("ollama").id).toBe("ollama")
    })
})

describe("Anthropic Provider Connection", () => {
    it("completes a raw prompt request with correct headers and parameters", async () => {
        post.mockResolvedValueOnce({
            data: { stop_reason: "end_turn", content: [{ type: "text", text: "hello" }] }
        } as any)

        const result = await anthropicProvider.complete("sk-key", "claude-haiku-4-5", {
            prompt: "ping",
            signal
        })

        expect(result).toBe("hello")

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://api.anthropic.com/v1/messages")
        expect(body.model).toBe("claude-haiku-4-5")
        expect(body.max_tokens).toBe(4096)
        expect(config.headers["x-api-key"]).toBe("sk-key")
        expect(config.headers["anthropic-version"]).toBe("2023-06-01")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
    })

    it("testConnection returns ok on 200 & sends a minimal test payload", async () => {
        post.mockResolvedValueOnce({ data: { id: "msg_1" } } as any)

        const result = await anthropicProvider.testConnection("sk-key", "claude-haiku-4-5")
        expect(result).toEqual({ ok: true })

        const body = post.mock.calls[0][1] as any
        expect(body.max_tokens).toBe(1)
        expect(body.messages).toEqual([{ role: "user", content: "ping" }])
    })

    it("testConnection returns ok: false on error", async () => {
        post.mockRejectedValueOnce(httpError(401, { error: { type: "authentication_error" } }))
        const result = await anthropicProvider.testConnection("sk-key", "claude-haiku-4-5")
        expect(result.ok).toBe(false)
    })
})

describe("OpenAI Provider Connection", () => {
    it("completes a raw prompt request with default temperature and tokens", async () => {
        post.mockResolvedValueOnce({
            data: { choices: [{ finish_reason: "stop", message: { content: "hello" } }] }
        } as any)

        const result = await openaiProvider.complete("sk-key", "gpt-4o-mini", { prompt: "hi", signal })
        expect(result).toBe("hello")

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://api.openai.com/v1/chat/completions")
        expect(body.temperature).toBe(0)
        expect(body.max_tokens).toBe(1024)
        expect(config.headers.Authorization).toBe("Bearer sk-key")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
    })

    it("testConnection uses the models endpoint & returns ok on 200", async () => {
        get.mockResolvedValueOnce({ data: { id: "gpt-4o-mini" } } as any)

        const result = await openaiProvider.testConnection("sk-key", "gpt-4o-mini")
        expect(result).toEqual({ ok: true })
        expect(get).toHaveBeenCalledWith("https://api.openai.com/v1/models/gpt-4o-mini", expect.objectContaining({ timeout: 12000 }))
        expect(post).not.toHaveBeenCalled()
    })

    it("testConnection returns ok: false on 401 or 404", async () => {
        get.mockRejectedValueOnce(httpError(401, { error: { message: "Incorrect key" } }))
        let result = await openaiProvider.testConnection("sk-key", "gpt-4o-mini")
        expect(result.ok).toBe(false)

        get.mockRejectedValueOnce(httpError(404, { error: { message: "Model not found" } }))
        result = await openaiProvider.testConnection("sk-key", "gpt-nope")
        expect(result.ok).toBe(false)
    })
})

describe("Gemini Provider Connection", () => {
    it("completes a raw request setting x-goog-api-key header", async () => {
        post.mockResolvedValueOnce({
            data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "hello" }] } }] }
        } as any)

        const result = await geminiProvider.complete("g-key", "gemini-2.0-flash", { prompt: "hi", signal })
        expect(result).toBe("hello")

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent")
        expect(config.headers["x-goog-api-key"]).toBe("g-key")
        expect(config.timeout).toBe(12000)
        expect(config.signal).toBe(signal)
    })

    it("budgets gemini 2.5 thinking so the output cap is not eaten before the answer", async () => {
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }] } }] } } as any)
        await geminiProvider.complete("g-key", "gemini-2.5-flash", { prompt: "hi", signal })
        expect((post.mock.calls[0] as any[])[1].generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })

        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }] } }] } } as any)
        await geminiProvider.complete("g-key", "gemini-2.5-pro", { prompt: "hi", signal })
        expect((post.mock.calls[1] as any[])[1].generationConfig.thinkingConfig).toEqual({ thinkingBudget: 128 }) // pro's minimum

        // pre-2.5 models know no thinkingConfig - sending one would 400
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }] } }] } } as any)
        await geminiProvider.complete("g-key", "gemini-2.0-flash", { prompt: "hi", signal })
        expect((post.mock.calls[2] as any[])[1].generationConfig.thinkingConfig).toBeUndefined()

        // 3.x thinking knobs vary per model - no thinkingConfig, but a cap thinking cannot eat
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }] } }] } } as any)
        await geminiProvider.complete("g-key", "gemini-3.1-flash-lite", { prompt: "hi", signal })
        expect((post.mock.calls[3] as any[])[1].generationConfig.thinkingConfig).toBeUndefined()
        expect((post.mock.calls[3] as any[])[1].generationConfig.maxOutputTokens).toBe(4096)
    })

    it("substitutes the fallback model for an empty id", async () => {
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ok" }] } }] } } as any)
        await geminiProvider.complete("g-key", "", { prompt: "hi", signal })
        expect((post.mock.calls[0] as any[])[0]).toContain("gemini-3.1-flash-lite:generateContent")
    })

    it("names an answer-less MAX_TOKENS response instead of returning empty text", async () => {
        post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: "MAX_TOKENS" }] } } as any)
        await expect(geminiProvider.complete("g-key", "gemini-2.5-flash", { prompt: "hi", signal })).rejects.toMatchObject({ code: "bad_response" })
    })

    it("testConnection fetches the model metadata & returns ok on 200", async () => {
        get.mockResolvedValueOnce({ data: { name: "models/gemini-2.0-flash" } } as any)

        const result = await geminiProvider.testConnection("g-key", "gemini-2.0-flash")
        expect(result).toEqual({ ok: true })

        const [url, config] = get.mock.calls[0] as any[]
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash")
        expect(config.headers["x-goog-api-key"]).toBe("g-key")
    })

    it("testConnection returns ok: false on failure", async () => {
        get.mockRejectedValueOnce(httpError(400, { error: { message: "API key not valid." } }))
        const result = await geminiProvider.testConnection("g-key", "gemini-2.0-flash")
        expect(result.ok).toBe(false)
    })
})

describe("Ollama Provider Connection", () => {
    it("completes a raw local request without authorization headers", async () => {
        post.mockResolvedValueOnce({
            data: { message: { role: "assistant", content: "hello" }, done: true }
        } as any)

        const result = await ollamaProvider.complete("", "gemma3:4b", { prompt: "hi", signal })
        expect(result).toBe("hello")

        const [url, body, config] = post.mock.calls[0] as any[]
        expect(url).toBe("http://127.0.0.1:11434/api/chat")
        expect(body.model).toBe("gemma3:4b")
        expect(body.stream).toBe(false)
        expect(config.headers).toBeUndefined()
        expect(config.timeout).toBe(30000)
    })

    it("testConnection returns ok when the model exists in local tags", async () => {
        get.mockResolvedValueOnce({
            data: { models: [{ name: "gemma3:4b" }, { name: "llama3.2:latest" }] }
        } as any)

        const result = await ollamaProvider.testConnection("", "gemma3:4b")
        expect(result).toEqual({ ok: true })

        const [url, config] = get.mock.calls[0] as any[]
        expect(url).toBe("http://127.0.0.1:11434/api/tags")
        expect(config.timeout).toBe(10000)
    })

    it("testConnection returns ok: false when the model is not found", async () => {
        get.mockResolvedValueOnce({ data: { models: [{ name: "llama3.2:latest" }] } } as any)

        const result = await ollamaProvider.testConnection("", "gemma3:4b")
        expect(result.ok).toBe(false)
    })
})
