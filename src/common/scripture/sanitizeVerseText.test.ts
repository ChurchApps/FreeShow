import { describe, it, expect } from "vitest"
import { sanitizeVerseText } from "./sanitizeVerseText"

//   = non-breaking space; “ / ” = curly double quotes (what <q>...</q> becomes).

describe("sanitizeVerseText", () => {
    it("returns an empty string for null/undefined", () => {
        expect(sanitizeVerseText(null)).toBe("")
        expect(sanitizeVerseText(undefined)).toBe("")
    })

    it("coerces non-string input to a string", () => {
        expect(sanitizeVerseText(42)).toBe("42")
    })

    it("leaves plain text untouched", () => {
        expect(sanitizeVerseText("In the beginning")).toBe("In the beginning")
    })

    it("replaces <br> tags (any form, any case) with a space", () => {
        expect(sanitizeVerseText("one<br>two")).toBe("one two")
        expect(sanitizeVerseText("one<br/>two")).toBe("one two")
        expect(sanitizeVerseText("one<br />two")).toBe("one two")
        expect(sanitizeVerseText("one<BR>two")).toBe("one two")
    })

    it("replaces non-breaking spaces with regular spaces", () => {
        expect(sanitizeVerseText("a b")).toBe("a b")
    })

    it("converts <q> tags to curly quotes (non-greedy)", () => {
        expect(sanitizeVerseText("<q>holy</q>")).toBe("“holy”")
        expect(sanitizeVerseText("he said <q>peace</q> to them")).toBe("he said “peace” to them")
        expect(sanitizeVerseText("<q>a</q> and <q>b</q>")).toBe("“a” and “b”")
    })

    it("collapses runs of spaces and trims", () => {
        expect(sanitizeVerseText("a    b")).toBe("a b")
        expect(sanitizeVerseText("   padded   ")).toBe("padded")
    })

    it("handles a combination of all rules", () => {
        expect(sanitizeVerseText("  <q>Hello</q>  <br>  world !  ")).toBe("“Hello” world !")
    })
})
