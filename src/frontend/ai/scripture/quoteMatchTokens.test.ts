import { describe, expect, it } from "vitest"

import { canonKey, NUMBER_PLACEHOLDER, phoneticKey, tokenGrade, tokenizeTranscript, tokenizeVerseText } from "./quoteMatchTokens"

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

describe("phoneticKey", () => {
    it("keys an ASR-mangled name together with the real one", () => {
        expect(phoneticKey("analekite")).toBe(phoneticKey("amalekites"))
        expect(phoneticKey("jehosaphat")).toBe(phoneticKey("jehoshaphat"))
        expect(phoneticKey("mefibosheth")).toBe(phoneticKey("mephibosheth"))
    })

    it("keys cross-translation spelling variants together", () => {
        expect(phoneticKey("melchizedek")).toBe(phoneticKey("melchisedec"))
        expect(phoneticKey("nethaneel")).toBe(phoneticKey("nethanel"))
    })

    it("returns null for short tokens - they must never phonetic-merge", () => {
        expect(phoneticKey("thy")).toBe(null)
        expect(phoneticKey("thigh")).toBe(null)
        expect(phoneticKey("wast")).toBe(null)
    })

    it("returns null for vowel-heavy tokens whose skeleton carries no signal", () => {
        expect(phoneticKey("easier")).toBe(null)
    })

    it("separates words that merely share letters", () => {
        expect(phoneticKey("believe")).not.toBe(phoneticKey("beloved"))
        expect(phoneticKey("kingdom")).not.toBe(phoneticKey("kindred"))
    })
})

describe("tokenGrade phonetic path", () => {
    it("grades a same-skeleton pair 0.7 only when the caller allows it", () => {
        expect(tokenGrade("analekite", "amalekites", true)).toBe(0.7)
        expect(tokenGrade("analekite", "amalekites")).toBe(0)
        expect(tokenGrade("analekite", "amalekites", false)).toBe(0)
    })

    it("rejects pairs with too different lengths even when the skeletons agree", () => {
        // synthetic pair: same skeleton, no shared prefix, 8-char length gap
        expect(phoneticKey("unalekite")).toBe(phoneticKey("annaalleekkiittee"))
        expect(tokenGrade("unalekite", "annaalleekkiittee", true)).toBe(0)
    })

    it("never phonetic-merges short tokens", () => {
        expect(tokenGrade("thigh", "thy", true)).toBe(0)
    })

    it("prefers the prefix grades when both would apply", () => {
        expect(tokenGrade("believe", "believeth", true)).toBe(0.9)
    })
})
