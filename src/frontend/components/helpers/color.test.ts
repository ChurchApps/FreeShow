import { describe, it, expect } from "vitest"
import { defaultColors, fadeColor, getContrast, hexToHSL, hexToRgb, hslToHex, rgbToHex, splitGradientValue, splitRgb } from "./color"

describe("hexToRgb", () => {
    it("parses a 6-digit hex color", () => {
        expect(hexToRgb("#FF8000")).toEqual({ r: 255, g: 128, b: 0 })
    })
    it("accepts hex without a leading #", () => {
        expect(hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 })
    })
    it("returns zeros for an invalid string (defensive)", () => {
        expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 })
    })
})

describe("splitRgb", () => {
    it("parses legacy rgba() syntax", () => {
        expect(splitRgb("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    })
    it("parses modern space-separated rgb() with / alpha", () => {
        expect(splitRgb("rgb(10 20 30 / 0.25)")).toEqual({ r: 10, g: 20, b: 30, a: 0.25 })
    })
    it("defaults alpha to 1 when missing", () => {
        expect(splitRgb("rgb(1,2,3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    })
})

describe("rgbToHex", () => {
    it("round-trips through hexToRgb", () => {
        expect(rgbToHex("rgb(255, 128, 0)").toLowerCase()).toBe("#ff8000")
    })
    it("pads single-digit hex components", () => {
        expect(rgbToHex("rgb(1, 2, 3)").toLowerCase()).toBe("#010203")
    })
})

describe("fadeColor", () => {
    it("adds an alpha channel to a hex color", () => {
        expect(fadeColor("#FF8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)")
    })
    it("defaults alpha to 0.5 when omitted", () => {
        expect(fadeColor("#000000")).toBe("rgba(0, 0, 0, 0.5)")
    })
})

describe("getContrast (readable text on a background)", () => {
    it("returns black on a light background", () => {
        expect(getContrast("#FFFFFF")).toBe("#000000")
    })
    it("returns white on a dark background", () => {
        expect(getContrast("#000000")).toBe("#FFFFFF")
    })
    it("returns white for a non-string input (defensive)", () => {
        expect(getContrast(undefined as any)).toBe("#FFFFFF")
    })
})

describe("hexToHSL / hslToHex round-trip", () => {
    // hex→hsl→hex should recover the original color within rounding tolerance.
    // We check a spread of hues (defaultColors is the app's own palette).
    it.each(defaultColors.filter((c) => c.value !== "#000000" && c.value !== "#FFFFFF"))("round-trips $name ($value)", ({ value }) => {
        const hsl = hexToHSL(value)
        const back = hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()
        const original = value.toLowerCase()

        // allow ±2 per channel: hexToHSL rounds h/s/l to 1 decimal, then hslToHex rounds
        // rgb to integers — that's two rounding steps, so up to ±2 per channel is possible.
        const toRgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
        const [r1, g1, b1] = toRgb(back)
        const [r2, g2, b2] = toRgb(original)
        expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(2)
        expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(2)
        expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(2)
    })

    it("black stays black", () => {
        const hsl = hexToHSL("#000000")
        expect(hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()).toBe("#000000")
    })
    it("white stays white", () => {
        const hsl = hexToHSL("#FFFFFF")
        expect(hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()).toBe("#ffffff")
    })
    it("supports 3-digit shorthand hex", () => {
        // #F00 → red
        const hsl = hexToHSL("#F00")
        expect(hsl.h).toBe(0)
        expect(hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()).toBe("#ff0000")
    })
})

describe("splitGradientValue", () => {
    it("parses a linear-gradient with explicit degrees and positions", () => {
        const g = splitGradientValue("linear-gradient(120deg, #FF0000 0%, #00FF00 50%, #0000FF 100%)")
        expect(g.type).toBe("linear-gradient")
        expect(g.deg).toBe(120)
        expect(g.colors).toEqual([
            { color: "#FF0000", pos: 0 },
            { color: "#00FF00", pos: 50 },
            { color: "#0000FF", pos: 100 }
        ])
    })

    it("defaults angle to 180 when omitted", () => {
        const g = splitGradientValue("linear-gradient(#FF0000, #00FF00)")
        expect(g.deg).toBe(180)
    })

    it("auto-distributes missing positions across the stops", () => {
        const g = splitGradientValue("linear-gradient(90deg, red, green, blue)")
        expect(g.colors.map((c) => c.pos)).toEqual([0, 50, 100])
    })

    it("parses a radial-gradient with a shape", () => {
        const g = splitGradientValue("radial-gradient(circle, #FF0000 0%, #0000FF 100%)")
        expect(g.type).toBe("radial-gradient")
        expect(g.shape).toBe("circle")
        expect(g.colors).toHaveLength(2)
    })

    it("normalizes rgb() color stops to rgba()", () => {
        const g = splitGradientValue("linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)")
        expect(g.colors[0].color).toBe("rgba(255,0,0, 1)")
        expect(g.colors[1].color).toBe("rgba(0,0,255, 1)")
    })

    it("returns an empty result for a non-gradient string", () => {
        expect(splitGradientValue("not a gradient").colors).toEqual([])
    })
})
