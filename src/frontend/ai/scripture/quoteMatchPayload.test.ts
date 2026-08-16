import { describe, expect, it } from "vitest"

import { buildTranslationIndex, type IndexableVerse } from "./quoteMatchIndex"
import { buildIndexesFromPayloads, buildTranslationPayload, payloadTransferables } from "./quoteMatchPayload"
import { QuoteMatcher } from "./quoteMatcher"

const BIBLE = {
    books: [
        {
            number: 43,
            chapters: [
                {
                    number: 3,
                    verses: [
                        { number: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
                        { number: 17, text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved." }
                    ]
                }
            ]
        },
        { number: 45, chapters: [{ number: 8, verses: [{ number: 28, text: "And we know that all things work together for good to them that love God, to them that are the called according to his purpose." }] }] }
    ]
}

describe("quote match payloads", () => {
    it("packs a bible and rebuilds the exact same index on the far side", async () => {
        const payload = buildTranslationPayload("kjv", BIBLE)!
        expect(payload).not.toBeNull()

        const { indexes, totalBytes } = await buildIndexesFromPayloads([payload])
        expect(indexes).toHaveLength(1)
        expect(totalBytes).toBeGreaterThan(0)

        const direct = buildTranslationIndex(
            "kjv",
            BIBLE.books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.verses.map((verse): IndexableVerse => ({ book: book.number, chapter: chapter.number, verseStart: verse.number, verseEnd: verse.number, cleanText: verse.text }))))
        )

        expect(indexes[0].verseCount).toBe(direct.verseCount)
        expect(Array.from(indexes[0].book)).toEqual(Array.from(direct.book))
        expect(indexes[0].vocab).toEqual(direct.vocab)
        expect(indexes[0].sizeBytes).toBe(direct.sizeBytes)
    })

    it("a matcher over payload-built indexes detects a recitation", async () => {
        const payload = buildTranslationPayload("kjv", BIBLE)!
        const { indexes } = await buildIndexesFromPayloads([payload])
        const matcher = new QuoteMatcher(indexes)

        const out = matcher.onSegment({ text: "for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life", startMs: 0, endMs: 4000 })
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16, translationId: "kjv" })
    })

    it("strips verse markdown before tokenizing", async () => {
        const marked = { books: [{ number: 1, chapters: [{ number: 1, verses: [{ number: 1, text: "In the **beginning** God created the ==heaven== and the earth." }] }] }] }
        const { indexes } = await buildIndexesFromPayloads([buildTranslationPayload("x", marked)!])
        expect(indexes[0].vocab).toContain("beginning")
        expect(indexes[0].vocab).toContain("heaven")
        expect(indexes[0].vocab.some((token) => token.includes("*") || token.includes("="))).toBe(false)
    })

    it("returns null for a bible with no verses & lists every transferable buffer", () => {
        expect(buildTranslationPayload("empty", { books: [] })).toBeNull()

        const payload = buildTranslationPayload("kjv", BIBLE)!
        expect(payloadTransferables([payload])).toHaveLength(5)
    })
})
