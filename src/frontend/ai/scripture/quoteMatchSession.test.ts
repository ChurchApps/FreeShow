import { beforeEach, describe, expect, it, vi } from "vitest"

// the session module reads svelte stores - stub them so the lifecycle can run in node
const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return {
            _set: (next: unknown) => (value = next),
            subscribe: (fn: (v: unknown) => void) => (fn(value), () => {})
        }
    }
    return {
        scriptures: makeStore({}),
        scripturesCache: makeStore({}),
        ai: makeStore({}),
        aiQuoteMatchActive: { ...makeStore(false), set: () => {} }
    }
})
vi.mock("../../stores", () => ({ scriptures: h.scriptures, scripturesCache: h.scripturesCache, ai: h.ai, aiQuoteMatchActive: h.aiQuoteMatchActive }))

import { bookNameFor, handleQuoteMatchTranscript, noteExplicitDetection, setQuoteMatchAnchor, startQuoteMatching, stopQuoteMatching } from "./quoteMatchSession"

const BIBLE = {
    name: "KJV",
    books: [
        {
            number: 43,
            name: "John",
            chapters: [
                {
                    number: 3,
                    verses: [
                        { number: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
                        { number: 17, text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved." }
                    ]
                }
            ]
        },
        {
            number: 45,
            name: "Romans",
            chapters: [{ number: 8, verses: [{ number: 28, text: "And we know that all things work together for good to them that love God, to them that are the called according to his purpose." }] }]
        },
        {
            // filler so the fixture's idf weights behave like a real translation (public-domain KJV)
            number: 19,
            name: "Psalms",
            chapters: [
                {
                    number: 23,
                    verses: [
                        { number: 1, text: "The LORD is my shepherd; I shall not want." },
                        { number: 2, text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
                        { number: 3, text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
                        { number: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
                        { number: 5, text: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over." },
                        { number: 6, text: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever." }
                    ]
                }
            ]
        },
        {
            number: 1,
            name: "Genesis",
            chapters: [
                {
                    number: 1,
                    verses: [
                        { number: 1, text: "In the beginning God created the heaven and the earth." },
                        { number: 2, text: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters." },
                        { number: 3, text: "And God said, Let there be light: and there was light." }
                    ]
                }
            ]
        }
    ]
}

const JOHN_316 = "for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life"

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

let clock = 0
function seg(text: string, extra: { language?: string; music?: boolean } = {}) {
    const startMs = clock + 1000
    clock = startMs + 4000
    return { text, startMs, endMs: clock, ...extra }
}

describe("quoteMatchSession", () => {
    let detections: any[]

    beforeEach(() => {
        stopQuoteMatching()
        clock = 0
        detections = []
        h.scriptures._set({ kjv: { name: "KJV" } })
        h.scripturesCache._set({ kjv: BIBLE })
        h.ai._set({ scripture: {} })
    })

    function start(overrides: Partial<{ interpretationMode: boolean; listenLanguage: string; bibleIds: string[] }> = {}) {
        startQuoteMatching({
            bibleIds: overrides.bibleIds ?? ["kjv"],
            interpretationMode: overrides.interpretationMode ?? false,
            listenLanguage: overrides.listenLanguage,
            onDetection: (ref) => detections.push(ref)
        })
    }

    it("detects a recitation and reports a fully-formed quoted reference", async () => {
        start()
        await flush()
        handleQuoteMatchTranscript(seg(JOHN_316))

        expect(detections).toHaveLength(1)
        expect(detections[0]).toMatchObject({ book: "John", bookNumber: 43, chapter: 3, verseStart: 16, type: "quoted", source: "local", matchedBibleId: "kjv", confidence: "high" })
        expect(detections[0].id.startsWith("aiq-")).toBe(true)
        expect(detections[0].quote).toContain("god so loved")
    })

    it("buffers segments that arrive while indexes are building, then flushes", async () => {
        start()
        handleQuoteMatchTranscript(seg(JOHN_316)) // before the build resolves
        expect(detections).toHaveLength(0)
        await flush()
        expect(detections).toHaveLength(1)
    })

    it("marks continuations so follow-along can bypass the quoted auto-projection gate", async () => {
        start()
        await flush()
        handleQuoteMatchTranscript(seg(JOHN_316))
        handleQuoteMatchTranscript(seg("for god sent not his son into the world to condemn the world but that the world through him might be saved"))

        const continuation = detections.find((ref) => ref.verseStart === 17)
        expect(continuation).toBeDefined()
        expect(continuation.continuation).toBe(true)
        expect(detections[0].continuation).toBeUndefined()
    })

    it("skips music segments and wrong-language segments in interpretation mode", async () => {
        start({ interpretationMode: true, listenLanguage: "en" })
        await flush()
        handleQuoteMatchTranscript(seg(JOHN_316, { music: true }))
        handleQuoteMatchTranscript(seg(JOHN_316, { language: "fr" }))
        expect(detections).toHaveLength(0)

        // matching language (and segments without a language guess) pass
        handleQuoteMatchTranscript(seg(JOHN_316, { language: "en" }))
        expect(detections).toHaveLength(1)
    })

    it("stops matching when the setting is turned off mid-session", async () => {
        start()
        await flush()
        h.ai._set({ scripture: { quoteMatching: false } })
        handleQuoteMatchTranscript(seg(JOHN_316))
        expect(detections).toHaveLength(0)
    })

    it("does nothing when only API bibles are selected", async () => {
        h.scriptures._set({ kjv: { name: "KJV", api: true } })
        start()
        await flush()
        handleQuoteMatchTranscript(seg(JOHN_316))
        expect(detections).toHaveLength(0)
    })

    it("discards a superseded start", async () => {
        start()
        stopQuoteMatching()
        await flush()
        handleQuoteMatchTranscript(seg(JOHN_316))
        expect(detections).toHaveLength(0)
    })

    it("routes the anchor and explicit-reference seeds without a session error", async () => {
        start()
        await flush()
        setQuoteMatchAnchor({ bookNumber: 45, chapter: 8, verseStart: 28, verseEnd: 28 })
        noteExplicitDetection({ id: "x", book: "Romans", bookNumber: 45, chapter: 8, verseStart: 28, verseEnd: 28, confidence: "high", type: "explicit", source: "regex", timestamp: 0 })

        handleQuoteMatchTranscript(seg("all things work together for good to them that love god"))
        handleQuoteMatchTranscript(seg("to them that are the called according to his purpose"))
        expect(detections.length).toBeGreaterThanOrEqual(1)
        expect(detections[0]).toMatchObject({ bookNumber: 45, chapter: 8, verseStart: 28 })
    })
})

describe("bookNameFor", () => {
    it("prefers the cached translation's own book name", () => {
        h.scripturesCache._set({ kjv: BIBLE })
        expect(bookNameFor("kjv", 43)).toBe("John")
    })

    it("falls back to the canon name when the translation's book list is not cached", () => {
        // a bare "40" as the book NAME sent a Matthew match through a fuzzy book search
        // downstream and projected Proverbs - the name must stay a NAME
        h.scripturesCache._set({})
        expect(bookNameFor("msg", 40)).toBe("Matthew")
        expect(bookNameFor("msg", 53)).toBe("2 Thessalonians")
        expect(bookNameFor("msg", 66)).toBe("Revelation")
    })
})
