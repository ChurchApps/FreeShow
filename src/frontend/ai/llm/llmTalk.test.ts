import { describe, it, expect, vi, beforeEach } from "vitest"
import { LLMTalk, createLLMTalk, LLMErrorHandler } from "./llmTalk"
import { requestMain } from "../../IPC/main"

vi.mock("../../IPC/main")

describe("LLMTalk", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("complete()", () => {
        it("returns text response on success", async () => {
            vi.mocked(requestMain).mockResolvedValue({
                text: "Paris is the capital of France"
            })

            const llm = createLLMTalk("openai", "gpt-4o")
            const response = await llm.complete({
                systemPrompt: "You are a helpful assistant.",
                prompt: "What is the capital of France?"
            })

            expect(response.text).toBe("Paris is the capital of France")
            expect(response.error).toBeUndefined()
        })

        it("throws error when backend returns error", async () => {
            vi.mocked(requestMain).mockResolvedValue({
                text: "",
                error: "Invalid API key"
            })

            const llm = createLLMTalk("openai", "gpt-4o")

            await expect(llm.complete({ prompt: "test" })).rejects.toThrow("Invalid API key")
        })

        it("throws error when IPC request times out", async () => {
            vi.mocked(requestMain).mockResolvedValue(null)

            const llm = createLLMTalk("openai", "gpt-4o")

            await expect(llm.complete({ prompt: "test" })).rejects.toThrow("IPC request timed out")
        })
    })

    describe("completeJson()", () => {
        it("parses JSON response and applies parser function", async () => {
            const jsonResponse = {
                entities: [
                    { name: "John", type: "person" },
                    { name: "Paris", type: "place" }
                ],
                sentiment: "positive"
            }

            vi.mocked(requestMain).mockResolvedValue({
                text: JSON.stringify(jsonResponse)
            })

            const llm = createLLMTalk("anthropic", "claude-opus-5")

            interface ExtractionResult {
                entities: Array<{ name: string; type: string }>
                sentiment: "positive" | "negative" | "neutral"
            }

            const response = await llm.completeJson<ExtractionResult>(
                {
                    prompt: "Extract entities",
                    jsonSchema: { type: "object" }
                },
                (json) => json as ExtractionResult
            )

            expect(response.parsed?.entities).toHaveLength(2)
            expect(response.parsed?.sentiment).toBe("positive")
        })

        it("returns error when JSON parsing fails", async () => {
            vi.mocked(requestMain).mockResolvedValue({
                text: "not valid json"
            })

            const llm = createLLMTalk("anthropic", "claude-opus-5")

            const response = await llm.completeJson({
                prompt: "test",
                jsonSchema: {}
            })

            expect(response.error).toContain("Failed to parse JSON response")
        })

        it("throws error when jsonSchema is missing", async () => {
            const llm = createLLMTalk("anthropic", "claude-opus-5")

            await expect(llm.completeJson({ prompt: "test" })).rejects.toThrow("jsonSchema is required")
        })
    })

    describe("setConfig() and getConfig()", () => {
        it("updates provider configuration", () => {
            const llm = new LLMTalk({ providerId: "openai", model: "gpt-4o" })

            expect(llm.getConfig()).toEqual({
                providerId: "openai",
                model: "gpt-4o"
            })

            llm.setConfig({ providerId: "anthropic" })

            expect(llm.getConfig()).toEqual({
                providerId: "anthropic",
                model: "gpt-4o"
            })
        })

        it("allows partial config updates", () => {
            const llm = new LLMTalk({ providerId: "openai", model: "gpt-4o" })

            llm.setConfig({ model: "gpt-4o-mini" })

            expect(llm.getConfig()).toEqual({
                providerId: "openai",
                model: "gpt-4o-mini"
            })
        })
    })

    describe("request cancellation with AbortSignal", () => {
        it("throws error when signal is aborted", async () => {
            const controller = new AbortController()
            const llm = createLLMTalk("openai", "gpt-4o")

            controller.abort()

            await expect(llm.complete({ prompt: "test" }, controller.signal)).rejects.toThrow("Request aborted")
        })

        it("respects abort after IPC response", async () => {
            const controller = new AbortController()

            vi.mocked(requestMain).mockImplementation(async () => {
                controller.abort()
                return { text: "delayed response" }
            })

            const llm = createLLMTalk("openai", "gpt-4o")

            await expect(llm.complete({ prompt: "test" }, controller.signal)).rejects.toThrow("Request aborted")
        })
    })

    describe("createLLMTalk() factory", () => {
        it("creates instance with correct config", () => {
            const llm = createLLMTalk("gemini", "gemini-3.5-flash")

            expect(llm.getConfig()).toEqual({
                providerId: "gemini",
                model: "gemini-3.5-flash"
            })
        })
    })
})

