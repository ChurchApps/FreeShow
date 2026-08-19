import { beforeEach, describe, expect, it } from "vitest"

import { buildTranslationIndex, type IndexableVerse } from "./quoteMatchIndex"
import { QuoteMatcher, type QuoteMatchEmission } from "./quoteMatcher"

function verse(book: number, chapter: number, number: number, text: string): IndexableVerse {
    return { book, chapter, verseStart: number, verseEnd: number, cleanText: text }
}

// public-domain KJV text; the parallel Matthew/Mark pair is the anchor-hysteresis fixture
const KJV: IndexableVerse[] = [
    verse(40, 9, 5, "For whether is easier, to say, Thy sins be forgiven thee; or to say, Arise, and walk?"),
    verse(40, 9, 6, "But that ye may know that the Son of man hath power on earth to forgive sins, (then saith he to the sick of the palsy,) Arise, take up thy bed, and go unto thine house."),
    verse(40, 9, 7, "And he arose, and departed to his house."),
    verse(41, 2, 11, "I say unto thee, Arise, and take up thy bed, and go thy way into thine house."),
    verse(43, 3, 16, "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."),
    verse(43, 3, 17, "For God sent not his Son into the world to condemn the world; but that the world through him might be saved."),
    verse(43, 3, 18, "He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God."),
    verse(43, 3, 19, "And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil."),
    verse(19, 23, 1, "The LORD is my shepherd; I shall not want."),
    verse(45, 8, 28, "And we know that all things work together for good to them that love God, to them that are the called according to his purpose."),
    verse(1, 1, 1, "In the beginning God created the heaven and the earth.")
]

// invented wording (deliberately divergent, NOT any real translation) for multi-translation tests;
// the filler verses give the index enough corpus for idf weights to behave like a real translation
const SIM: IndexableVerse[] = [
    verse(43, 3, 16, "Because God treasured the planet deeply, he offered his single cherished child, so each person trusting him escapes ruin and receives unending existence."),
    verse(19, 23, 1, "The Eternal One tends me like a flock keeper; nothing remains lacking."),
    verse(1, 1, 1, "At the outset God shaped the skies and the ground below them."),
    verse(1, 1, 2, "The ground lay empty and unformed while darkness covered the deep waters everywhere."),
    verse(1, 1, 3, "Then God spoke and brightness appeared across the whole expanse."),
    verse(40, 5, 3, "Favored are the poor in spirit since the kingdom above belongs to them."),
    verse(40, 5, 4, "Favored are those who grieve because comfort will surely find them."),
    verse(45, 12, 1, "Therefore friends present your bodies as living offerings holy and pleasing which is true worship."),
    verse(45, 12, 2, "Do not copy this age but be transformed through renewed thinking to discern the good will."),
    verse(50, 4, 13, "Every challenge can be handled through the one who supplies my strength."),
    verse(66, 21, 4, "Every tear will be wiped away and death will exist no longer nor sorrow nor pain."),
    verse(23, 40, 31, "Those waiting on the Eternal renew their power rising on wings like great soaring birds.")
]

const kjvIndex = () => buildTranslationIndex("kjv", KJV)
const simIndex = () => buildTranslationIndex("sim", SIM)

let clock = 0
function seg(text: string, gapMs = 1000): { text: string; startMs: number; endMs: number } {
    const startMs = clock + gapMs
    clock = startMs + 4000
    return { text, startMs, endMs: clock }
}

beforeEach(() => {
    clock = 0
})

const JOHN_316 = "for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life"

