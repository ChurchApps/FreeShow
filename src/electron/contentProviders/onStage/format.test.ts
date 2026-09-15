import { describe, expect, it } from "vitest"
import { capitalizeFirstWord, defaultOnStageFormat, formatSectionSlides, getFormatSettings, getLyricsSignature, splitLongLine, stripSectionNumber, type OnStageFormatSettings } from "./format"

const settings = (overrides: Partial<OnStageFormatSettings> = {}): OnStageFormatSettings => ({ ...defaultOnStageFormat, ...overrides })

describe("getFormatSettings", () => {
    it("falls back to the defaults for missing or invalid values", () => {
        expect(getFormatSettings(undefined)).toEqual({ linesPerSlide: 0, maxLineLength: 0, mergeIdenticalSections: true })
        expect(getFormatSettings({ linesPerSlide: "not a number", maxLineLength: -5 })).toEqual({ linesPerSlide: 0, maxLineLength: 0, mergeIdenticalSections: true })
    })

    it("reads the user's values", () => {
        expect(getFormatSettings({ linesPerSlide: 2, maxLineLength: 42, mergeIdenticalSections: false })).toEqual({ linesPerSlide: 2, maxLineLength: 42, mergeIdenticalSections: false })
    })
})

describe("capitalizeFirstWord", () => {
    it("uppercases the first letter", () => {
        expect(capitalizeFirstWord("mare este Domnul")).toBe("Mare este Domnul")
    })

    it("skips leading punctuation", () => {
        expect(capitalizeFirstWord('"și cerul cântă')).toBe('"Și cerul cântă')
    })

    it("handles Romanian diacritics", () => {
        expect(capitalizeFirstWord("ține-mă aproape")).toBe("Ține-mă aproape")
        expect(capitalizeFirstWord("înalt e numele")).toBe("Înalt e numele")
    })

    it("leaves an already capitalized line alone", () => {
        expect(capitalizeFirstWord("Slavă Ție")).toBe("Slavă Ție")
    })
})

describe("splitLongLine", () => {
    it("keeps a line that fits", () => {
        expect(splitLongLine("mare este Domnul", 40)).toEqual(["mare este Domnul"])
    })

    it("never splits when no limit is set", () => {
        const long = "a".repeat(20) + " " + "b".repeat(20)
        expect(splitLongLine(long, 0)).toEqual([long])
    })

    it("splits on a word boundary as close to the middle as possible", () => {
        expect(splitLongLine("unu doi trei patru cinci sase", 20)).toEqual(["unu doi trei", "Patru cinci sase"])
    })

    it("capitalizes the first word of the continuation", () => {
        const [, second] = splitLongLine("mare este Domnul si vrednic de laudă mereu", 25)
        expect(second[0]).toBe(second[0].toUpperCase())
    })

    it("splits again until every part fits", () => {
        const parts = splitLongLine("unu doi trei patru cinci sase sapte opt noua zece", 12)
        expect(parts.every((part) => part.length <= 12)).toBe(true)
        expect(parts.join(" ").toLowerCase()).toBe("unu doi trei patru cinci sase sapte opt noua zece")
    })

    it("gives up on a single word longer than the limit instead of cutting it", () => {
        expect(splitLongLine("neîntreruptcuvântfoartelung", 10)).toEqual(["neîntreruptcuvântfoartelung"])
    })

    it("collapses stray whitespace", () => {
        expect(splitLongLine("  mare   este    Domnul  ", 40)).toEqual(["mare este Domnul"])
    })
})

describe("formatSectionSlides", () => {
    const section = [{ lines: ["unu", "doi"] }, { lines: ["trei", "patru", "cinci"] }]

    it("returns the OnStage slides untouched when nothing is configured", () => {
        expect(formatSectionSlides(section, settings())).toBe(section)
    })

    it("regroups all lines of the section into slides of the requested size", () => {
        expect(formatSectionSlides(section, settings({ linesPerSlide: 2 }))).toEqual([{ lines: ["unu", "doi"] }, { lines: ["trei", "patru"] }, { lines: ["cinci"] }])
    })

    it("keeps OnStage's slide boundaries when only a line limit is set", () => {
        const long = [{ lines: ["unu doi trei patru cinci sase"] }]
        expect(formatSectionSlides(long, settings({ maxLineLength: 20 }))).toEqual([{ lines: ["unu doi trei", "Patru cinci sase"] }])
    })

    it("splits long lines before regrouping them", () => {
        const long = [{ lines: ["unu doi trei patru cinci sase"] }]
        expect(formatSectionSlides(long, settings({ linesPerSlide: 1, maxLineLength: 20 }))).toEqual([{ lines: ["unu doi trei"] }, { lines: ["Patru cinci sase"] }])
    })

    it("leaves an instrumental section as one empty slide", () => {
        const empty = [{ lines: [] }]
        expect(formatSectionSlides(empty, settings({ linesPerSlide: 2 }))).toEqual(empty)
    })
})

describe("getLyricsSignature", () => {
    it("ignores case, punctuation and slide boundaries", () => {
        const a = getLyricsSignature([{ lines: ["Mare este Domnul,"] }, { lines: ["vrednic de laudă!"] }])
        const b = getLyricsSignature([{ lines: ["mare este domnul", "Vrednic de laudă"] }])
        expect(a).toBe(b)
    })

    it("keeps different lyrics apart", () => {
        const a = getLyricsSignature([{ lines: ["strofa unu"] }])
        const b = getLyricsSignature([{ lines: ["strofa doi"] }])
        expect(a).not.toBe(b)
    })

    it("is empty for a section without lyrics", () => {
        expect(getLyricsSignature([{ lines: [] }])).toBe("")
    })
})

describe("stripSectionNumber", () => {
    it("removes a trailing number", () => {
        expect(stripSectionNumber("Chorus 2")).toBe("Chorus")
        expect(stripSectionNumber("Refren 10")).toBe("Refren")
    })

    it("leaves an unnumbered name alone", () => {
        expect(stripSectionNumber("Bridge")).toBe("Bridge")
    })

    it("never returns an empty name", () => {
        expect(stripSectionNumber("2")).toBe("2")
    })
})
