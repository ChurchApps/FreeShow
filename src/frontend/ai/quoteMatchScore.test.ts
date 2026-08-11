import { describe, expect, it } from "vitest"

import { buildTranslationIndex, type IndexableVerse } from "./quoteMatchIndex"
import { alignQuoteWindow, classify, meetsFloors, type QueryToken } from "./quoteMatchScore"
import { tokenizeTranscript } from "./quoteMatchTokens"

function verse(book: number, chapter: number, number: number, text: string): IndexableVerse {
    return { book, chapter, verseStart: number, verseEnd: number, cleanText: text }
}

// small KJV corpus (public domain) - enough verses that idf separates rare words from common ones
const CORPUS: IndexableVerse[] = [
    verse(43, 3, 16, "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."),
    verse(43, 3, 17, "For God sent not his Son into the world to condemn the world; but that the world through him might be saved."),
    verse(43, 3, 18, "He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God."),
    verse(19, 23, 1, "The LORD is my shepherd; I shall not want."),
    verse(19, 23, 2, "He maketh me to lie down in green pastures: he leadeth me beside the still waters."),
    verse(45, 8, 28, "And we know that all things work together for good to them that love God, to them that are the called according to his purpose."),
    verse(40, 9, 6, "But that ye may know that the Son of man hath power on earth to forgive sins, (then saith he to the sick of the palsy,) Arise, take up thy bed, and go unto thine house."),
    verse(41, 2, 11, "I say unto thee, Arise, and take up thy bed, and go thy way into thine house."),
    verse(43, 6, 9, "There is a lad here, which hath five barley loaves, and two small fishes: but what are they among so many?"),
    verse(1, 1, 1, "In the beginning God created the heaven and the earth."),
    verse(50, 4, 13, "I can do all things through Christ which strengtheneth me."),
    verse(43, 14, 6, "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.")
]

const INDEX = buildTranslationIndex("kjv", CORPUS)

function query(text: string): QueryToken[] {
    return tokenizeTranscript(text).map((token) => ({ token, endMs: 0 }))
}

describe("alignQuoteWindow", () => {
    it("scores a clean full recitation high", () => {
        const a = alignQuoteWindow(query("for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life"), INDEX, 0)!
        expect(a.score).toBeGreaterThan(0.8)
        expect(classify(a)).toBe("high")
    })

    it("survives ASR truncations and substitutions (requirement a)", () => {
        const a = alignQuoteWindow(query("for god so loved the world that he gave his only forgotten son that whosoever believe in him should not perish"), INDEX, 0)!
        expect(classify(a)).toBe("high")
    })

    it("survives dropped and misheard words", () => {
        const a = alignQuoteWindow(query("god so loved the worl he gave his only begotten sun so whoever believes in him will not perish but have everlasting life"), INDEX, 0)!
        expect(classify(a)).not.toBeNull()
    })

    it("matches Psalm 23:1 with a homophone", () => {
        const a = alignQuoteWindow(query("the lord is my shepherd i shall not want"), INDEX, 3)!
        expect(classify(a)).not.toBeNull()
    })

    it("matches a mid-verse start without punishment (requirement b)", () => {
        const a = alignQuoteWindow(query("that whosoever believeth in him should not perish but have everlasting life"), INDEX, 0)!
        expect(a.coverage).toBeGreaterThan(0.8)
        expect(classify(a)).toBe("high")
    })

    it("follows a recitation across the verse boundary via spill", () => {
        const a = alignQuoteWindow(query("should not perish but have everlasting life for god sent not his son into the world to condemn the world"), INDEX, 0)!
        expect(a.spillInformative).toBeGreaterThanOrEqual(2)
    })

    it("rejects a 4-word coincidence (requirement c)", () => {
        const a = alignQuoteWindow(query("for god so loved you this morning church"), INDEX, 0)
        expect(a === null || !meetsFloors(a)).toBe(true)
    })

    it("rejects scattered common-word overlap", () => {
        const a = alignQuoteWindow(query("we know that god is good and all things are possible for them that love the church"), INDEX, 5)
        expect(a === null || classify(a) !== "high").toBe(true)
    })

    it("rejects a run of function words", () => {
        const a = alignQuoteWindow(query("and he said unto them that they should"), INDEX, 0)
        expect(a === null || !meetsFloors(a)).toBe(true)
    })

    it("matches spoken quantities against written numbers", () => {
        const a = alignQuoteWindow(query("a lad here which hath 5 barley loaves and 2 small fishes"), INDEX, 8)!
        expect(classify(a)).not.toBeNull()
    })

    it("keeps the reference announcement outside the matched span", () => {
        const withPreamble = alignQuoteWindow(query("john chapter 3 verse 16 for god so loved the world that he gave his only begotten son"), INDEX, 0)!
        const without = alignQuoteWindow(query("for god so loved the world that he gave his only begotten son"), INDEX, 0)!
        expect(Math.abs(withPreamble.score - without.score)).toBeLessThan(0.08)
    })
})