describe("QuoteMatcher", () => {
    it("emits a full recitation from a single utterance", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const out = matcher.onSegment(seg(JOHN_316))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16, confidence: "high", translationId: "kjv", kind: "fresh" })
    })

    it("emits an ASR-mangled recitation", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const out = matcher.onSegment(seg("for god so loved the world that he gave his only forgotten son that whosoever believe in him should not perish but have everlasting life"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16 })
    })

    it("does not emit for a short coincidental overlap", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        expect(matcher.onSegment(seg("for god so loved you this morning church"))).toEqual([])
    })

    it("does not emit for ordinary sermon speech", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        expect(matcher.onSegment(seg("we are so glad you came to church this morning and we hope you feel welcome here"))).toEqual([])
        expect(matcher.onSegment(seg("the lord has been good to us this week and we give him praise for everything"))).toEqual([])
    })

    it("accumulates a recitation dripped over several segments (sustained path)", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const first = matcher.onSegment(seg("for god so loved the world"))
        const second = matcher.onSegment(seg("that he gave his only begotten son"))
        const third = matcher.onSegment(seg("that whosoever believeth in him should not perish"))
        const all = [...first, ...second, ...third]
        expect(all.length).toBeGreaterThanOrEqual(1)
        expect(all[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16 })
    })

    it("follows a recitation into the next verse (continuation)", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const first = matcher.onSegment(seg(JOHN_316))
        expect(first).toHaveLength(1)

        const second = matcher.onSegment(seg("for god sent not his son into the world to condemn the world but that the world through him might be saved"))
        const continuation = second.find((emission) => emission.verseStart === 17)
        expect(continuation).toBeDefined()
        expect(continuation!.kind).toBe("continuation")
        expect(continuation!.confidence).toBe("high")
    })

    it("does not continue into the next verse from ordinary speech", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.onSegment(seg(JOHN_316))
        const after = matcher.onSegment(seg("what a wonderful promise that is for every one of us here today"))
        expect(after.find((emission) => emission.verseStart === 17)).toBeUndefined()
    })

    it("expires the tracker after silence and does not continue", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.onSegment(seg(JOHN_316))
        // 30s of nothing - tracker TTL (20s) passes, and the gap also clears the ring
        const after = matcher.onSegment(seg("for god sent not his son into the world to condemn the world but that the world through him might be saved", 30000))
        const continuation = after.find((emission) => emission.kind === "continuation")
        expect(continuation).toBeUndefined()
    })

    it("does not re-emit the same verse while the ledger holds it", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        expect(matcher.onSegment(seg(JOHN_316))).toHaveLength(1)
        expect(matcher.onSegment(seg(JOHN_316))).toEqual([])
    })

    it("keeps a recitation inside the anchored chapter over a parallel passage (AlloDel rule)", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.setAnchor({ bookNumber: 40, chapter: 9, verseStart: 5, verseEnd: 5 })
        // wording nearly identical between Matthew 9:6 and Mark 2:11
        const out = matcher.onSegment(seg("arise take up thy bed and go unto thine house"))
        if (out.length) {
            expect(out[0].book).toBe(40)
            expect(out[0].chapter).toBe(9)
        }
        const sustained = matcher.onSegment(seg("arise take up thy bed and go unto thine house"))
        const emitted = [...out, ...sustained]
        expect(emitted.length).toBeGreaterThanOrEqual(1)
        expect(emitted.every((emission) => emission.book === 40)).toBe(true)
    })

    it("emits exactly one reference for a parallel passage without an anchor", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const first = matcher.onSegment(seg("arise take up thy bed and go unto thine house"))
        const second = matcher.onSegment(seg("arise take up thy bed and go unto thine house"))
        expect([...first, ...second].length).toBe(1)
    })

    it("matches through a divergent translation and reports it", () => {
        const matcher = new QuoteMatcher([kjvIndex(), simIndex()])
        const out = matcher.onSegment(seg("because god treasured the planet deeply he offered his single cherished child so each person trusting him escapes ruin"))
        expect(out).toHaveLength(1)
        expect(out[0].translationId).toBe("sim")
        expect(out[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16 })
    })

    it("seeds the announced reference so a following partial recitation lands (tier-1 seeding)", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.noteExplicitReference({ bookNumber: 45, chapter: 8, verseStart: 28 })
        const first = matcher.onSegment(seg("all things work together for good to them that love god"))
        const second = matcher.onSegment(seg("to them that are the called according to his purpose"))
        const all = [...first, ...second]
        expect(all.length).toBeGreaterThanOrEqual(1)
        expect(all[0]).toMatchObject({ book: 45, chapter: 8, verseStart: 28 })
    })

    it("clears all state on reset", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.onSegment(seg(JOHN_316))
        matcher.reset()
        // ledger cleared: the same recitation emits again
        expect(matcher.onSegment(seg(JOHN_316, 30000))).toHaveLength(1)
    })

    it("carries the matched transcript stretch in the emission", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const out = matcher.onSegment(seg(JOHN_316))
        expect(out[0].quoteText).toContain("god so loved")
    })

    it("reports only the verse being read even when the recitation spills onward", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        const first = matcher.onSegment(seg("for god so loved the world that he gave his only begotten son"))
        const second = matcher.onSegment(seg("that whosoever believeth in him should not perish but have everlasting life for god sent not his son into the world to condemn the world"))
        const all = [...first, ...second]
        const start = all.find((emission) => emission.verseStart === 16)
        expect(start).toBeDefined()
        expect(all.every((emission) => emission.verseEnd === emission.verseStart)).toBe(true)
    })

    // an invented three-verse passage with distinctive vocabulary, so each verse clears the
    // floors on its own (filler verses give the idf weights a realistic spread)
    const CHAIN: IndexableVerse[] = [
        verse(30, 2, 1, "the watchman climbed the granite tower counting distant ships at anchor"),
        verse(30, 2, 2, "silver trumpets sounded from the harbor calling weary sailors homeward"),
        verse(30, 2, 3, "lanterns flickered along the pier while merchants counted copper coins"),
        verse(30, 4, 1, "rain swept the terraced hills and the shepherds sought shelter"),
        verse(30, 4, 2, "the potter shaped red clay while the wheel spun beneath his hands"),
        verse(30, 5, 1, "grain merchants weighed their measures against the honest stone"),
        verse(30, 5, 2, "the vineyard keeper pruned the branches before the autumn rains"),
        verse(30, 6, 1, "smoke rose from the evening fires as the city gates were closed")
    ]

    it("follows a multi-verse reading one verse at a time", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", CHAIN)])
        const first = matcher.onSegment(seg("the watchman climbed the granite tower"))
        const second = matcher.onSegment(seg("counting distant ships at anchor"))
        const third = matcher.onSegment(seg("silver trumpets sounded from the harbor calling weary sailors homeward"))
        const fourth = matcher.onSegment(seg("lanterns flickered along the pier while merchants counted copper coins"))
        const all = [...first, ...second, ...third, ...fourth]

        expect(all.map((emission) => emission.verseStart)).toEqual([1, 2, 3])
        expect(all.every((emission) => emission.book === 30 && emission.chapter === 2 && emission.verseStart === emission.verseEnd)).toBe(true)
        expect(all[1].kind).toBe("continuation")
        expect(all[2].kind).toBe("continuation")
    })

    it("never jumps backwards to a verse the reading already passed", () => {
        // single-shot lowered so every full verse emits immediately - isolates the direction rule
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", CHAIN)], { SINGLE_SHOT_INFORMATIVE: 5, SINGLE_SHOT_WEIGHT: 10 })
        const first = matcher.onSegment(seg("silver trumpets sounded from the harbor calling weary sailors homeward"))
        expect(first.map((emission) => emission.verseStart)).toEqual([2])

        // verse 1's words arrive late (window echo / spill contamination): the projection must not move back
        expect(matcher.onSegment(seg("the watchman climbed the granite tower counting distant ships at anchor"))).toEqual([])

        const third = matcher.onSegment(seg("lanterns flickered along the pier while merchants counted copper coins"))
        expect(third.map((emission) => emission.verseStart)).toEqual([3])
    })

    it("emits on the first floor-passing segment when earlier weak segments already pointed there (sustain credit)", () => {
        const matcher = new QuoteMatcher([kjvIndex()], noSingleShot)
        expect(matcher.onSegment(seg("for god so loved the world that he gave his only begotten"))).toEqual([])
        const second = matcher.onSegment(seg("son that whosoever believeth in him should not perish but have everlasting life"))
        expect(second).toHaveLength(1)
        expect(second[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16 })
    })

    // single-shot disabled so these tests isolate the cue-vs-sustain decision
    const noSingleShot = { SINGLE_SHOT_INFORMATIVE: 99, SINGLE_SHOT_WEIGHT: 999 }
    const HALF_ROMANS = "and we know that all things work together for good to them that love god"

    it("skips the sustain wait after a spoken quote cue", () => {
        const uncued = new QuoteMatcher([kjvIndex()], noSingleShot)
        expect(uncued.onSegment(seg(HALF_ROMANS))).toEqual([])

        clock = 0
        const cued = new QuoteMatcher([kjvIndex()], noSingleShot)
        cued.onSegment(seg("but paul said something we all need to hear"))
        const out = cued.onSegment(seg(HALF_ROMANS))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 45, chapter: 8, verseStart: 28 })
    })

    it("a cue never turns ordinary speech into a detection (floors still apply)", () => {
        const matcher = new QuoteMatcher([kjvIndex()])
        matcher.onSegment(seg("the bible says so much about how we should live"))
        expect(matcher.onSegment(seg("we should love one another and be kind to everybody we meet"))).toEqual([])
    })

    it("the cue expires", () => {
        const matcher = new QuoteMatcher([kjvIndex()], noSingleShot)
        matcher.onSegment(seg("jesus said many things during his ministry"))
        // 20s later the cue window (12s) has passed - back to the sustained path
        expect(matcher.onSegment(seg(HALF_ROMANS, 20000))).toEqual([])
    })
})

