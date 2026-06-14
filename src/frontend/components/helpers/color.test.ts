import { describe, it, expect } from "vitest"
import { brightenDarkColor, fadeColor, getContrast, hexToHSL, hexToRgb, hslToHex, rgbToHex, splitRgb } from "./color"

describe("color helpers", () => {
    describe("hexToRgb", () => {
        it("converts 6-digit hex (with or without #, any case)", () => {
            expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 })
            expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 })
            expect(hexToRgb("#FF4136")).toEqual({ r: 255, g: 65, b: 54 })
            expect(hexToRgb("0074D9")).toEqual({ r: 0, g: 116, b: 217 })
            expect(hexToRgb("#ff4136")).toEqual({ r: 255, g: 65, b: 54 })
        })

        it("falls back to black for invalid input (incl. 3-digit shorthand)", () => {
            expect(hexToRgb("#fff")).toEqual({ r: 0, g: 0, b: 0 })
            expect(hexToRgb("")).toEqual({ r: 0, g: 0, b: 0 })
            expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 })
        })
    })

    describe("splitRgb", () => {
        it("parses comma-separated rgb/rgba", () => {
            expect(splitRgb("rgb(255, 65, 54)")).toEqual({ r: 255, g: 65, b: 54, a: 1 })
            expect(splitRgb("rgba(255, 65, 54, 0.5)")).toEqual({ r: 255, g: 65, b: 54, a: 0.5 })
        })

        it("parses modern space/slash syntax", () => {
            expect(splitRgb("rgb(255 65 54 / 0.5)")).toEqual({ r: 255, g: 65, b: 54, a: 0.5 })
        })

        it("defaults alpha to 1 when missing", () => {
            expect(splitRgb("rgb(0, 0, 0)").a).toBe(1)
        })
    })

    describe("rgbToHex", () => {
        it("converts rgb back to hex (zero-padded, lowercase)", () => {
            expect(rgbToHex("rgb(255, 65, 54)")).toBe("#ff4136")
            expect(rgbToHex("rgb(0, 116, 217)")).toBe("#0074d9")
            expect(rgbToHex("rgb(5, 5, 5)")).toBe("#050505")
        })
    })

    describe("fadeColor", () => {
        it("produces rgba() with the given alpha", () => {
            expect(fadeColor("#FF4136", 0.5)).toBe("rgba(255, 65, 54, 0.5)")
            expect(fadeColor("#FFFFFF", 1)).toBe("rgba(255, 255, 255, 1)")
        })

        it("defaults alpha to 0.5", () => {
            expect(fadeColor("#000000")).toBe("rgba(0, 0, 0, 0.5)")
        })
    })

    describe("getContrast", () => {
        it("returns black text for light backgrounds", () => {
            expect(getContrast("#FFFFFF")).toBe("#000000")
            expect(getContrast("#FFDC00")).toBe("#000000")
        })

        it("returns white text for dark backgrounds", () => {
            expect(getContrast("#000000")).toBe("#FFFFFF")
            expect(getContrast("#0074D9")).toBe("#FFFFFF")
        })

        it("returns white for non-string input", () => {
            expect(getContrast(null as any)).toBe("#FFFFFF")
        })
    })

    describe("hexToHSL / hslToHex", () => {
        it("converts primaries to HSL", () => {
            expect(hexToHSL("#FFFFFF")).toEqual({ h: 0, s: 0, l: 100 })
            expect(hexToHSL("#000000")).toEqual({ h: 0, s: 0, l: 0 })
            expect(hexToHSL("#FF0000")).toEqual({ h: 0, s: 100, l: 50 })
            expect(hexToHSL("#00FF00")).toEqual({ h: 120, s: 100, l: 50 })
            expect(hexToHSL("#0000FF")).toEqual({ h: 240, s: 100, l: 50 })
        })

        it("supports 3-digit shorthand", () => {
            expect(hexToHSL("#FFF")).toEqual({ h: 0, s: 0, l: 100 })
        })

        it("converts HSL back to hex", () => {
            expect(hslToHex(0, 100, 50)).toBe("#ff0000")
            expect(hslToHex(120, 100, 50)).toBe("#00ff00")
            expect(hslToHex(240, 100, 50)).toBe("#0000ff")
            expect(hslToHex(0, 0, 100)).toBe("#ffffff")
            expect(hslToHex(0, 0, 0)).toBe("#000000")
        })

        it("round-trips primary colors", () => {
            for (const hex of ["#ff0000", "#00ff00", "#0000ff"]) {
                const { h, s, l } = hexToHSL(hex)
                expect(hslToHex(h, s, l)).toBe(hex)
            }
        })
    })

    describe("brightenDarkColor", () => {
        it("lifts very dark colors to at least 50% lightness", () => {
            expect(brightenDarkColor("#000000")).toBe("#808080")
        })

        it("leaves already-bright colors unchanged", () => {
            expect(brightenDarkColor("#FFFFFF")).toBe("#ffffff")
        })
    })
})
