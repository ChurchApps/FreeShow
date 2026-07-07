import { describe, it, expect } from "vitest"
import { transposeText } from "./chordTranspose"

// transposeText looks for chord tokens in [brackets] and transposes them by `step` semitones.
// Anything that doesn't look like a chord (e.g. section labels [Verse], [Chorus]) is left alone.

describe("transposeText — basic transposition", () => {
    it("shifts a root chord up by one semitone (sharp preferred going up)", () => {
        expect(transposeText("[C]", 1)).toBe("[C#]")
        expect(transposeText("[G]", 2)).toBe("[A]")
    })
    it("shifts a root chord down by one semitone (flat preferred going down)", () => {
        expect(transposeText("[C]", -1)).toBe("[B]")
        expect(transposeText("[D]", -1)).toBe("[Db]")
    })
    it("preserves quality/extension suffixes when transposing", () => {
        expect(transposeText("[Cmaj7]", 2)).toBe("[Dmaj7]")
        expect(transposeText("[Am7]", 2)).toBe("[Bm7]")
        expect(transposeText("[Gsus4]", 5)).toBe("[Csus4]")
    })
    it("wraps around the octave (+12 = same chord)", () => {
        expect(transposeText("[C]", 12)).toBe("[C]")
        expect(transposeText("[C]", -12)).toBe("[C]")
    })
})

describe("transposeText — slash chords", () => {
    it("transposes both the main and bass note", () => {
        expect(transposeText("[C/G]", 2)).toBe("[D/A]")
    })
    it("handles minor + bass together", () => {
        expect(transposeText("[Bm7/E]", 1)).toBe("[Cm7/F]")
    })
})

describe("transposeText — accidentals in and out", () => {
    it("accepts unicode ♯ / ♭ symbols in the input and normalizes them", () => {
        expect(transposeText("[C♯]", 1)).toBe("[D]")
        expect(transposeText("[D♭]", 1)).toBe("[D]") // Db up 1 = D
    })
    it("prefers sharps when transposing up", () => {
        expect(transposeText("[C]", 1)).toBe("[C#]")
    })
    it("prefers flats when transposing down", () => {
        expect(transposeText("[D]", -1)).toBe("[Db]")
    })
})

describe("transposeText — inline text", () => {
    it("only touches text inside brackets, not surrounding lyrics", () => {
        const input = "Amazing [G]grace how [C]sweet the [D]sound"
        expect(transposeText(input, 2)).toBe("Amazing [A]grace how [D]sweet the [E]sound")
    })
    it("leaves section labels like [Verse] / [Chorus] untouched", () => {
        // "Verse" starts with V — not a valid root; there is also the length + word heuristic
        expect(transposeText("[Verse]\n[Chorus]\n[Bridge]", 2)).toBe("[Verse]\n[Chorus]\n[Bridge]")
    })
    it("leaves plain text with no bracketed tokens unchanged", () => {
        expect(transposeText("no chords here", 5)).toBe("no chords here")
    })
})

describe("transposeText — no-op step", () => {
    it("returns the input unchanged for step=0", () => {
        // step 0 with sharps preferred; C stays C, C# stays C#
        expect(transposeText("[C] [G] [Am]", 0)).toBe("[C] [G] [Am]")
    })
})
