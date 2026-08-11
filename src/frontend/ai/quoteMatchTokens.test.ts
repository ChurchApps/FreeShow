import { describe, expect, it } from "vitest"

import { canonKey, NUMBER_PLACEHOLDER, tokenGrade, tokenizeTranscript, tokenizeVerseText } from "./quoteMatchTokens"

describe("tokenizeVerseText", () => {
    it("lowercases, strips punctuation and folds apostrophes", () => {
        expect(tokenizeVerseText("For God so loved the world,")).toEqual(["for", "god", "so", "loved", "the", "world"])
        expect(tokenizeVerseText("my Father's house")).toEqual(["my", "fathers", "house"])
    })

    it("drops single-character tokens", () => {
        expect(tokenizeVerseText("I am a lad")).toEqual(["am", "lad"])
    })
})

describe("tokenizeTranscript", () => {
    it("spells out small numbers so spoken quantities match written verse text", () => {
        expect(tokenizeTranscript("5 barley loaves and 2 small fishes")).toEqual(["five", "barley", "loaves", "and", "two", "small", "fishes"])
        expect(tokenizeTranscript("verse 16")).toEqual(["verse", "sixteen"])
        expect(tokenizeTranscript("chapter 21")).toEqual(["chapter", "twenty", "one"])
    })

    it("turns large numbers into a non-matching placeholder that keeps its position", () => {
        expect(tokenizeTranscript("psalm 119 says")).toEqual(["psalm", NUMBER_PLACEHOLDER, "says"])
    })
})

describe("canonKey", () => {
    it("merges truncations and inflections onto one key", () => {
        expect(canonKey("love")).toBe("love")
        expect(canonKey("loved")).toBe("love")
        expect(canonKey("loveth")).toBe("love")
        expect(canonKey("verse")).toBe("vers")
        expect(canonKey("vers")).toBe("vers")
        expect(canonKey("matthew")).toBe("matt")
        expect(canonKey("matter")).toBe("matt")
    })

    it("keeps short tokens whole", () => {
        expect(canonKey("god")).toBe("god")
        expect(canonKey("so")).toBe("so")
    })
})

describe("tokenGrade", () => {
    it("grades exact matches 1", () => {
        expect(tokenGrade("world", "world")).toBe(1)
    })

    it("grades truncations and inflections 0.9", () => {
        expect(tokenGrade("vers", "verse")).toBe(0.9)
        expect(tokenGrade("believe", "believeth")).toBe(0.9)
        expect(tokenGrade("everlasting", "ever")).toBe(0.9)
    })

    it("grades same-prefix substitutions 0.75", () => {
        expect(tokenGrade("matter", "matthew")).toBe(0.75)
        expect(tokenGrade("loved", "loveth")).toBe(0.75)
    })

    it("rejects incompatible tokens", () => {
        expect(tokenGrade("world", "worship")).toBe(0)
        expect(tokenGrade("god", "good")).toBe(0)
        expect(tokenGrade("the", "them")).toBe(0) // short tokens must match exactly
    })

    it("never matches the number placeholder", () => {
        expect(tokenGrade(NUMBER_PLACEHOLDER, NUMBER_PLACEHOLDER)).toBe(0)
        expect(tokenGrade(NUMBER_PLACEHOLDER, "hundred")).toBe(0)
    })
})
