import { describe, it, expect } from "vitest"
import { transposeText } from "./chordTranspose"

describe("transposeText (chord transposition)", () => {
    describe("basic notes", () => {
        it("transposes up, preferring sharps", () => {
            expect(transposeText("[C]", 2)).toBe("[D]")
            expect(transposeText("[C]", 1)).toBe("[C#]")
            expect(transposeText("[F]", 1)).toBe("[F#]")
        })

        it("transposes down, preferring flats", () => {
            expect(transposeText("[C]", -1)).toBe("[B]")
            expect(transposeText("[C]", -2)).toBe("[Bb]")
            expect(transposeText("[E]", -1)).toBe("[Eb]")
        })

        it("wraps around the octave", () => {
            expect(transposeText("[B]", 1)).toBe("[C]")
            expect(transposeText("[A]", 3)).toBe("[C]")
        })

        it("leaves notes unchanged at step 0", () => {
            expect(transposeText("[C]", 0)).toBe("[C]")
            expect(transposeText("[G]", 0)).toBe("[G]")
        })
    })

    describe("chord qualities and extensions", () => {
        it("keeps the suffix while moving the root", () => {
            expect(transposeText("[Cmaj7]", 2)).toBe("[Dmaj7]")
            expect(transposeText("[Am]", 3)).toBe("[Cm]")
            expect(transposeText("[Asus4]", 0)).toBe("[Asus4]")
        })

        it("transposes both sides of a slash chord", () => {
            expect(transposeText("[C/E]", 2)).toBe("[D/F#]")
            expect(transposeText("[G/B]", 2)).toBe("[A/C#]")
        })
    })

    describe("accidentals", () => {
        it("handles sharp and flat roots", () => {
            expect(transposeText("[F#]", 1)).toBe("[G]")
            expect(transposeText("[Bb]", -1)).toBe("[A]")
        })

        it("accepts unicode sharp/flat symbols", () => {
            expect(transposeText("[C♯]", 1)).toBe("[D]")
            expect(transposeText("[D♭]", -1)).toBe("[C]")
        })

        it("normalizes enharmonics toward the preferred accidental even at step 0", () => {
            expect(transposeText("[Db]", 0)).toBe("[C#]")
        })
    })

    describe("only touches bracketed chords", () => {
        it("transposes every chord in a line, leaving lyrics intact", () => {
            expect(transposeText("[C] [G] [Am]", 2)).toBe("[D] [A] [Bm]")
            expect(transposeText("Amazing [C] grace", 2)).toBe("Amazing [D] grace")
        })

        it("leaves section labels untouched", () => {
            expect(transposeText("[Chorus]", 2)).toBe("[Chorus]")
            expect(transposeText("[Verse 1]", 2)).toBe("[Verse 1]")
            expect(transposeText("[Bridge]", 2)).toBe("[Bridge]")
        })

        it("leaves plain text with no chords unchanged", () => {
            expect(transposeText("no chords here", 5)).toBe("no chords here")
        })
    })
})
