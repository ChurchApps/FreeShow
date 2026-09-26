import { describe, expect, it, vi } from "vitest"

vi.mock("../../stores", () => ({}))
vi.mock("../helpers/array", () => ({}))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))

import { getTextSnippet, highlightText } from "./searchHighlight"

const lyrics = "amazing grace how sweet the sound that saved a wretch like me"

describe("getTextSnippet", () => {
    it("shows a lyrics snippet around the match", () => {
        expect(getTextSnippet(lyrics, "wretch")).toContain("wretch")
    })
    it("hides the snippet when the name matches every word", () => {
        expect(getTextSnippet(lyrics, "amazing gra", "Amazing Grace")).toBe("")
    })
    it("hides the snippet when any word matches the name", () => {
        expect(getTextSnippet(lyrics, "grace wretch", "Amazing Grace")).toBe("")
    })
    it("keeps the snippet when no word matches the name", () => {
        expect(getTextSnippet(lyrics, "sound", "Amazing Grace")).toContain("sound")
    })
})

describe("highlightText", () => {
    it("escapes html and marks matches", () => {
        expect(highlightText("<b> Grace", "grace")).toBe("&lt;b&gt; <mark>Grace</mark>")
    })
})
