import { describe, it, expect, vi, beforeEach } from "vitest"

// txt.ts imports the whole app at module scope (ShowObj, textStyle, show/shows, history,
// formatTextEditor, language ...). Mock those just enough to load the module so we can
// unit-test its exported pure/string helpers. stores stay real (node-safe writables).
vi.mock("../classes/Show", () => ({ ShowObj: class {} }))
vi.mock("../components/edit/scripts/textStyle", () => ({ getItemText: () => "", getSlideText: () => "" }))
vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/helpers/history", () => ({ history: () => {} }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n, getCustomMetadata: () => ({}), getLabelId: (s: string) => s }))
vi.mock("../components/helpers/shows", () => ({ _show: () => ({ get: () => null }) }))
vi.mock("../components/show/formatTextEditor", () => ({ linesToTextboxes: () => [] }))
vi.mock("../show/slides", () => ({ VIRTUAL_BREAK_CHAR: "​" }))
vi.mock("../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("./importHelpers", () => ({ setTempShows: () => {} }))

import { findGroupMatch, similarity, trimNameFromString } from "./txt"
import { dictionary, groups } from "../stores"

describe("txt converter helpers", () => {
    describe("trimNameFromString", () => {
        it("returns '' for empty input", () => {
            expect(trimNameFromString("")).toBe("")
        })

        it("uses the first line when it isn't a label", () => {
            expect(trimNameFromString("First line\nSecond line")).toBe("First line")
        })

        it("skips a leading [group] or label: line and uses the next line", () => {
            expect(trimNameFromString("[Verse]\nActual Name")).toBe("Actual Name")
        })

        it("strips punctuation and html tags", () => {
            expect(trimNameFromString("Hello, World!")).toBe("Hello World")
            expect(trimNameFromString("Hello <b>World</b>")).toBe("Hello World")
        })

        it("truncates long names at a word boundary near 30 chars", () => {
            expect(trimNameFromString("The quick brown fox jumps over the lazy dog")).toBe("The quick brown fox jumps over")
        })
    })

    describe("similarity", () => {
        it("is 1 for identical (and for two empty) strings", () => {
            expect(similarity("abc", "abc")).toBe(1)
            expect(similarity("", "")).toBe(1)
        })

        it("is 0 for completely different strings of equal length", () => {
            expect(similarity("abc", "xyz")).toBe(0)
        })

        it("is case-insensitive", () => {
            expect(similarity("ABC", "abc")).toBe(1)
        })

        it("scores partial matches by edit distance", () => {
            expect(similarity("kitten", "sitting")).toBeCloseTo(4 / 7, 5)
        })
    })

    describe("findGroupMatch", () => {
        beforeEach(() => {
            groups.set({} as any)
            dictionary.set({} as any)
        })

        it("matches a group id directly", () => {
            groups.set({ verse: { name: "Verse" }, chorus: { name: "Chorus" } } as any)
            expect(findGroupMatch("verse")).toBe("verse")
        })

        it("matches a custom group by its display name", () => {
            groups.set({ v1: { name: "My Verse" } } as any)
            expect(findGroupMatch("my verse")).toBe("v1")
        })

        it("falls back to a dictionary translation", () => {
            dictionary.set({ groups: { chorus: "Refrain" } } as any)
            expect(findGroupMatch("refrain")).toBe("chorus")
        })

        it("returns '' when nothing matches", () => {
            expect(findGroupMatch("nope")).toBe("")
        })
    })
})
