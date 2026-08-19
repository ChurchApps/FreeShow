import { describe, expect, it } from "vitest"

import { canonKey, confusableAlternates, NUMBER_PLACEHOLDER, phoneticKey, tokenGrade, tokenizeTranscript, tokenizeVerseText } from "./quoteMatchTokens"

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
        expect(tokenGrade("world", "worship")).toBe(0) // shared 3 letters but neither IS the stem
        expect(tokenGrade("god", "good")).toBe(0)
        // "the"/"thee" fold under the short-stem rule (whisper writes "the" for spoken "thee") -
        // their idf is near zero, so the grade carries almost no weight either way
        expect(tokenGrade("the", "thee")).toBe(0.8)
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

describe("archaic short stems", () => {
    it("grades a dropped KJV ending: 'has'/'hast', 'was'/'wast'", () => {
        expect(tokenGrade("has", "hast")).toBe(0.8)
        expect(tokenGrade("was", "wast")).toBe(0.8)
        expect(tokenGrade("didst", "did")).toBe(0.8) // symmetric
    })

    it("stays below the phrase-peak grade and rejects short/distant pairs", () => {
        expect(tokenGrade("has", "hast")).toBeLessThan(0.9)
        expect(tokenGrade("no", "not")).toBe(0) // two shared letters is nothing
        expect(tokenGrade("has", "hasten")).toBe(0) // tail too long
    })
})

describe("ASR-confusable lexicon", () => {
    it("grades curated sound-alikes at 0.85 - only against informative verse tokens", () => {
        expect(tokenGrade("season", "ceasing", true)).toBe(0.85)
        expect(tokenGrade("altar", "alter", true)).toBe(0.85)
        expect(tokenGrade("prophet", "profit", true)).toBe(0.85)
        expect(tokenGrade("psalm", "palm", true)).toBe(0.85)
        expect(tokenGrade("junior", "junia", true)).toBe(0.85) // Romans 16:7, heard live
        // the informative gate: common verse tokens never lexicon-merge
        expect(tokenGrade("season", "ceasing", false)).toBe(0)
    })

    it("stays below the prefix grade so a sound-alike is never a run's peak", () => {
        expect(tokenGrade("season", "ceasing", true)).toBeLessThan(0.9)
    })

    it("lists a token's alternates for the candidate vote", () => {
        expect(confusableAlternates("season").sort()).toEqual(["ceasing", "seasons"])
        expect(confusableAlternates("ceasing").sort()).toEqual(["season", "seasons"])
        expect(confusableAlternates("banana")).toEqual([])
    })
})

describe("diacritic folding", () => {
    it("both sides normalize identically", () => {
        expect(tokenizeVerseText("Señor está aquí")).toEqual(tokenizeVerseText("Senor esta aqui"))
    })
})
