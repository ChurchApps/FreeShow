import { describe, expect, it } from "vitest"
import { BIBLE_NAMES_BY_BOOK, BIBLE_NAMES_RANKED } from "./bibleVocabulary"
import { composeBiblePrompt, isPromptEcho } from "./prompt"

describe("composeBiblePrompt", () => {
    it("carries the KJV style vocabulary and a list of biblical names", () => {
        const prompt = composeBiblePrompt()
        for (const word of ["thou", "whence", "knowest", "camest", "unto"]) expect(prompt.toLowerCase()).toContain(word)
        expect(prompt).toContain(BIBLE_NAMES_RANKED[0])
    })

    it("stays within the slim character budget - a heavy prompt is hallucination pressure", () => {
        expect(composeBiblePrompt().length).toBeLessThanOrEqual(300)
        expect(composeBiblePrompt([9, 1]).length).toBeLessThanOrEqual(300)
    })

    it("puts the active book's names ahead of the global ranking", () => {
        const bookNames = BIBLE_NAMES_BY_BOOK[27] // Daniel: Nebuchadnezzar, Shadrach, ...
        expect(bookNames?.length).toBeGreaterThan(0)
        const prompt = composeBiblePrompt([27])
        for (const name of bookNames.slice(0, 5)) expect(prompt).toContain(name)
    })

    it("never repeats a name that is both book-local and globally ranked", () => {
        const prompt = composeBiblePrompt([9])
        const names = prompt
            .split("concerning ")[1]
            .split(/,\s*|\.\s*$/)
            .filter(Boolean)
        expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length)
    })
})

describe("isPromptEcho", () => {
    const prompt = composeBiblePrompt()

    it("drops a verbatim echo of a prompt stretch", () => {
        expect(isPromptEcho("verily thou knowest whence thou camest and whither thou goest", prompt)).toBe(true)
        const names = BIBLE_NAMES_RANKED.slice(0, 6).join(", ")
        expect(isPromptEcho(names, prompt)).toBe(true)
    })

    it("survives punctuation and casing differences in the echo", () => {
        expect(isPromptEcho("Verily! Thou knowest... whence thou camest, and whither thou goest.", prompt)).toBe(true)
    })

    it("keeps genuine speech that merely overlaps prompt vocabulary", () => {
        expect(isPromptEcho("and the Amalekites came up against Israel in the wilderness", prompt)).toBe(false)
        expect(isPromptEcho("thou shalt love the Lord thy God with all thy heart", prompt)).toBe(false)
    })

    it("keeps short segments even when they appear in the prompt", () => {
        expect(isPromptEcho("whence thou camest", prompt)).toBe(false)
    })

    it("keeps everything when there is no overlap at all", () => {
        expect(isPromptEcho("for God so loved the world that he gave his only begotten Son", prompt)).toBe(false)
    })
})
