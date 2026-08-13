import axios from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type AIDetectionRequest, DETECTION_SCHEMA, getLLMScriptureProvider, type RawDetection } from "./llmTalkScripture"

vi.mock("axios", () => ({
    default: { post: vi.fn(), get: vi.fn() }
}))

const post = vi.mocked(axios.post)

const signal = new AbortController().signal
const request: AIDetectionRequest = { transcript: "turn with me to John chapter 3 verse 16", alreadyDetected: ["Romans 8:28"] }
const detection: RawDetection = { book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high", type: "explicit" }

beforeEach(() => {
    post.mockReset()
})

describe("getProvider abstraction", () => {
    it("returns the matching detection provider instance for each ID", () => {
        expect(getLLMScriptureProvider("anthropic").id).toBe("anthropic")
        expect(getLLMScriptureProvider("openai").id).toBe("openai")
        expect(getLLMScriptureProvider("gemini").id).toBe("gemini")
        expect(getLLMScriptureProvider("ollama").id).toBe("ollama")
    })

    it("falls back to the default fallback model when model is an empty string", async () => {
        post.mockResolvedValueOnce({ data: { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ references: [] }) }] } } as any)
        await getLLMScriptureProvider("anthropic").detectScripture("sk-key", "", request, signal)

        expect((post.mock.calls[0][1] as any).model).toBe("claude-haiku-4-5")
    })

    it("uses explicitly configured model when provided", async () => {
        post.mockResolvedValueOnce({ data: { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ references: [] }) }] } } as any)
        await getLLMScriptureProvider("anthropic").detectScripture("sk-key", "claude-opus-5", request, signal)

        expect((post.mock.calls[0][1] as any).model).toBe("claude-opus-5")
    })
})

describe("Scripture Detection across LLM Providers", () => {
    it("detects scriptures via Anthropic JSON Schema output format", async () => {
        post.mockResolvedValueOnce({
            data: {
                stop_reason: "end_turn",
                content: [{ type: "text", text: JSON.stringify({ references: [{ ...detection, quote: "" }] }) }]
            }
        } as any)

        const result = await getLLMScriptureProvider("anthropic").detectScripture("sk-key", "claude-haiku-4-5", request, signal)
        expect(result.references).toEqual([detection])

        const body = post.mock.calls[0][1] as any
        expect(body.output_config.format.type).toBe("json_schema")
        expect(body.messages[0].content).toContain("Romans 8:28")
        expect(body.messages[0].content).toContain(request.transcript)
    })

    it("reads text block content from Anthropic even when preceded by extended thinking blocks", async () => {
        post.mockResolvedValueOnce({
            data: {
                stop_reason: "end_turn",
                content: [
                    { type: "thinking", thinking: "analyzing biblical context..." },
                    { type: "text", text: JSON.stringify({ references: [detection] }) }
                ]
            }
        } as any)

        const result = await getLLMScriptureProvider("anthropic").detectScripture("sk-key", "claude-opus-5", request, signal)
        expect(result.references).toEqual([detection])
    })

    it("detects scriptures via OpenAI structured outputs", async () => {
        post.mockResolvedValueOnce({
            data: { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ references: [detection] }), refusal: null } }] }
        } as any)

        const result = await getLLMScriptureProvider("openai").detectScripture("sk-key", "gpt-4o-mini", request, signal)
        expect(result.references).toEqual([detection])

        const body = post.mock.calls[0][1] as any
        expect(body.response_format.json_schema.strict).toBe(true)
        expect(body.response_format.json_schema.name).toBe("response_schema")
    })

    it("detects scriptures via Gemini schema output", async () => {
        post.mockResolvedValueOnce({
            data: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ references: [detection] }) }] } }] }
        } as any)

        const result = await getLLMScriptureProvider("gemini").detectScripture("g-key", "gemini-2.0-flash", request, signal)
        expect(result.references).toEqual([detection])

        const body = post.mock.calls[0][1] as any
        expect(body.generationConfig.responseMimeType).toBe("application/json")
        // Verifies additionalProperties was stripped out to meet Gemini constraints
        expect(JSON.stringify(body.generationConfig.responseSchema)).not.toContain("additionalProperties")
    })

    it("detects scriptures via Ollama schema format", async () => {
        post.mockResolvedValueOnce({
            data: { message: { role: "assistant", content: JSON.stringify({ references: [detection] }) }, done: true }
        } as any)

        const result = await getLLMScriptureProvider("ollama").detectScripture("", "gemma3:4b", request, signal)
        expect(result.references).toEqual([detection])

        const body = post.mock.calls[0][1] as any
        expect(body.format).toEqual(DETECTION_SCHEMA)
    })
})

describe("Scripture Validation & Parsing Rules", () => {
    it("filters out detection records with invalid types or out-of-bound book numbers", async () => {
        const invalidBook = { ...detection, bookNumber: 99 }
        const invalidVerse = { ...detection, verseStart: "16" }
        const bogusEntry = { book: "Nowhere" }

        post.mockResolvedValueOnce({
            data: {
                stop_reason: "end_turn",
                content: [{ type: "text", text: JSON.stringify({ references: [detection, invalidBook, invalidVerse, bogusEntry] }) }]
            }
        } as any)

        const result = await getLLMScriptureProvider("anthropic").detectScripture("sk-key", "claude-haiku-4-5", request, signal)
        expect(result.references).toEqual([detection])
    })

    it("throws an explicit error when LLM output is not valid JSON", async () => {
        post.mockResolvedValueOnce({
            data: { stop_reason: "end_turn", content: [{ type: "text", text: "Invalid raw string response {" }] }
        } as any)

        await expect(getLLMScriptureProvider("anthropic").detectScripture("sk-key", "claude-haiku-4-5", request, signal)).rejects.toThrow("Response is not valid JSON")
    })
})
