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

        it("detects verse ranges: 'give me verses 1 to 5' and the connector variants", () => {
            expect(detect("give me verses one to five")).toEqual({ type: "verse_jump", verse: 1, verseEnd: 5, phrase: "give me verses 1 to 5" })
            expect(detect("show verses ten through thirteen")).toEqual({ type: "verse_jump", verse: 10, verseEnd: 13, phrase: "show verses 10 through 13" })
            expect(detect("read verse three till six")).toEqual({ type: "verse_jump", verse: 3, verseEnd: 6, phrase: "read verse 3 till 6" })
        })

        it("detects verse pairs and lists: 'show verse 1 and 2' / 'give me verses 1, 2 and 3'", () => {
            expect(detect("show verse one and two")).toEqual({ type: "verse_jump", verse: 1, verseEnd: 2, phrase: "show verse 1 and 2" })
            expect(detect("give me verses 1, 2 and 3")).toEqual({ type: "verse_jump", verse: 1, verseEnd: 3, phrase: "give me verses 1, 2 and 3" })
        })

        it("detects the 'put together' phrasings, politely too", () => {
            expect(detect("put verses one to five together")).toEqual({ type: "verse_jump", verse: 1, verseEnd: 5, phrase: "put verses 1 to 5 together" })
            expect(detect("can you project verses ten to thirteen together")).toMatchObject({ type: "verse_jump", verse: 10, verseEnd: 13 })
        })

        it("detects bare numbers ONLY with an imperative and a together/on-screen tail", () => {
            expect(detect("project ten to thirteen together")).toMatchObject({ type: "verse_jump", verse: 10, verseEnd: 13 })
            expect(detect("put 1 to 5 on the screen")).toMatchObject({ type: "verse_jump", verse: 1, verseEnd: 5 })
            expect(detect("read 10 to 13")).toBeNull()
        })

        it("detects a chapter jump with a verse range: 'show chapter 4 verses 2 to 5'", () => {
            expect(detect("show chapter four verses two to five")).toEqual({ type: "chapter_jump", chapter: 4, verse: 2, verseEnd: 5, phrase: "show chapter 4 verses 2 to 5" })
        })

        it("extends the live selection: 'add the next verse' / 'include verse six'", () => {
            expect(detect("add the next verse")).toEqual({ type: "verse_add", phrase: "add the next verse" })
            expect(detect("include verse six")).toEqual({ type: "verse_add", verse: 6, phrase: "include verse 6" })
            expect(detect("add verses six and seven")).toEqual({ type: "verse_add", verse: 7, phrase: "add verses 6 and 7" })
        })

        it("an 'and' continuation only extends while ascending ('verse 5 and 2 chronicles' stays verse 5)", () => {
            expect(detect("give me verse five and second")).toMatchObject({ type: "verse_jump", verse: 5 })
            expect(detect("give me verse 5 and 2 chronicles tells us more")).toMatchObject({ type: "verse_jump", verse: 5 })
        })

        it("detects translation_cycle: 'give me another translation'", () => {
            expect(detect("give me another translation")).toEqual({ type: "translation_cycle", phrase: "give me another translation" })
            expect(detect("give me a different version")).toEqual({ type: "translation_cycle", phrase: "give me a different version" })
        })

        it("detects a named translation: 'give me niv'", () => {
            expect(detect("give me niv")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "give me niv" })
        })

        it("detects an announced translation: 'the NIV says' / 'king james puts it this way'", () => {
            expect(detect("the niv says blessed are the meek")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "the niv says" })
            expect(detect("but king james puts it this way")).toEqual({ type: "translation", bibleId: "kjv-id", phrase: "king james puts it this way" })
            expect(detect("the new international version reads")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "the new international version reads" })
            expect(detect("the king james version renders it")).toEqual({ type: "translation", bibleId: "kjv-id", phrase: "the king james version renders it" })
            expect(detect("according to the niv")).toMatchObject({ type: "translation", bibleId: "niv-id" })
            expect(detect("reading from the king james, he restores my soul")).toMatchObject({ type: "translation", bibleId: "kjv-id" })
            expect(detect("in the niv, it says blessed are the meek")).toMatchObject({ type: "translation", bibleId: "niv-id" })
            expect(detect("in the king james version it reads")).toMatchObject({ type: "translation", bibleId: "kjv-id" })
            expect(detect("in the niv we read that god is love")).toMatchObject({ type: "translation", bibleId: "niv-id" })
        })

        it("a bare translation name mid-sentence stays narration", () => {
            expect(detect("the niv is my favorite for study")).toBeNull()
            expect(detect("i grew up on the king james bible at home")).toBeNull()
        })

        it("matches the translation name before or without a translation word", () => {
            expect(detect("switch to the niv version")).toEqual({ type: "translation", bibleId: "niv-id", phrase: "switch to the niv version" })
            expect(detect("give me the king james")).toEqual({ type: "translation", bibleId: "kjv-id", phrase: "give me the king james" })
        })
    })

    describe("misheard verse word (whisper hears 'best'/'this' for 'verse')", () => {
        it("acts on a misheard verse jump: 'give me best five' / 'show me this 5'", () => {
            expect(detect("give me best five")).toEqual({ type: "verse_jump", verse: 5, phrase: "give me best 5" })
            expect(detect("show me this 5")).toEqual({ type: "verse_jump", verse: 5, phrase: "show me this 5" })
        })

        it("acts on misheard relative movement: 'go to the next best'", () => {
            expect(detect("go to the next best")).toEqual({ type: "verse_next", phrase: "go to the next best" })
        })

        it("a misheard verse word never fires without an imperative", () => {
            expect(detect("and that was truly the next best")).toBeNull()
            expect(detect("this five")).toBeNull()
        })

        it("a misheard number jump has to end the utterance - narration keeps talking", () => {
            expect(detect("read this five times every day")).toBeNull()
        })

        it("acts on a homophone verse number: 'give me verse for'", () => {
            expect(detect("give me verse for")).toEqual({ type: "verse_jump", verse: 4, phrase: "give me verse for" })
        })

        it("a homophone number mid-sentence never jumps: 'give me verse for the day'", () => {
            expect(detect("give me verse for the day")).toBeNull()
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

describe("advance announcements while reading", () => {
    it("acts on 'the next verse says' - the preacher is moving on", () => {
        expect(detect("the next verse says")).toEqual({ type: "verse_next", phrase: "the next verse says" })
        expect(detect("and the next verse says that whosoever believeth")).toMatchObject({ type: "verse_next" })
    })

    it("acts even when whisper drops the word 'verse': 'the next says'", () => {
        expect(detect("me. And the next says")).toMatchObject({ type: "verse_next" })
    })

    it("acts on 'the next chapter says'", () => {
        expect(detect("the next chapter says")).toMatchObject({ type: "chapter_next" })
    })

    it("narration keeps talking: a subject or preposition breaks the intent", () => {
        expect(detect("in the next verse paul says something amazing")).toBeNull()
        expect(detect("the next thing he says will surprise you")).toBeNull()
    })
})

describe("CommandStream", () => {
    const feed = (stream: CommandStream, text: string, endMs: number, context?: { anchored?: boolean }) => stream.detect({ text, endMs }, "en", TRANSLATIONS, context)

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

    it("a lone 'next' advances while a passage is live - and only then", () => {
        const anchored = new CommandStream()
        expect(feed(anchored, "Next.", 1000, { anchored: true })).toMatchObject({ type: "verse_next" })

        const unanchored = new CommandStream()
        expect(feed(unanchored, "Next.", 1000)).toBeNull()
    })

    it("'next' inside a sentence is never a command, even while reading", () => {
        const stream = new CommandStream()
        expect(feed(stream, "next week we gather again for the conference", 1000, { anchored: true })).toBeNull()
    })

    it("'another one' right after a translation command cycles again", () => {
        const stream = new CommandStream()
        expect(feed(stream, "give me another translation", 1000)).toMatchObject({ type: "translation_cycle" })
        expect(feed(stream, "another one", 8000)).toMatchObject({ type: "translation_cycle" })
        expect(feed(stream, "one more", 15000)).toMatchObject({ type: "translation_cycle" })
    })

    it("'another one' means nothing without a recent translation command", () => {
        const cold = new CommandStream()
        expect(feed(cold, "another one", 1000)).toBeNull()

        const stale = new CommandStream()
        expect(feed(stale, "give me another translation", 1000)).toMatchObject({ type: "translation_cycle" })
        expect(feed(stale, "another one", 45000)).toBeNull() // the follow-up window has passed
    })
})