describe("LLMErrorHandler", () => {
    describe("isRetryable()", () => {
        it("identifies rate limit errors as retryable", () => {
            const error = new Error("Rate limit exceeded - please retry in 30s")
            expect(LLMErrorHandler.isRetryable(error)).toBe(true)
        })

        it("identifies timeout errors as retryable", () => {
            const error = new Error("Request timed out")
            expect(LLMErrorHandler.isRetryable(error)).toBe(true)
        })

        it("identifies network errors as retryable", () => {
            const error = new Error("Network connection failed")
            expect(LLMErrorHandler.isRetryable(error)).toBe(true)
        })

        it("identifies server errors as retryable", () => {
            const error = new Error("Server error - try again later")
            expect(LLMErrorHandler.isRetryable(error)).toBe(true)
        })

        it("identifies ollama errors as retryable", () => {
            const error = new Error("Ollama is not running")
            expect(LLMErrorHandler.isRetryable(error)).toBe(true)
        })

        it("identifies non-retryable errors correctly", () => {
            const error = new Error("Invalid API key")
            expect(LLMErrorHandler.isRetryable(error)).toBe(false)
        })
    })

    describe("isPermanent()", () => {
        it("identifies invalid key as permanent", () => {
            const error = new Error("Invalid API key")
            expect(LLMErrorHandler.isPermanent(error)).toBe(true)
        })

        it("identifies access denied as permanent", () => {
            const error = new Error("Access forbidden")
            expect(LLMErrorHandler.isPermanent(error)).toBe(true)
        })

        it("identifies model not found as permanent", () => {
            const error = new Error("Model not found")
            expect(LLMErrorHandler.isPermanent(error)).toBe(true)
        })

        it("identifies refusal as permanent", () => {
            const error = new Error("AI refused to answer")
            expect(LLMErrorHandler.isPermanent(error)).toBe(true)
        })

        it("identifies retryable errors as non-permanent", () => {
            const error = new Error("Timeout")
            expect(LLMErrorHandler.isPermanent(error)).toBe(false)
        })
    })
})

describe("Integration scenarios", () => {
    it("retries on retryable errors", async () => {
        let attempts = 0

        vi.mocked(requestMain).mockImplementation(async () => {
            attempts++
            if (attempts < 3) {
                return { text: "", error: "Rate limit exceeded" }
            }
            return { text: "Success" }
        })

        const llm = createLLMTalk("openai", "gpt-4o")
        let retries = 0

        for (let i = 0; i < 5; i++) {
            try {
                const response = await llm.complete({ prompt: "test" })
                expect(response.text).toBe("Success")
                break
            } catch (error: any) {
                if (LLMErrorHandler.isRetryable(error)) {
                    retries++
                    vi.useFakeTimers()
                    await new Promise((resolve) => setTimeout(resolve, 100))
                    vi.useRealTimers()
                }
            }
        }

        expect(retries).toBe(2)
    })

    it("fails fast on permanent errors", async () => {
        vi.mocked(requestMain).mockResolvedValue({
            text: "",
            error: "Invalid API key"
        })

        const llm = createLLMTalk("openai", "gpt-4o")

        try {
            await llm.complete({ prompt: "test" })
            expect.fail("Should have thrown")
        } catch (error: any) {
            expect(LLMErrorHandler.isPermanent(error)).toBe(true)
            expect(error.message).toContain("Invalid API")
        }
    })

    it("handles provider switching", async () => {
        vi.mocked(requestMain).mockResolvedValue({ text: "response" })

        const llm = new LLMTalk({ providerId: "openai", model: "gpt-4o" })

        await llm.complete({ prompt: "first" })
        expect(vi.mocked(requestMain).mock.calls[0][1].providerId).toBe("openai")

        llm.setConfig({ providerId: "anthropic", model: "claude-opus-5" })

        await llm.complete({ prompt: "second" })
        expect(vi.mocked(requestMain).mock.calls[1][1].providerId).toBe("anthropic")
    })

    it("parses complex JSON with custom parser", async () => {
        interface Summary {
            title: string
            keyPoints: string[]
            readTime: number
        }

        vi.mocked(requestMain).mockResolvedValue({
            text: JSON.stringify({
                title: "Understanding AI",
                keyPoints: ["ML", "DL", "NLP"],
                readTime: 5.5
            })
        })

        const llm = createLLMTalk("openai", "gpt-4o")

        const response = await llm.completeJson<Summary>(
            {
                prompt: "summarize",
                jsonSchema: {}
            },
            (json) => ({
                title: json.title || "Untitled",
                keyPoints: Array.isArray(json.keyPoints) ? json.keyPoints : [],
                readTime: Math.max(1, Math.round(json.readTime || 0))
            })
        )

        expect(response.parsed?.title).toBe("Understanding AI")
        expect(response.parsed?.keyPoints).toEqual(["ML", "DL", "NLP"])
        expect(response.parsed?.readTime).toBe(6)
    })
})