describe("QuoteMatcher short fragments", () => {
    // the production phrase floors are calibrated against a full bible's idf range - fixture
    // corpora scale them down so every mechanism (run detection, peak floor, rival wait,
    // bigram surfacing) is still exercised
    const FRAG = { PHRASE_MIN_WEIGHT: 9, PHRASE_MIN_PEAK_IDF: 1.6, PHRASE_HIGH_WEIGHT: 14 }

    it("a short distinctive fragment fires without the rest of the verse", () => {
        const matcher = new QuoteMatcher([kjvIndex()], FRAG)
        const out = matcher.onSegment(seg("that whosoever believeth in him should not perish"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 43, chapter: 3, verseStart: 16 })
    })

    it("a fragment two verses share waits instead of guessing", () => {
        const matcher = new QuoteMatcher([kjvIndex()], FRAG)
        // near-identical in Matthew 9:6 and Mark 2:11 - ambiguous, so one segment must not emit
        expect(matcher.onSegment(seg("arise take up thy bed"))).toEqual([])
    })

    it("all-common words with no distinctive peak stay silent", () => {
        const PLAIN: IndexableVerse[] = [verse(1, 1, 1, "and he said it was good and it was so"), verse(1, 2, 1, "he said the work was good and so it stood"), verse(1, 3, 1, "it was said among them that all he made was good"), verse(1, 4, 1, "and so it was that he said all of it was good"), verse(1, 5, 1, "they said it was so and he saw all was good")]
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", PLAIN)], FRAG)
        expect(matcher.onSegment(seg("and he said it was good"))).toEqual([])
    })

    it("word PAIRS surface a verse whose words are all too common to vote alone (bigram route)", () => {
        const COMMON: IndexableVerse[] = [verse(1, 1, 1, "and the light was good and the day came"), verse(1, 1, 2, "and the day was long and the light stayed"), verse(1, 1, 3, "and the light was called day by them all"), verse(1, 1, 4, "and the day was ending when the light left"), verse(1, 1, 5, "and the light was there when the day broke"), verse(1, 1, 6, "so the day and the light belong together")]
        const index = buildTranslationIndex("kjv", COMMON, undefined, { bigrams: true })
        // phrase floors scaled down like the others: "the" carries idf 0 in this corpus
        // (present in every verse) so the aligned run is 4, and the run's recorded stretch ends
        // at "ending" (the only word above the edge idf) so it holds a single peak - this test
        // exercises the bigram VOTE route, not the isolated/thin-run holds
        const matcher = new QuoteMatcher([index], { ...FRAG, PHRASE_MIN_WEIGHT: 6, PHRASE_MIN_PEAK_IDF: 1, PHRASE_SHOT_MIN_RUN: 4, PHRASE_SHOT_MIN_PEAKS: 1 })
        const out = matcher.onSegment(seg("the day was ending when"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 1, chapter: 1, verseStart: 4 })
    })
})

