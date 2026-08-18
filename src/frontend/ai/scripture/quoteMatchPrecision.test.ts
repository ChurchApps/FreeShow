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

describe("liturgical formulas never emit on repetition", () => {
    // the formula corpus: the same prayer phrase lives in THREE verses (as it does in acts),
    // plus a verse it uniquely continues into. Shaped like a real bible so these tests run
    // PRODUCTION tuning: heavy filler stretches the idf range (informative bar at the absolute
    // 3.0) and carries the common function words (in/of/we/every stay stopwords); the formula
    // verses sit in canon order with benign neighbors, so no spill window contains another
    // formula verse's text
    const FORMULA_CORPUS: IndexableVerse[] = [
        ...CORPUS,
        verse(44, 3, 6, "in the name of jesus christ of nazareth rise up and walk among the people rejoicing"),
        verse(44, 3, 7, "and he took him by the right hand and lifted him and his feet received strength"),
        verse(44, 4, 10, "know this by the name of jesus christ the nazarene whom you crucified this man stands healed"),
        verse(44, 4, 11, "he is the stone that was rejected by you the builders which has become the cornerstone"),
        verse(44, 10, 48, "so he commanded them to be baptized in the name of jesus christ then they asked him to stay"),
        verse(44, 10, 49, "and they remained there together for certain days sharing every meal we could offer them"),
        ...Array.from({ length: 400 }, (_, i) => verse(4, (i % 36) + 1, Math.floor(i / 36) + 2, `wilderness marker${i} rests in the shade of the ancient wells and every flock${i} we tend draws steady water in the heat of the day`))
    ]

    it("holds 'in the name of jesus christ' however often the prayer repeats it", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", FORMULA_CORPUS)])
        expect(matcher.onSegment(seg("we break every chain in the name of jesus christ"))).toEqual([])
        expect(matcher.onSegment(seg("we declare victory in the name of jesus christ amen"))).toEqual([])
        expect(matcher.onSegment(seg("in the name of jesus christ we pray"))).toEqual([])
    })

    it("emits once the speaker continues into one specific verse (one confirming segment later)", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", FORMULA_CORPUS)])
        expect(matcher.onSegment(seg("in the name of jesus christ"))).toEqual([])
        // the recitation begins - held one segment (the speaker was praying moments ago)...
        expect(matcher.onSegment(seg("in the name of jesus christ of nazareth rise up and walk"))).toEqual([])
        // ...and lands as it continues
        const out = matcher.onSegment(seg("rise up and walk among the people rejoicing"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 44, chapter: 3, verseStart: 6 })
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

describe("grounded main translation & passage memory", () => {
    // the second translation shares most verses word-for-word, but words ITS Hebrews verse differently
    const ALT_CORPUS: IndexableVerse[] = CORPUS.map((entry) => (entry.book === 58 && entry.verseStart === 14 ? verse(58, 1, 14, "the angels serve as couriers dispatched toward the heirs awaiting rescue soon arriving") : entry))

    it("a wording both translations share stays grounded in the main (first-indexed) translation", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("main", CORPUS), buildTranslationIndex("alt", CORPUS)], FRAGP)
        const out = matcher.onSegment(seg("the angels are spirits sent to serve those who are going to inherit salvation"))
        expect(out).toHaveLength(1)
        expect(out[0].translationId).toBe("main")
    })

    it("a wording only the other translation carries surfaces that translation", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("main", CORPUS), buildTranslationIndex("alt", ALT_CORPUS)], FRAGP)
        const out = matcher.onSegment(seg("the angels serve as couriers dispatched toward the heirs awaiting rescue soon arriving"))
        expect(out).toHaveLength(1)
        expect(out[0].translationId).toBe("alt")
    })

    it("emissions and spoken references feed the passage memory", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", CORPUS)], FRAGP)
        matcher.onSegment(seg("the angels are spirits sent to serve those who are going to inherit salvation"))
        expect((matcher as any).passageMemory[0]).toMatchObject({ book: 58, chapter: 1 })

        matcher.noteExplicitReference({ bookNumber: 19, chapter: 23, verseStart: 1 })
        expect((matcher as any).passageMemory[0]).toMatchObject({ book: 19, chapter: 23 })
        // both stay remembered - the memory holds several recent passages
        expect((matcher as any).passageMemory).toHaveLength(2)
    })
})

describe("sound-alike words still find their verse", () => {
    // bible-shaped corpus (production tuning): the idf-stretching filler from the formula tests
    const HOMOPHONE_CORPUS: IndexableVerse[] = [
        ...CORPUS,
        verse(52, 5, 16, "rejoice evermore and again in everything i say rejoice always"),
        verse(52, 5, 17, "pray without ceasing for this is the will of god concerning all of you"),
        verse(19, 23, 5, "thou preparest a table before me in the presence of mine enemies my cup runneth over"),
        ...Array.from({ length: 400 }, (_, i) => verse(4, (i % 36) + 1, Math.floor(i / 36) + 2, `wilderness marker${i} rests in the shade of the ancient wells and every flock${i} we tend draws steady water in the heat of the day`))
    ]

    it("matches 'pray without season' to 'pray without ceasing' (cued)", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", HOMOPHONE_CORPUS)])
        const out = matcher.onSegment(seg("the bible says to pray without season"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 52, chapter: 5, verseStart: 17 })
    })

    it("never lets conversational 'season' talk match anything", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", HOMOPHONE_CORPUS)])
        expect(matcher.onSegment(seg("the season of harvest is upon us and we rejoice in it"))).toEqual([])
    })

    it("matches a modern-pronoun recitation of KJV wording (psalm 23:5)", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", HOMOPHONE_CORPUS)])
        // you/thou and my/mine break the run's edges - the long middle run must carry it
        const out = matcher.onSegment(seg("you prepare a table before me in the presence of my enemies"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 19, chapter: 23, verseStart: 5 })
    })
})

describe("a decisive cross-book reading beats anchored residue", () => {
    // twins: the anchored book's verse shares the reading's opening, the real verse continues
    // distinctively - the previous passage's words linger in the window and keep its verses
    // floors-passing, which must never bury a new reading that fully classifies
    const TWIN_CORPUS: IndexableVerse[] = [
        ...CORPUS,
        verse(4, 1, 60, "the faithful servant rises before dawn and gathers stones for the wall by the eastern gate"),
        verse(19, 5, 9, "the faithful servant rises before dawn and gathers scattered wisdom beside the temple lampstand until the morning watch returns"),
        ...Array.from({ length: 400 }, (_, i) => verse(4, (i % 36) + 1, Math.floor(i / 36) + 2, `wilderness marker${i} rests in the shade of the ancient wells and every flock${i} we tend draws steady water in the heat of the day`))
    ]

    it("emits the fully-recited verse, not the anchored look-alike", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("test", TWIN_CORPUS)])
        matcher.setAnchor({ bookNumber: 4, chapter: 1, verseStart: 60, verseEnd: 60 })
        const out = matcher.onSegment(seg("the faithful servant rises before dawn and gathers scattered wisdom beside the temple lampstand until the morning watch returns"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 19, chapter: 5, verseStart: 9 })
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
