import { expect, test } from "@playwright/test"
import { filterPlanningCenterKeywordLines, isPlanningCenterKeywordLine } from "../../src/electron/contentProviders/planningCenter/songKeywords"

test.describe("Planning Center song keywords", () => {
    test("detects Planning Center control keyword lines", () => {
        expect(isPlanningCenterKeywordLine("COLUMN_BREAK")).toBe(true)
        expect(isPlanningCenterKeywordLine("COLUMN_BRAKE")).toBe(true)
        expect(isPlanningCenterKeywordLine("LINE_BREAK")).toBe(true)
        expect(isPlanningCenterKeywordLine("PAGE_BREAK")).toBe(true)
        expect(isPlanningCenterKeywordLine("TRANSPOSE KEY + 2")).toBe(true)
        expect(isPlanningCenterKeywordLine("TRANSPOSE KEY -2")).toBe(true)
    })

    test("does not treat normal lyrics, chords, or section labels as keywords", () => {
        expect(isPlanningCenterKeywordLine("Amazing grace")).toBe(false)
        expect(isPlanningCenterKeywordLine("VERSE 1")).toBe(false)
        expect(isPlanningCenterKeywordLine("C    G/B    Am")).toBe(false)
    })

    test("filters Planning Center keyword lines out of imported lyrics", () => {
        const inputWithKeywords = "Verse line 1\r\nLINE_BREAK\r\nTRANSPOSE KEY + 2\r\nCOLUMN_BREAK\r\nVerse line 2\r\nPAGE_BREAK"
        const expectedFilteredOutput = "Verse line 1\nVerse line 2"

        expect(filterPlanningCenterKeywordLines(inputWithKeywords)).toBe(expectedFilteredOutput)
    })
})