describe("QuoteMatcher corrections", () => {
    // an invented cross-book twin pair: identical opening, diverging tails (the similar-passage
    // trap), with filler corpus so idf weights behave
    const TWIN: IndexableVerse[] = [
        verse(19, 5, 9, "the faithful servant rises before dawn and quietly gathers scattered wheat across the eastern field while the master sleeps"),
        verse(45, 2, 4, "the faithful servant rises before dawn and quietly gathers scattered wisdom beside the temple lampstand until the morning watch returns"),
        verse(19, 7, 2, "sing praises with the harp and lift a joyful sound to heaven"),
        verse(19, 9, 3, "the mountains tremble when thunder rolls across the mighty waters"),
        verse(45, 6, 1, "walk in kindness bearing one another through every trial and sorrow"),
        verse(45, 9, 8, "hope endures beyond the grave because mercy triumphs over judgment"),
        verse(66, 2, 5, "a lamp burns bright upon the golden stand giving light to the house"),
        verse(66, 4, 7, "rivers of living water flow from the throne renewing the weary lands"),
        verse(40, 3, 1, "a voice cries out prepare the way and make the paths straight"),
        verse(41, 5, 6, "the storm obeyed his word and a great calm settled over the sea"),
        verse(42, 8, 2, "seed fell among thorns and the cares of riches choked the growing plant"),
        verse(44, 12, 3, "chains fell away as the messenger led him past the sleeping guards")
    ]
    const twinIndex = () => buildTranslationIndex("kjv", TWIN)

    it("corrects a similar-passage mispick once later words settle it", () => {
        const matcher = new QuoteMatcher([twinIndex()])
        // the shared opening is all the matcher can see - it fires the first twin
        const first = matcher.onSegment(seg("the faithful servant rises before dawn"))
        const second = matcher.onSegment(seg("and quietly gathers scattered"))
        // the tail belongs to the OTHER twin: the mispick must be superseded
        const third = matcher.onSegment(seg("wisdom beside the temple lampstand until the"))
        const fourth = matcher.onSegment(seg("morning watch returns"))
        const all = [...first, ...second, ...third, ...fourth]

        const initial = all.find((emission) => emission.book === 19)
        expect(initial).toBeDefined()
        expect(initial!.kind).toBe("fresh")

        const correction = all.find((emission) => emission.kind === "correction")
        expect(correction).toBeDefined()
        expect(correction!).toMatchObject({ book: 45, chapter: 2, verseStart: 4, confidence: "high" })
        expect(correction!.corrects).toMatchObject({ book: 19, chapter: 5, verseStart: 9 })
    })

    it("a genuinely new quote after a finished one is fresh, not a correction", () => {
        const matcher = new QuoteMatcher([twinIndex()])
        matcher.onSegment(seg("the faithful servant rises before dawn and quietly gathers scattered wheat"))
        matcher.onSegment(seg("across the eastern field while the master sleeps"))
        // long gap: the first quote's speech has aged out of the window entirely
        const later = [...matcher.onSegment(seg("rivers of living water flow from the throne renewing the weary lands", 30000)), ...matcher.onSegment(seg("rivers of living water flow from the throne renewing the weary lands"))]
        expect(later.length).toBeGreaterThanOrEqual(1)
        for (const emission of later) expect(emission.kind).not.toBe("correction")
    })
})

