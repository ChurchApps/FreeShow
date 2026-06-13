import { describe, it, expect } from "vitest"
import { getFilters, getStyles, removeText } from "./style"

describe("style helpers", () => {
    describe("removeText", () => {
        it("strips everything but digits, dot and minus", () => {
            expect(removeText("20px")).toBe("20")
            expect(removeText("1.5em")).toBe("1.5")
            expect(removeText("-5px")).toBe("-5")
        })
    })

    describe("getStyles", () => {
        it("returns an empty object for empty/nullish input", () => {
            expect(getStyles("")).toEqual({})
            expect(getStyles(null)).toEqual({})
            expect(getStyles(undefined)).toEqual({})
        })

        it("parses a semicolon-separated style string", () => {
            expect(getStyles("color: red")).toEqual({ color: "red" })
            expect(getStyles("color: red; font-size: 20px")).toEqual({ color: "red", "font-size": "20px" })
        })

        it("ignores trailing/empty segments", () => {
            expect(getStyles("color: red;")).toEqual({ color: "red" })
        })

        it("strips units when removeTxt is set (but not for colors)", () => {
            expect(getStyles("font-size: 20px", true)).toEqual({ "font-size": "20" })
            expect(getStyles("color: red", true)).toEqual({ color: "red" })
        })

        it("expands transform into individual filters", () => {
            expect(getStyles("transform: blur(5px)")).toEqual({ blur: "5", transform: "blur(5px)" })
        })
    })

    describe("getFilters", () => {
        it("parses space-separated filter functions, stripping units", () => {
            expect(getFilters("blur(5px) brightness(0.5)")).toEqual({ blur: "5", brightness: "0.5" })
        })

        it("returns an empty object for non-string input", () => {
            expect(getFilters(undefined)).toEqual({})
        })
    })
})
