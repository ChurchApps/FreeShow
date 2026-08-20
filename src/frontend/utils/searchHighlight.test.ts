import { describe, expect, it, vi } from "vitest"

// searchHighlight.ts imports search.ts, which pulls in stores + heavy collaborators; stub them
const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return { _set: (v: unknown) => (value = v), subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) }
    }
    return { textCache: makeStore({}), categories: makeStore({}), drawerTabsData: makeStore({}) }
})
vi.mock("../stores", () => ({ textCache: h.textCache, categories: h.categories, drawerTabsData: h.drawerTabsData }))
vi.mock("../components/helpers/array", () => ({ sortObjectNumbers: (arr: any[]) => arr }))
vi.mock("../converters/txt", () => ({ similarity: () => 0 }))

import { getTextSnippet, highlightText } from "./searchHighlight"

describe("getTextSnippet", () => {
    it("finds a snippet around a plain phrase", () => {
        const text = "your love is holding on and it won't let go i feel it breaking out like an echo your love is holding on and it won't let go like an echo"
        const snippet = getTextSnippet(text, "i feel it breaking")
        expect(snippet).toContain("i feel it breaking")
        expect(snippet.startsWith("...")).toBe(true)
        expect(snippet.endsWith("...")).toBe(true)
    })

    it("matches across punctuation in the text (the old indexOf missed this)", () => {
        const text = "amazing grace, how sweet the sound that saved a wretch like me"
        const snippet = getTextSnippet(text, "grace how sweet")
        expect(snippet).toContain("grace, how sweet")
    })

    it("ignores punctuation and diacritics in the query", () => {
        expect(getTextSnippet("i feel it breaking out", "i feel it breaking?")).toContain("breaking")
        expect(getTextSnippet("we gather at the cafe tonight", "café")).toContain("cafe")
    })

    it("keeps diacritics readable when the text has them", () => {
        expect(getTextSnippet("señor ten piedad de nosotros", "senor ten")).toContain("señor ten")
    })

    it("falls back to the longest word when the full phrase is not found", () => {
        const text = "he has done great things bless his holy name forever"
        const snippet = getTextSnippet(text, "forever things")
        expect(snippet).toContain("forever")
    })

    it("only matches at the start of a word", () => {
        expect(getTextSnippet("there is a river", "here")).toBe("")
    })

    it("returns nothing for short queries or no match", () => {
        expect(getTextSnippet("some lyrics here", "so")).toBe("")
        expect(getTextSnippet("some lyrics here", "unrelated")).toBe("")
        expect(getTextSnippet("", "anything")).toBe("")
    })

    it("has no ellipsis on edges that are not truncated", () => {
        expect(getTextSnippet("hello world", "hello")).toBe("hello world")
    })

    it("does not cut words in half", () => {
        const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ")
        const snippet = getTextSnippet(words, "word15").replace(/^\.\.\.|\.\.\.$/g, "")
        for (const word of snippet.split(" ")) expect(words.split(" ")).toContain(word)
    })
})

describe("highlightText", () => {
    it("wraps every occurrence of the phrase in <mark>", () => {
        expect(highlightText("he has done great things he has done", "he has done")).toBe("<mark>he has done</mark> great things <mark>he has done</mark>")
    })

    it("marks individual words when the phrase is not found", () => {
        expect(highlightText("done what he said", "he done")).toBe("<mark>done</mark> what <mark>he</mark> said")
    })

    it("escapes HTML in the text", () => {
        expect(highlightText("lyrics with <b>tags</b> & symbols", "lyrics")).toBe("<mark>lyrics</mark> with &lt;b&gt;tags&lt;/b&gt; &amp; symbols")
    })

    it("returns escaped text when nothing matches", () => {
        expect(highlightText("a <safe> string", "unrelated")).toBe("a &lt;safe&gt; string")
    })

    it("marks across punctuation and diacritics", () => {
        expect(highlightText("amazing grace, how sweet", "grace how")).toBe("amazing <mark>grace, how</mark> sweet")
        expect(highlightText("señor ten piedad", "senor")).toBe("<mark>señor</mark> ten piedad")
    })

    it("only marks at the start of a word", () => {
        expect(highlightText("there is a river", "here")).toBe("there is a river")
    })
})
