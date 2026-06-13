import { describe, it, expect } from "vitest"
import { getFontName, getFontStyleList } from "./fonts"

describe("fonts helpers", () => {
    describe("getFontName", () => {
        it("wraps custom font names in single quotes", () => {
            expect(getFontName("Arial")).toBe("'Arial'")
            expect(getFontName("Times New Roman")).toBe("'Times New Roman'")
        })
        it("leaves generic families and already-quoted names as-is", () => {
            expect(getFontName("monospace")).toBe("monospace")
            expect(getFontName("Fantasy")).toBe("Fantasy")
            expect(getFontName("'Arial'")).toBe("'Arial'")
        })
        it("returns an empty string for falsy input", () => {
            expect(getFontName("")).toBe("")
        })
    })

    describe("getFontStyleList", () => {
        it("returns empty defaults when no fonts are cached", () => {
            expect(getFontStyleList("Whatever")).toEqual({ fontStyles: [], defaultValue: "" })
        })
    })
})
