// AI AUTO SCRIPTURE - quote matching: precision regression suite
// Each must-NOT-match case is a structural analog of a real false detection observed live
// (stopword collocations and transcription debris reaching MEDIUM/HIGH); the must-STILL-match
// cases are the recall contract - announced, anchored or continued fragments and mangled
// recitations keep emitting. Verse wording is invented (no copyrighted translation text).

import { beforeEach, describe, expect, it } from "vitest"

import { buildTranslationIndex, type IndexableVerse } from "./quoteMatchIndex"
import { QuoteMatcher } from "./quoteMatcher"
import { tokenGrade, tokenizeTranscript, tokenizeTranscriptWithSpans } from "./quoteMatchTokens"

function verse(book: number, chapter: number, number: number, text: string): IndexableVerse {
    return { book, chapter, verseStart: number, verseEnd: number, cleanText: text }
}

// targets + filler so idf weights behave like a real corpus (rare words exist to be rare)
const CORPUS: IndexableVerse[] = [
    // "are going to inherit salvation" - the Hebrews 1:14 shape (junk 4-gram trap)
    verse(58, 1, 14, "the angels are spirits sent to serve those who are going to inherit salvation"),
    verse(58, 1, 15, "the covenant carries mercy for the households that keep faith through the long night watches"),
    // "dont know whether ... now i see" - the John 9:25 shape (scattered stopword trap)
    verse(43, 9, 25, "i dont know whether he is a sinner one thing i know i was blind and now i see"),
    // completeness/spirit wording - the 1 Thessalonians 5:23 shape (thematic paraphrase trap)
    verse(52, 5, 23, "may the god of peace himself make you completely holy may your spirit soul and body be kept blameless"),
    // long stopword-heavy verse - the Deuteronomy 29:22 shape (floors-path scatter trap)
    verse(5, 29, 22, "the whole land will be like burning waste of salt and sulfur with nothing planted nothing sprouting and no grass growing on it"),
    verse(1, 1, 3, "then the maker spoke and brightness appeared across the whole expanse of the waters"),
    verse(19, 23, 1, "the eternal shepherd tends my soul and nothing remains lacking in my keeping"),
    verse(45, 12, 2, "do not copy this age but be transformed through renewed thinking to discern the good will"),
    verse(50, 4, 13, "every challenge can be handled through the one who supplies my hidden strength"),
    verse(66, 21, 4, "every tear will be wiped away and death will exist no longer nor sorrow nor pain"),
    verse(23, 40, 31, "those waiting on the eternal renew their power rising on wings like great soaring birds"),
    verse(40, 5, 3, "favored are the poor in spirit since the kingdom above belongs to them"),
    verse(40, 5, 4, "favored are those who grieve because comfort will surely find them soon"),
    verse(20, 3, 5, "trust in the eternal with all your heart and lean not on your own understanding")
]

const index = () => buildTranslationIndex("test", CORPUS)

// phrase floors scaled to the fixture corpus's idf range, mirroring the FRAG pattern in
// quoteMatcher.test.ts - the RELATIVE behavior (held junk vs cued/anchored/grown fragments)
// is what these tests pin down
const FRAGP = { PHRASE_MIN_WEIGHT: 9, PHRASE_MIN_PEAK_IDF: 1.6, PHRASE_HIGH_WEIGHT: 14 }

let clock = 0
function seg(text: string, gapMs = 1000): { text: string; startMs: number; endMs: number } {
    const startMs = clock + gapMs
    clock = startMs + 4000
    return { text, startMs, endMs: clock }
}

beforeEach(() => {
    clock = 0
})

describe("isolated short collocations never emit (the false-detection cards)", () => {
    it("holds a conversational 4-gram sharing a verse tail ('are going to inherit')", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        expect(matcher.onSegment(seg("you are going to inherit a lot if you keep this up"))).toEqual([])
        // ring persistence must not turn the hold into sustain-credit emission - the run
        // re-scores identically every segment, so it never "grows" and never emits
        expect(matcher.onSegment(seg("and thats really all im trying to say right now"))).toEqual([])
        expect(matcher.onSegment(seg("you are going to inherit a lot if you keep this up"))).toEqual([])
    })

    it("holds scattered stopwords spanning a verse ('dont know whether ... see')", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        expect(matcher.onSegment(seg("dont know whether im talking to the right community see"))).toEqual([])
        expect(matcher.onSegment(seg("dont know whether im talking to the right community see"))).toEqual([])
    })

    it("keeps conversational scatter with transcription debris away from the floors path", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        expect(matcher.onSegment(seg("you is size six this one is like this this part is like looking at all that so itsly dominated by the fles"))).toEqual([])
        expect(matcher.onSegment(seg("it is all like burning up with nothing growing on it you know"))).toEqual([])
    })

    it("never grades a thematic paraphrase with a truncated rare word as high", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        const out = [...matcher.onSegment(seg("your spir and your flesh your flesha is either completely controlled by his flesh or not")), ...matcher.onSegment(seg("and thats how the spirit and the body work together completely you see"))]
        for (const emission of out) expect(emission.confidence).not.toBe("high")
    })
})

