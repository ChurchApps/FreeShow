import { describe, expect, it } from "vitest"
import { type AIDetectionRequest, buildUserContent, parseDetectionResponse } from "./llmTalkScripture"

const request: AIDetectionRequest = { transcript: "turn with me to John chapter 3 verse 16", alreadyDetected: ["Romans 8:28"] }

describe("Scripture LLM Request & Response Parsing", () => {
    it("builds user content with already detected and transcript", () => {
        const content = buildUserContent(request)
        expect(content).toContain("Already detected (do not repeat): Romans 8:28")
        expect(content).toContain(request.transcript)
    })

    it("parses valid detection response JSON", () => {
        const rawJson = JSON.stringify({
            references: [
                {
                    book: "John",
                    bookNumber: 43,
                    chapter: 3,
                    verseStart: 16,
                    verseEnd: 16,
                    confidence: 90,
                    type: "explicit",
                    quote: "For God so loved the world"
                }
            ]
        })

        const parsed = parseDetectionResponse(rawJson)
        expect(parsed).toHaveLength(1)
        expect(parsed[0].book).toBe("John")
        expect(parsed[0].chapter).toBe(3)
        expect(parsed[0].verseStart).toBe(16)
        expect(parsed[0].quote).toBe("For God so loved the world")
    })

    it("handles invalid responses gracefully", () => {
        expect(() => parseDetectionResponse("not json")).toThrow("Response is not valid JSON")
        expect(() => parseDetectionResponse(JSON.stringify({}))).toThrow("Response is missing the references array")
    })
})
