import { describe, it, expect } from "vitest"
import { getFilters, getStyles, removeText } from "./style"

describe("removeText", () => {
    it("strips everything that isn't a digit, dot, or minus sign", () => {
        expect(removeText("12px")).toBe("12")
        expect(removeText("-1.5rem")).toBe("-1.5")
        expect(removeText("100%")).toBe("100")
    })
    it("returns an empty string when the input has no digits", () => {
        expect(removeText("auto")).toBe("")
    })
    it("gracefully handles undefined (defensive — .replace could throw)", () => {
        expect(removeText(undefined as any)).toBeUndefined()
    })
})

describe("getStyles", () => {
    it("parses a semicolon-separated inline style into an object", () => {
        expect(getStyles("color: red; font-size: 14px")).toEqual({
            color: "red",
            "font-size": "14px"
        })
    })

    it("returns {} for null/undefined/empty input", () => {
        expect(getStyles(null)).toEqual({})
        expect(getStyles(undefined)).toEqual({})
        expect(getStyles("")).toEqual({})
    })

    it("trims whitespace around keys and values", () => {
        expect(getStyles("  color :   blue  ")).toEqual({ color: "blue" })
    })

    it("ignores empty segments between semicolons", () => {
        expect(getStyles("color: red;;font-size: 12px;")).toEqual({ color: "red", "font-size": "12px" })
    })

    it("with removeTxt=true, strips units from a plain numeric style", () => {
        // font-size is not on the "don't replace" list and doesn't include color/background, so it gets stripped
        expect(getStyles("font-size: 14px", true)["font-size"]).toBe("14")
    })

    it("with removeTxt=true, preserves color/background values (they legitimately hold non-numeric text)", () => {
        const styles = getStyles("color: #fff; background: red", true)
        expect(styles.color).toBe("#fff")
        expect(styles.background).toBe("red")
    })

    it("with removeTxt=true, preserves keys on the don't-replace list", () => {
        // text-decoration / text-transform / text-shadow / box-shadow / font-family / transform are protected
        expect(getStyles("text-decoration: underline", true)["text-decoration"]).toBe("underline")
        expect(getStyles("font-family: Arial", true)["font-family"]).toBe("Arial")
    })

    it("hoists transform() functions into individual keys via getFilters", () => {
        const styles = getStyles("transform: scale(1.5) rotate(45deg)")
        // getFilters splits by space; the numeric value is extracted (removeText leaves digits/./-)
        expect(styles.scale).toBe("1.5")
        expect(styles.rotate).toBe("45")
        // the original transform string is also retained
        expect(styles.transform).toBe("scale(1.5) rotate(45deg)")
    })
})

describe("getFilters", () => {
    it("parses a space-separated filter list into name→value pairs", () => {
        expect(getFilters("blur(4px) brightness(0.5)")).toEqual({ blur: "4", brightness: "0.5" })
    })
    it("returns {} for non-string input (defensive)", () => {
        expect(getFilters(undefined)).toEqual({})
        expect(getFilters(null as any)).toEqual({})
        expect(getFilters(42 as any)).toEqual({})
    })
    it("handles a single filter with no space", () => {
        expect(getFilters("blur(10px)")).toEqual({ blur: "10" })
    })
})
