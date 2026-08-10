import { describe, expect, it } from "vitest"

import { CommandStream, detectScriptureCommand } from "./commands"

const TRANSLATIONS = [
    { id: "niv-id", names: ["New International Version", "NIV"] },
    { id: "kjv-id", names: ["King James Version", "King James", "KJV"] }
]

const detect = (text: string, language = "en") => detectScriptureCommand(text, language, TRANSLATIONS)

describe("detectScriptureCommand", () => {
    describe("english positives", () => {
        it("detects verse_next: 'go to the next verse'", () => {
            expect(detect("go to the next verse")).toEqual({ type: "verse_next", phrase: "go to the next verse" })
        })

        it("detects verse_previous: 'give me the previous verse'", () => {
            expect(detect("give me the previous verse")).toEqual({ type: "verse_previous", phrase: "give me the previous verse" })
        })

        it("detects chapter_next: 'show the next chapter'", () => {
            expect(detect("alright everyone show the next chapter")).toEqual({ type: "chapter_next", phrase: "show the next chapter" })
        })

        it("detects a plain 'next chapter' spoken without an imperative", () => {
            expect(detect("next chapter")).toEqual({ type: "chapter_next", phrase: "next chapter" })
        })

        it("detects a plain 'next verse' at the end of what was said", () => {
            expect(detect("and that brings us to the point, next verse")).toEqual({ type: "verse_next", phrase: "next verse" })
        })

        it("detects a plain 'previous chapter'", () => {
            expect(detect("previous chapter")).toEqual({ type: "chapter_previous", phrase: "previous chapter" })
        })

        it("tolerates trailing punctuation on a plain command", () => {
            expect(detect("next verse.")).toEqual({ type: "verse_next", phrase: "next verse" })
        })

        it("detects chapter_previous: 'take me to the previous chapter'", () => {
            expect(detect("take me to the previous chapter")).toEqual({ type: "chapter_previous", phrase: "take me to the previous chapter" })
        })

        it("detects verse_jump with spoken numbers: 'give me verse five'", () => {
            expect(detect("give me verse five")).toEqual({ type: "verse_jump", verse: 5, phrase: "give me verse 5" })
        })

        it("detects chapter_jump: 'show chapter four' and 'show chapter four verse two'", () => {
            expect(detect("show chapter four")).toEqual({ type: "chapter_jump", chapter: 4, phrase: "show chapter 4" })
            expect(detect("show chapter four verse two")).toEqual({ type: "chapter_jump", chapter: 4, verse: 2, phrase: "show chapter 4 verse 2" })
        })

        it("detects translation_cycle: 'give me another translation'", () => {
            expect(detect("give me another translation")).toEqual({ type: "translation_cycle", phrase: "give me another translation" })
            expect(detect("give me a different version")).toEqual({ type: "translation_cycle", phrase: "give me a different version" })
        })

        it("detects a named translation: 'give me niv'", () => {
            expect(detect("give me niv")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "give me niv" })
        })

        it("matches the translation name before or without a translation word", () => {
            expect(detect("switch to the niv version")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "switch to the niv version" })
            expect(detect("give me the king james")).toEqual({ type: "translation", bibleId: "kjv-id", phrase: "give me the king james" })
        })
    })

    describe("other languages", () => {
        it("detects spanish: 'dame el siguiente versículo'", () => {
            expect(detect("dame el siguiente versículo", "es")).toEqual({ type: "verse_next", phrase: "dame el siguiente versículo" })
        })

        it("detects german: 'gib mir den nächsten vers'", () => {
            expect(detect("gib mir den nächsten vers", "de")).toEqual({ type: "verse_next", phrase: "gib mir den nächsten vers" })
        })

        it("still matches english phrases when another language is active", () => {
            expect(detect("go to the next verse", "de")).toEqual({ type: "verse_next", phrase: "go to the next verse" })
        })
    })

    describe("negatives", () => {
        it("requires imperative phrasing: 'in the next verse paul says'", () => {
            expect(detect("in the next verse paul says something amazing")).toBeNull()
        })

        it("ignores narration: 'the previous chapter tells us'", () => {
            expect(detect("the previous chapter tells us about grace")).toBeNull()
        })

        it("ignores narration that ends on the phrase: 'we will see that in the next chapter'", () => {
            expect(detect("we will see that in the next chapter")).toBeNull()
        })

        it("ignores a translation named as narration: 'this is from the king james version'", () => {
            expect(detect("this is from the king james version")).toBeNull()
        })

        it("ignores a bare 'verse five'", () => {
            expect(detect("verse five")).toBeNull()
        })

        it("ignores an imperative without a command noun: 'give me a break'", () => {
            expect(detect("give me a break")).toBeNull()
        })

        it("ignores a translation name mentioned without an imperative", () => {
            expect(detect("i was reading the niv translation this morning and")).toBeNull()
        })

        it("only matches within the most recent speech", () => {
            expect(detect("show chapter four " + "filler words keep on coming here ".repeat(4))).toBeNull()
        })
    })
})

describe("CommandStream", () => {
    const feed = (stream: CommandStream, text: string, endMs: number) => stream.detect({ text, endMs }, "en", TRANSLATIONS)

    it("matches a command split across two utterances ('next' / 'verse')", () => {
        const stream = new CommandStream()
        expect(feed(stream, "Next", 1000)).toBeNull()
        expect(feed(stream, "verse", 1800)).toEqual({ type: "verse_next", phrase: "next verse" })
    })

    it("does not re-fire from stale text when unrelated speech follows", () => {
        const stream = new CommandStream()
        expect(feed(stream, "next chapter", 1000)).toEqual({ type: "chapter_next", phrase: "next chapter" })
        expect(feed(stream, "as we keep reading", 2500)).toBeNull()
    })

    it("fires again when the command is genuinely spoken again", () => {
        const stream = new CommandStream()
        expect(feed(stream, "next verse", 1000)).toEqual({ type: "verse_next", phrase: "next verse" })
        expect(feed(stream, "next verse", 3000)).toEqual({ type: "verse_next", phrase: "next verse" })
    })

    it("drops fragments older than the join window", () => {
        const stream = new CommandStream()
        expect(feed(stream, "Next", 1000)).toBeNull()
        // "verse" arrives too late to belong to the same instruction
        expect(feed(stream, "verse", 9000)).toBeNull()
    })
})
