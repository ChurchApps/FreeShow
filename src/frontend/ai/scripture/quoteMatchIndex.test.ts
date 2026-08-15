import { describe, expect, it } from "vitest"

import { buildTranslationIndex, postingsForKey, prefixIdf, PrefixPool, verseTokensAt, type IndexableVerse } from "./quoteMatchIndex"
import { phoneticKey } from "./quoteMatchTokens"

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
        const tokens = Array.from(verseTokensAt(index, 0)).map((id) => index.vocab[id])
        expect(tokens.slice(0, 6)).toEqual(["for", "god", "so", "loved", "the", "world"])
    })

    it("posts each prefix key against the verses containing it", () => {
        expect(Array.from(postingsForKey(index, index.pool.lookup("bego")) || [])).toEqual([0])
        expect(Array.from(postingsForKey(index, index.pool.lookup("worl")) || [])).toEqual([0, 1])
    })

    it("drops postings for keys above the df cap but keeps their df", () => {
        // "the" appears in all 4 verses; with the 1/16 cap any key in every verse is dropped
        const theId = index.pool.lookup("the")
        expect(postingsForKey(index, theId)).toBe(null)
        expect(index.prefixDf[theId]).toBe(4)
    })

    it("gives rare tokens higher idf than common ones", () => {
        const rare = index.idfByVocabId[index.vocab.indexOf("begotten")]
        const common = index.idfByVocabId[index.vocab.indexOf("the")]
        expect(rare).toBeGreaterThan(common)
        expect(prefixIdf(index, index.pool.lookup("bego"))).toBeGreaterThan(prefixIdf(index, index.pool.lookup("the")))
    })

    it("returns nothing for keys no translation ever saw", () => {
        expect(index.pool.lookup("zzzz")).toBe(-1)
        expect(postingsForKey(index, -1)).toBe(null)
        expect(prefixIdf(index, -1)).toBe(0)
    })
})

describe("shared PrefixPool", () => {
    it("gives every translation the same id space & isolates their postings", () => {
        const pool = new PrefixPool()
        const first = buildTranslationIndex("a", VERSES, pool)
        const second = buildTranslationIndex("b", [verse(1, 1, 1, "In the beginning God created the heaven and the earth")], pool)

        expect(first.pool).toBe(second.pool)

        // a key only the second translation contains: the first index reads df 0 / no postings for it
        const beginningId = pool.lookup("begi")
        expect(beginningId).toBeGreaterThanOrEqual(0)
        expect(postingsForKey(second, beginningId)).not.toBe(null)
        expect(postingsForKey(first, beginningId)).toBe(null)
        expect(prefixIdf(first, beginningId)).toBe(0)

        // a key from the first translation resolves to the same id for both
        expect(Array.from(postingsForKey(first, pool.lookup("bego")) || [])).toEqual([0])
    })

    it("reports a compact size for a built index", () => {
        const index = buildTranslationIndex("kjv", VERSES)
        expect(index.sizeBytes).toBeGreaterThan(0)
        expect(index.sizeBytes).toBeLessThan(100_000) // 4 verses must stay tiny
    })
})

describe("phonetic postings", () => {
    // "therefore" saturates every verse (non-informative); "amalekites" is informative and long
    const CORPUS: IndexableVerse[] = [
        verse(9, 15, 18, "Therefore go and utterly destroy the sinners the Amalekites and fight against them"),
        verse(9, 15, 19, "Therefore wherefore then didst thou not obey the voice of the LORD"),
        verse(9, 15, 20, "Therefore Saul said I have obeyed the voice of the LORD"),
        verse(19, 23, 1, "Therefore the LORD is my shepherd I shall not want"),
        verse(19, 23, 2, "Therefore he maketh me to lie down in green pastures"),
        verse(43, 3, 16, "Therefore God so loved the world that he gave his only begotten Son"),
        verse(43, 3, 17, "Therefore God sent not his Son into the world to condemn the world"),
        verse(1, 1, 1, "Therefore in the beginning God created the heaven and the earth")
    ]
    const index = buildTranslationIndex("kjv", CORPUS)

    it("posts an informative token's phonetic skeleton against its verses", () => {
        const key = phoneticKey("amalekites")!
        const id = index.pool.lookup("~" + key)
        expect(id).toBeGreaterThanOrEqual(0)
        expect(Array.from(postingsForKey(index, id) || [])).toEqual([0])
    })

    it("resolves a misheard name to the same postings", () => {
        expect(phoneticKey("analekite")).toBe(phoneticKey("amalekites"))
    })

    it("creates no phonetic route for non-informative tokens, however long", () => {
        expect(index.idfByVocabId[index.vocab.indexOf("therefore")]).toBeLessThan(index.informativeIdf)
        expect(index.pool.lookup("~" + phoneticKey("therefore")!)).toBe(-1)
    })

    it("gives phonetic keys a real idf for voting weight", () => {
        const id = index.pool.lookup("~" + phoneticKey("amalekites")!)
        expect(prefixIdf(index, id)).toBeGreaterThan(0)
    })
})