describe("QuoteMatcher verbatim continuation", () => {
    // the next verse is all common words (a real trap: "And God said, Let there be light...") -
    // the filler corpus makes every token of verse 2 common enough to carry no informative weight
    const PLAIN: IndexableVerse[] = [
        verse(1, 1, 1, "the maker fashioned every quiet river crossing the silver valley floor"),
        verse(1, 1, 2, "and he said it was good and it was so"),
        verse(1, 2, 1, "he said the work was good and so it stood"),
        verse(1, 2, 2, "it was said among them that all he made was good"),
        verse(1, 3, 1, "and so it was that he said all of it was good"),
        verse(1, 3, 2, "they said it was so and he saw all was good"),
        verse(1, 4, 1, "so he said it was good and it was full of light")
    ]

    it("continues into an all-common-words next verse recited start to end", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", PLAIN)])
        matcher.onSegment(seg("the maker fashioned every quiet river"))
        const first = matcher.onSegment(seg("crossing the silver valley floor"))
        expect(first).toHaveLength(1)
        expect(first[0].verseStart).toBe(1)

        const second = matcher.onSegment(seg("and he said it was good and it was so"))
        const continuation = second.find((emission) => emission.kind === "continuation")
        expect(continuation).toBeDefined()
        expect(continuation!.verseStart).toBe(2)
    })

    it("does not treat scattered common words as a verbatim continuation", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", PLAIN)])
        matcher.onSegment(seg("the maker fashioned every quiet river"))
        expect(matcher.onSegment(seg("crossing the silver valley floor"))).toHaveLength(1)
        // ordinary speech sharing a few words with verse 2, nowhere near a full recitation
        const after = matcher.onSegment(seg("and i think he was a good man in every way"))
        expect(after.find((emission) => emission.kind === "continuation")).toBeUndefined()
    })
})

describe("phonetic recovery end to end", () => {
    // KJV corpus plus 1 Samuel 15:18, whose rare name is the target of the mangling
    const SAMUEL_KJV: IndexableVerse[] = [...KJV, verse(9, 15, 18, "And the LORD sent thee on a journey, and said, Go and utterly destroy the sinners the Amalekites, and fight against them until they be consumed.")]

    it("emits a recitation whose rare name arrived garbled", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", SAMUEL_KJV)])
        const out = matcher.onSegment(seg("go and utterly destroy the sinners the analekite and fight against them until they be consumed"))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ book: 9, chapter: 15, verseStart: 18 })
    })

    it("does not emit ordinary speech that happens to contain the name", () => {
        const matcher = new QuoteMatcher([buildTranslationIndex("kjv", SAMUEL_KJV)])
        expect(matcher.onSegment(seg("our study group discussed the analekites and their history for a while today"))).toEqual([])
    })
})
