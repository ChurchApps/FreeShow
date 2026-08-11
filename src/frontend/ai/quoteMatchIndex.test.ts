import { describe, expect, it } from "vitest"

import { buildTranslationIndex, prefixIdf, type IndexableVerse } from "./quoteMatchIndex"

function verse(book: number, chapter: number, number: number, text: string, endNumber?: number): IndexableVerse {
    return { book, chapter, verseStart: number, verseEnd: endNumber ?? number, cleanText: text }
}

const VERSES: IndexableVerse[] = [
    verse(43, 3, 16, "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."),
    verse(43, 3, 17, "For God sent not his Son into the world to condemn the world; but that the world through him might be saved."),
    verse(43, 4, 1, "When therefore the Lord knew how the Pharisees had heard that Jesus made and baptized more disciples than John,"),
    verse(45, 8, 28, "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.")
]

describe("buildTranslationIndex", () => {
    const index = buildTranslationIndex("kjv", VERSES)

    it("packs per-ordinal metadata in traversal order", () => {
        expect(index.verseCount).toBe(4)
        expect(Array.from(index.book)).toEqual([43, 43, 43, 45])
        expect(Array.from(index.chapter)).toEqual([3, 3, 4, 8])
        expect(Array.from(index.verseStart)).toEqual([16, 17, 1, 28])
    })

    it("marks chapter starts", () => {
        expect(Array.from(index.chapterBreak)).toEqual([1, 0, 1, 1])
    })

    it("respects merged-verse end numbers", () => {
        const merged = buildTranslationIndex("x", [verse(1, 1, 1, "In the beginning", 2)])
        expect(merged.verseEnd[0]).toBe(2)
    })

    it("stores per-verse token sequences resolvable through the vocab", () => {
        const tokens = Array.from(index.verseTokens[0]).map((id) => index.vocab[id])
        expect(tokens.slice(0, 6)).toEqual(["for", "god", "so", "loved", "the", "world"])
    })

    it("posts each prefix key against the verses containing it", () => {
        expect(Array.from(index.postings.get("bego") || [])).toEqual([0])
        expect(Array.from(index.postings.get("worl") || [])).toEqual([0, 1])
    })

    it("drops postings for keys above the df cap but keeps their df", () => {
        // "the" appears in all 4 verses; with the 1/16 cap any key in every verse is dropped
        expect(index.postings.has("the")).toBe(false)
        expect(index.prefixDf.get("the")).toBe(4)
    })

    it("gives rare tokens higher idf than common ones", () => {
        const rare = index.idfByVocabId[index.vocabIdByToken.get("begotten")!]
        const common = index.idfByVocabId[index.vocabIdByToken.get("the")!]
        expect(rare).toBeGreaterThan(common)
        expect(prefixIdf(index, "bego")).toBeGreaterThan(prefixIdf(index, "the"))
    })

    it("buckets vocab ids by shared prefix for compatibility lookup", () => {
        const bucket = (index.prefixBuckets.get("worl") || []).map((id) => index.vocab[id])
        expect(bucket).toContain("world")
    })
})