describe("genuine fragments still emit (the recall contract)", () => {
    it("emits an announced fragment immediately (cue path)", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        const out = matcher.onSegment(seg("the bible says you are going to inherit salvation"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 58, chapter: 1, verseStart: 14 })
    })

    it("emits a held fragment once the speaker keeps quoting (growth path)", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        expect(matcher.onSegment(seg("are going to inherit"))).toEqual([])
        const out = matcher.onSegment(seg("are going to inherit salvation"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 58, chapter: 1, verseStart: 14 })
    })

    it("emits a short fragment inside the anchored passage (anchor path)", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        matcher.setAnchor({ bookNumber: 58, chapter: 1, verseStart: 14, verseEnd: 15 })
        const out = matcher.onSegment(seg("you are going to inherit a blessing"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 58, chapter: 1, verseStart: 14 })
    })
})

describe("continuation confidence follows its seed", () => {
    it("a medium emission's continuation stays medium (no auto-projected chain)", () => {
        // MIN_VOTE_WEIGHT scaled down: two rare keys carry ~5.4 vote weight in this small
        // corpus (a real bible's rare keys carry 6+), and the vote stage is not under test here
        const matcher = new QuoteMatcher([index()], { ...FRAGP, MIN_VOTE_WEIGHT: 4 })
        // a light cued 3-word fragment: enough for a MEDIUM phrase emission, well under high
        const first = matcher.onSegment(seg("the bible says going to inherit"))
        expect(first).toHaveLength(1)
        expect(first[0].confidence).toBe("medium")

        // full verbatim recitation of the NEXT verse - the relaxed continuation path fires,
        // but the medium seed must not be laundered into a hardcoded high
        const out = matcher.onSegment(seg("the covenant carries mercy for the households that keep faith through the long night watches"))
        expect(out.length).toBeGreaterThanOrEqual(1)
        expect(out[0]).toMatchObject({ book: 58, chapter: 1, verseStart: 15, kind: "continuation", confidence: "medium" })
    })
})

describe("token-level precision", () => {
    it("rejects 3-char debris tails", () => {
        expect(tokenGrade("its", "itsly")).toBe(0) // "ly" is not a stem tail - transcription debris
        expect(tokenGrade("loo", "look")).toBe(0) // "k" is not a stem tail - a cut word is not a stem
    })

    it("grades the known archaic pairs at 0.8", () => {
        expect(tokenGrade("has", "hast")).toBe(0.8)
        expect(tokenGrade("the", "thee")).toBe(0.8)
        expect(tokenGrade("was", "wast")).toBe(0.8)
        expect(tokenGrade("day", "days")).toBe(0.8)
    })

    it("round-trips raw spans through the transcript tokenizer", () => {
        const text = "Don't say 5 things, José!"
        const spanned = tokenizeTranscriptWithSpans(text)
        expect(spanned.map((entry) => entry.token)).toEqual(["dont", "say", "five", "things", "jose"])
        expect(spanned.map((entry) => text.slice(entry.from, entry.to))).toEqual(["Don't", "say", "5", "things", "José"])
        expect(tokenizeTranscript(text)).toEqual(spanned.map((entry) => entry.token))
    })

    it("quotes the words as spoken, not normalized token soup", () => {
        const matcher = new QuoteMatcher([index()], FRAGP)
        const out = matcher.onSegment(seg("The Bible says you are going to inherit Salvation!"))
        expect(out).toHaveLength(1)
        // phrase-only evidence quotes the run itself, raw casing intact - not the scatter span
        expect(out[0].quoteText).toBe("are going to inherit Salvation")
    })
})
