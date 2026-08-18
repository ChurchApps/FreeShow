import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// llmTalkScripture composes real AI API providers - no test here should ever reach them
const { mockDetectScripture } = vi.hoisted(() => ({ mockDetectScripture: vi.fn() }))
vi.mock("./llmTalkScripture", () => ({
    getLLMScriptureProvider: () => ({ detectScripture: mockDetectScripture })
}))

import { DetectionCoordinator, detectExplicitReferences, normalizeSpokenNumbers } from "./detection"

const BOOKS = [
    { number: 19, canonNumber: 19, names: ["Psalms", "Psalm"] },
    { number: 41, canonNumber: 41, names: ["Mark"] },
    { number: 43, canonNumber: 43, names: ["John", "Jn", "Johannes"] },
    { number: 44, canonNumber: 44, names: ["Acts"] },
    { number: 45, canonNumber: 45, names: ["Romans"] },
    { number: 46, canonNumber: 46, names: ["1 Corinthians", "1 Cor"] },
    { number: 50, canonNumber: 50, names: ["Philippians", "Php"] },
    { number: 62, canonNumber: 62, names: ["1 John", "1 Jn"] }
]

// Ezra: a 4-letter book name - too short for fuzzy mishearing recovery, covered by the stutter collapse
const EZRA_BOOKS = [...BOOKS, { number: 15, canonNumber: 15, names: ["Ezra"] }]

describe("normalizeSpokenNumbers", () => {
    it("converts unit/teen/tens words to digits and lowercases", () => {
        expect(normalizeSpokenNumbers("John three sixteen")).toBe("john 3 16")
        expect(normalizeSpokenNumbers("romans eight twenty-eight")).toBe("romans 8 28")
        expect(normalizeSpokenNumbers("verse twenty one")).toBe("verse 21")
    })

    it("keeps the words chapter/verse: 'chapter four verse seven' -> 'chapter 4 verse 7'", () => {
        expect(normalizeSpokenNumbers("chapter four verse seven")).toBe("chapter 4 verse 7")
    })

    it("composes hundreds up to 'one hundred seventy-six'", () => {
        expect(normalizeSpokenNumbers("one hundred seventy-six")).toBe("176")
        expect(normalizeSpokenNumbers("one hundred and seventy six")).toBe("176")
        expect(normalizeSpokenNumbers("psalm one hundred nineteen verse one hundred seventy-six")).toBe("psalm 119 verse 176")
    })

    it("converts ordinal book prefixes", () => {
        expect(normalizeSpokenNumbers("First John chapter four verse seven")).toBe("1 john chapter 4 verse 7")
        expect(normalizeSpokenNumbers("second timothy")).toBe("2 timothy")
        expect(normalizeSpokenNumbers("third john")).toBe("3 john")
    })

    it("leaves trailing ordinals alone", () => {
        expect(normalizeSpokenNumbers("he came third")).toBe("he came third")
    })

    it("converts ordinals right before chapter/verse/psalm: 'eighth chapter' -> '8th chapter'", () => {
        expect(normalizeSpokenNumbers("the eighth chapter of Ezra")).toBe("the 8th chapter of ezra")
        expect(normalizeSpokenNumbers("the ninth verse of Ezra")).toBe("the 9th verse of ezra")
        expect(normalizeSpokenNumbers("the twenty-third psalm")).toBe("the 23rd psalm")
        expect(normalizeSpokenNumbers("the twelfth verse")).toBe("the 12th verse")
        // a bare ordinal before other words stays a word
        expect(normalizeSpokenNumbers("the eighth day")).toBe("the eighth day")
    })

    it("converts digit-ordinal book prefixes: '1st John' -> '1 john'", () => {
        expect(normalizeSpokenNumbers("1st John 4:7")).toBe("1 john 4:7")
        // ...but keeps the ordinal whole before chapter/verse ("the 1st chapter")
        expect(normalizeSpokenNumbers("the 1st chapter of John")).toBe("the 1st chapter of john")
    })
})

describe("detectExplicitReferences", () => {
    it("detects spoken chapter+verse cues with high confidence", () => {
        const refs = detectExplicitReferences("please turn to john chapter three verse sixteen", BOOKS)
        expect(refs).toEqual([{ bookNumber: 43, book: "John", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("detects digit:digit shapes with high confidence", () => {
        const refs = detectExplicitReferences("acts 3:16", BOOKS)
        expect(refs).toEqual([{ bookNumber: 44, book: "Acts", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("accepts dictation-style punctuation after the book name: 'john, one, one.'", () => {
        // whisper hears the pauses of "John (pause) one (pause) one" as commas
        const refs = detectExplicitReferences(normalizeSpokenNumbers("John, one, one."), BOOKS)
        expect(refs).toEqual([{ bookNumber: 43, book: "John", chapter: 1, verseStart: 1, verseEnd: 1, confidence: "high" }])
    })

    it("accepts a comma between chapter and the verse word: 'john, chapter 3, verse 16'", () => {
        // whisper hears the dictation pause as a comma - heard live in the e2e sermon harness
        expect(detectExplicitReferences("of john, chapter 3, verse 16.", BOOKS)).toEqual([{ bookNumber: 43, book: "John", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("accepts a comma after the book name before a chapter cue: 'john, chapter three verse sixteen'", () => {
        const refs = detectExplicitReferences(normalizeSpokenNumbers("turn to John, chapter three verse sixteen"), BOOKS)
        expect(refs).toEqual([{ bookNumber: 43, book: "John", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("splits a glued chapter+verse: 'john 316' spoken as 'john 3 16'", () => {
        // 316 cannot be a chapter of a 21 chapter book, and 3|16 is the only reading that fits
        const refs = detectExplicitReferences("give me john 316", BOOKS)
        expect(refs).toEqual([{ bookNumber: 43, book: "John", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("does not split a number that is a real chapter: 'psalms 119'", () => {
        const refs = detectExplicitReferences("turn to psalms 119", BOOKS)
        expect(refs).toEqual([{ bookNumber: 19, book: "Psalms", chapter: 119, verseStart: 1, verseEnd: 1, confidence: "medium" }])
    })

    it("keeps an ambiguous glued number literal: 'mark 121' could be 1:21 or 12:1", () => {
        const refs = detectExplicitReferences("we saw mark 121", BOOKS)
        expect(refs).toEqual([{ bookNumber: 41, book: "Mark", chapter: 121, verseStart: 1, verseEnd: 1, confidence: "medium" }])
    })

    it("keeps a bare 'bookname number' at medium confidence ('he acts 15 years old')", () => {
        const refs = detectExplicitReferences("he acts 15 years old", BOOKS)
        expect(refs).toEqual([{ bookNumber: 44, book: "Acts", chapter: 15, verseStart: 1, verseEnd: 1, confidence: "medium" }])
    })

    it("keeps 'mark 2 things' at medium confidence", () => {
        const refs = detectExplicitReferences("mark 2 things before we start", BOOKS)
        expect(refs).toEqual([{ bookNumber: 41, book: "Mark", chapter: 2, verseStart: 1, verseEnd: 1, confidence: "medium" }])
    })

    it("parses verse ranges: 'romans 8 verses 28 through 30'", () => {
        expect(detectExplicitReferences("romans 8 verses 28 through 30", BOOKS)).toEqual([{ bookNumber: 45, book: "Romans", chapter: 8, verseStart: 28, verseEnd: 30, confidence: "high" }])
        expect(detectExplicitReferences("romans 8:28-30", BOOKS)).toEqual([{ bookNumber: 45, book: "Romans", chapter: 8, verseStart: 28, verseEnd: 30, confidence: "high" }])
    })

    it("accepts whisper's mishearings of the word 'verse': 'john chapter 3 best 16'", () => {
        expect(detectExplicitReferences("john chapter 3 best 16", BOOKS)[0]).toMatchObject({ bookNumber: 43, chapter: 3, verseStart: 16 })
        expect(detectExplicitReferences("romans 8 this 28", BOOKS)[0]).toMatchObject({ bookNumber: 45, chapter: 8, verseStart: 28 })
    })

    it("accepts a homophone verse number when the utterance ends there: 'john 3 for'", () => {
        expect(detectExplicitReferences("john 3 for", BOOKS)[0]).toMatchObject({ bookNumber: 43, chapter: 3, verseStart: 4 })
        expect(detectExplicitReferences("john chapter 3 verse for.", BOOKS)[0]).toMatchObject({ bookNumber: 43, chapter: 3, verseStart: 4 })
    })

    it("a homophone mid-sentence is never a verse number: 'john 3 for god so loved'", () => {
        expect(detectExplicitReferences("john 3 for god so loved the world", BOOKS)[0]).toMatchObject({ bookNumber: 43, chapter: 3, verseStart: 1 })
    })

    it("recovers misheard book names: 'now 1 corinians 13' / 'philippines 4 13'", () => {
        expect(detectExplicitReferences("now 1 corinians 13", BOOKS)[0]).toMatchObject({ bookNumber: 46, chapter: 13 })
        expect(detectExplicitReferences("turn to philippines 4 13", BOOKS)[0]).toMatchObject({ bookNumber: 50, chapter: 4, verseStart: 13 })
    })

    it("never bends an everyday word into a book name: 'the remains 5'", () => {
        // "remains" is 2 edits from "romans" - over the cap for a 7 letter word
        expect(detectExplicitReferences("all that remains 5 minutes from now", BOOKS)).toEqual([])
    })

    it("matches the longest book name first: '1 john' wins over 'john'", () => {
        expect(detectExplicitReferences("1 john 4:7", BOOKS)[0]).toMatchObject({ bookNumber: 62, book: "1 John", chapter: 4, verseStart: 7 })
        expect(detectExplicitReferences("john 4:7", BOOKS)[0]).toMatchObject({ bookNumber: 43, book: "John", chapter: 4, verseStart: 7 })
        expect(detectExplicitReferences("turn to first john chapter four", BOOKS)[0]).toMatchObject({ bookNumber: 62, book: "1 John", chapter: 4 })
    })

    it("matches localized alternative book names", () => {
        expect(detectExplicitReferences("johannes 3:16", BOOKS)).toEqual([{ bookNumber: 43, book: "Johannes", chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high" }])
    })

    it("marks cued chapter-only references as high confidence with verse 1 (deliberate spoken intent)", () => {
        const refs = detectExplicitReferences("open your bibles to john chapter three", BOOKS)
        expect(refs).toEqual([{ bookNumber: 43, book: "John", chapter: 3, verseStart: 1, verseEnd: 1, confidence: "high" }])
    })

    it("treats book + two plain numbers as chapter and verse with high confidence", () => {
        const expected = (bookNumber: number, book: string, chapter: number, verseStart: number, verseEnd = verseStart) => [{ bookNumber, book, chapter, verseStart, verseEnd, confidence: "high" }]
        expect(detectExplicitReferences("let us read mark 12 4 together", BOOKS)).toEqual(expected(41, "Mark", 12, 4))
        expect(detectExplicitReferences("john 5, 1 says", BOOKS)).toEqual(expected(43, "John", 5, 1))
        expect(detectExplicitReferences("mark 12-4 tells us", BOOKS)).toEqual(expected(41, "Mark", 12, 4))
        expect(detectExplicitReferences("we saw john 3. 16 earlier", BOOKS)).toEqual(expected(43, "John", 3, 16))
        expect(detectExplicitReferences("mark twelve four together", BOOKS)).toEqual(expected(41, "Mark", 12, 4))
        expect(detectExplicitReferences("mark 12 4-6 today", BOOKS)).toEqual(expected(41, "Mark", 12, 4, 6))
    })

    it("accepts a spoken 'and' between chapter and the verse word: 'ezra 9 and verse 8'", () => {
        expect(detectExplicitReferences("now give me ezra 9 and verse 8 in that translation", EZRA_BOOKS)[0]).toMatchObject({ bookNumber: 15, chapter: 9, verseStart: 8, confidence: "high" })
        expect(detectExplicitReferences("ezra 8 and the verse number 7", EZRA_BOOKS)[0]).toMatchObject({ bookNumber: 15, chapter: 8, verseStart: 7, confidence: "high" })
        // ...but never treats a bare "N and M" as chapter and verse - the verse word is required
        expect(detectExplicitReferences("he acts 15 and 3 others left", BOOKS)).toEqual([{ bookNumber: 44, book: "Acts", chapter: 15, verseStart: 1, verseEnd: 1, confidence: "medium" }])
    })

    it("reads the chapter-first form: 'the 8th chapter of ezra and the verse number 10'", () => {
        expect(detectExplicitReferences("the 8th chapter of ezra and the verse number 10", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 10, verseEnd: 10, confidence: "high" }])
        expect(detectExplicitReferences("turn to chapter 8 of ezra", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 1, verseEnd: 1, confidence: "high" }])
        expect(detectExplicitReferences(normalizeSpokenNumbers("the eighth chapter of Ezra"), EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 1, verseEnd: 1, confidence: "high" }])
    })

    it("reads the verse-first form: 'the 9th verse of ezra chapter 8' / 'verse 9 of ezra 8'", () => {
        const expected = [{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 9, verseEnd: 9, confidence: "high" }]
        // one single result - the embedded "ezra chapter 8" must not also surface as its own chapter-only match
        expect(detectExplicitReferences("the 9th verse of ezra chapter 8", EZRA_BOOKS)).toEqual(expected)
        expect(detectExplicitReferences("the 9th verse of ezra 8", EZRA_BOOKS)).toEqual(expected)
        expect(detectExplicitReferences("verse 9 of ezra 8", EZRA_BOOKS)).toEqual(expected)
        expect(detectExplicitReferences(normalizeSpokenNumbers("the ninth verse of Ezra chapter eight"), EZRA_BOOKS)).toEqual(expected)
    })

    it("collapses a book name glued with its own echo: 'ezrazra 9 verse 8'", () => {
        expect(detectExplicitReferences("now, ezrazra 9 verse 8 for a brief moment", EZRA_BOOKS)[0]).toMatchObject({ bookNumber: 15, chapter: 9, verseStart: 8, confidence: "high" })
        // the collapse never bends unrelated words - "romansions" is not romans + a tail of romans
        expect(detectExplicitReferences("the romansions 5 of this", BOOKS)).toEqual([])
    })

    it("detects nothing in plain speech", () => {
        expect(detectExplicitReferences("hello world, welcome to the service", BOOKS)).toEqual([])
    })

    describe("spoken phrasing variations", () => {
        const ref = (bookNumber: number, book: string, chapter: number, verseStart: number, verseEnd = verseStart, confidence = "high") => [{ bookNumber, book, chapter, verseStart, verseEnd, confidence }]

        it("'the 23rd psalm' - the ordinal IS the chapter (psalms idiom)", () => {
            // the spoken singular resolves through the "Psalm" name variant
            expect(detectExplicitReferences(normalizeSpokenNumbers("the twenty-third Psalm"), BOOKS)).toEqual(ref(19, "Psalm", 23, 1))
            expect(detectExplicitReferences("the 23rd psalm verse 4", BOOKS)).toEqual(ref(19, "Psalm", 23, 4))
            expect(detectExplicitReferences(normalizeSpokenNumbers("reading from the hundred and nineteenth psalm"), BOOKS)).toEqual([]) // >99th: rare, stays unparsed rather than misread
        })

        it("'john chapter 3, the 16th verse' - verse ordinal before the verse word", () => {
            expect(detectExplicitReferences("john chapter 3, the 16th verse", BOOKS)).toEqual(ref(43, "John", 3, 16))
            expect(detectExplicitReferences("john chapter 3 and the 16th verse", BOOKS)).toEqual(ref(43, "John", 3, 16))
            // no ordinal suffix, no verse binding: "16 verses later" is a count, not a reference
            expect(detectExplicitReferences("john 3, 16 verses later we see it", BOOKS)).toEqual(ref(43, "John", 3, 16, 16))
        })

        it("'ezra the 8th chapter' - ordinal chapter after the book", () => {
            expect(detectExplicitReferences("ezra the 8th chapter", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 1, verseEnd: 1, confidence: "high" }])
            expect(detectExplicitReferences("ezra the 8th chapter and the 9th verse", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 9, verseEnd: 9, confidence: "high" }])
            // "the N" without the ordinal+chapter shape never binds a chapter
            expect(detectExplicitReferences("give john the 5 loaves today", BOOKS)).toEqual([])
        })

        it("'chapter 8 of john' and 'the book of' interposer", () => {
            expect(detectExplicitReferences("chapter 8 of john", BOOKS)).toEqual(ref(43, "John", 8, 1))
            expect(detectExplicitReferences("the 8th chapter of the book of ezra", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 1, verseEnd: 1, confidence: "high" }])
            expect(detectExplicitReferences("chapter number 8 of ezra verse 3", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 3, verseEnd: 3, confidence: "high" }])
        })

        it("'the 9th verse of the 8th chapter of ezra' - fully chained reversed form", () => {
            expect(detectExplicitReferences("the 9th verse of the 8th chapter of ezra", EZRA_BOOKS)).toEqual([{ bookNumber: 15, book: "Ezra", chapter: 8, verseStart: 9, verseEnd: 9, confidence: "high" }])
        })

        it("'chapter number 8' and 'verse number 7' wordings", () => {
            expect(detectExplicitReferences("john chapter number 8 verse number 7", BOOKS)).toEqual(ref(43, "John", 8, 7))
        })

        it("spoken range words - only with the verse word present", () => {
            expect(detectExplicitReferences("romans 8 verses 28 and 29", BOOKS)).toEqual(ref(45, "Romans", 8, 28, 29))
            expect(detectExplicitReferences("romans 8 verse 28 down to 30", BOOKS)).toEqual(ref(45, "Romans", 8, 28, 30))
            expect(detectExplicitReferences("romans 8 verses 28 till 30", BOOKS)).toEqual(ref(45, "Romans", 8, 28, 30))
            expect(detectExplicitReferences("romans 8 verses 28 until 30", BOOKS)).toEqual(ref(45, "Romans", 8, 28, 30))
            // plain numbers never take "and" as a range - "mark 12 4 and 6 others" is not 12:4-6
            expect(detectExplicitReferences("mark 12 4 and 6 others came", BOOKS)).toEqual(ref(41, "Mark", 12, 4))
        })

        it("'starting from verse 16' filler before the verse word", () => {
            expect(detectExplicitReferences("john 3 starting from verse 16", BOOKS)).toEqual(ref(43, "John", 3, 16))
            expect(detectExplicitReferences("john chapter 3 reading from verse 16", BOOKS)).toEqual(ref(43, "John", 3, 16))
            expect(detectExplicitReferences("john 3 from verse 16", BOOKS)).toEqual(ref(43, "John", 3, 16))
        })

        it("'the 5th verse of jude' - single-chapter book with no chapter spoken", () => {
            const JUDE_BOOKS = [...BOOKS, { number: 65, canonNumber: 65, names: ["Jude"] }]
            expect(detectExplicitReferences("the 5th verse of jude", JUDE_BOOKS)).toEqual([{ bookNumber: 65, book: "Jude", chapter: 1, verseStart: 5, verseEnd: 5, confidence: "high" }])
            // a multi-chapter book with no chapter cannot resolve - never guess
            expect(detectExplicitReferences("the 5th verse of john", BOOKS)).toEqual([])
        })

        it("'1st john' digit-ordinal book prefix", () => {
            expect(detectExplicitReferences(normalizeSpokenNumbers("1st John 4:7"), BOOKS)[0]).toMatchObject({ bookNumber: 62, book: "1 John", chapter: 4, verseStart: 7 })
        })

        it("whisper punctuation between chapter and verse: semicolon & slash", () => {
            expect(detectExplicitReferences("john 3;16", BOOKS)).toEqual(ref(43, "John", 3, 16))
            expect(detectExplicitReferences("john 3/16", BOOKS)).toEqual(ref(43, "John", 3, 16))
        })
    })
})

describe("DetectionCoordinator", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockDetectScripture.mockReset()
        mockDetectScripture.mockResolvedValue({ references: [] })
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    function createCoordinator(onDetection: (ref: any) => void) {
        return new DetectionCoordinator({ books: BOOKS, llm: null, getApiKey: () => "", onDetection, onStatus: vi.fn() })
    }

    it("emits tier 1 detections with source/type/quote and dedupes intersecting references within the cooldown", () => {
        const onDetection = vi.fn()
        const coordinator = createCoordinator(onDetection)

        coordinator.onTranscriptSegment({ text: "please turn to john chapter three verse sixteen", startMs: 0, endMs: 3000 })
        expect(onDetection).toHaveBeenCalledTimes(1)
        expect(onDetection.mock.calls[0][0]).toMatchObject({ book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high", type: "explicit", source: "regex", quote: "john chapter 3 verse 16" })

        // same reference still inside the tier 1 window + repeated -> suppressed
        coordinator.onTranscriptSegment({ text: "john chapter three verse sixteen says", startMs: 3000, endMs: 6000 })
        expect(onDetection).toHaveBeenCalledTimes(1)

        // overlapping verse range in the same chapter -> suppressed
        coordinator.onTranscriptSegment({ text: "john 3:15-17", startMs: 6000, endMs: 8000 })
        expect(onDetection).toHaveBeenCalledTimes(1)

        // non-overlapping verse in the same chapter -> new detection
        coordinator.onTranscriptSegment({ text: "john 3:1", startMs: 8000, endMs: 9000 })
        expect(onDetection).toHaveBeenCalledTimes(2)
        expect(onDetection.mock.calls[1][0]).toMatchObject({ chapter: 3, verseStart: 1, verseEnd: 1 })

        // other chapter -> new detection
        coordinator.onTranscriptSegment({ text: "john 4:16", startMs: 9000, endMs: 10000 })
        expect(onDetection).toHaveBeenCalledTimes(3)
        expect(onDetection.mock.calls[2][0]).toMatchObject({ chapter: 4, verseStart: 16 })

        coordinator.stop()
    })

    it("re-emits an identical reference once the cooldown has expired", () => {
        const onDetection = vi.fn()
        const coordinator = createCoordinator(onDetection)

        coordinator.onTranscriptSegment({ text: "please turn to john chapter three verse sixteen", startMs: 0, endMs: 3000 })
        expect(onDetection).toHaveBeenCalledTimes(1)

        // still within the 90s cooldown -> suppressed
        vi.advanceTimersByTime(60_000)
        coordinator.onTranscriptSegment({ text: "john chapter three verse sixteen again", startMs: 60_000, endMs: 63_000 })
        expect(onDetection).toHaveBeenCalledTimes(1)

        // cooldown expired (last emission was 91s ago) -> emitted again
        vi.advanceTimersByTime(31_000)
        coordinator.onTranscriptSegment({ text: "back to john chapter three verse sixteen", startMs: 91_000, endMs: 94_000 })
        expect(onDetection).toHaveBeenCalledTimes(2)
        expect(onDetection.mock.calls[1][0]).toMatchObject({ bookNumber: 43, chapter: 3, verseStart: 16 })

        coordinator.stop()
    })

    it("ignores segments after stop()", () => {
        const onDetection = vi.fn()
        const coordinator = createCoordinator(onDetection)

        coordinator.stop()
        coordinator.onTranscriptSegment({ text: "john 3:16", startMs: 0, endMs: 1000 })
        expect(onDetection).not.toHaveBeenCalled()
    })

    // filler speech with no book names, so tier 1 stays quiet & the LLM word threshold (15) is reached
    const words = (count: number) => Array.from({ length: count }, (_unused, i) => "word" + i).join(" ")
    const seg = (text: string, startMs: number) => ({ text, startMs, endMs: startMs + 5000 })

    function llmCoordinator(onDetection: (ref: any) => void = vi.fn(), onStatus: (state: any, extra?: any) => void = vi.fn()) {
        return new DetectionCoordinator({ books: BOOKS, llm: { provider: "openai", model: "gpt-4o-mini" }, getApiKey: () => "test-key", onDetection, onStatus })
    }

    describe("canon book numbers", () => {
        it("emits the canon number when canonNumber is set, the bible-local number otherwise", () => {
            const canonDetection = vi.fn()
            const canonCoordinator = new DetectionCoordinator({ books: [{ number: 4, canonNumber: 43, names: ["John"] }], llm: null, getApiKey: () => "", onDetection: canonDetection, onStatus: vi.fn() })
            canonCoordinator.onTranscriptSegment(seg("turn to john 3:16", 0))
            expect(canonDetection).toHaveBeenCalledTimes(1)
            expect(canonDetection.mock.calls[0][0]).toMatchObject({ book: "John", bookNumber: 43 })
            canonCoordinator.stop()

            const localDetection = vi.fn()
            const localCoordinator = new DetectionCoordinator({ books: [{ number: 4, names: ["John"] }], llm: null, getApiKey: () => "", onDetection: localDetection, onStatus: vi.fn() })
            localCoordinator.onTranscriptSegment(seg("turn to john 3:16", 0))
            expect(localDetection).toHaveBeenCalledTimes(1)
            expect(localDetection.mock.calls[0][0]).toMatchObject({ book: "John", bookNumber: 4 })
            localCoordinator.stop()
        })

        it("dedupes an LLM canon-number detection against a tier 1 detection from a locally numbered bible", async () => {
            const onDetection = vi.fn()
            mockDetectScripture.mockResolvedValue({ references: [{ book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16, confidence: "high", type: "explicit" }] })
            const coordinator = new DetectionCoordinator({
                books: [{ number: 4, canonNumber: 43, names: ["John"] }],
                llm: { provider: "openai", model: "gpt-4o-mini" },
                getApiKey: () => "test-key",
                onDetection,
                onStatus: vi.fn()
            })

            coordinator.onTranscriptSegment(seg("turn to john 3:16 " + words(12), 0))
            await vi.advanceTimersByTimeAsync(0)

            // tier 1 emitted with the canon number, so the LLM's canon-number reference is suppressed as a duplicate
            expect(mockDetectScripture).toHaveBeenCalledTimes(1)
            expect(onDetection).toHaveBeenCalledTimes(1)
            expect(onDetection.mock.calls[0][0]).toMatchObject({ bookNumber: 43, source: "regex" })
            coordinator.stop()
        })
    })

    describe("tier 2 scheduling", () => {
        it("keeps the in-flight LLM call when new speech arrives & re-runs with the fresh transcript once it settles", async () => {
            let resolveFirst: (value: any) => void = () => {}
            mockDetectScripture.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))

            const coordinator = llmCoordinator()
            coordinator.onTranscriptSegment(seg(words(16), 0))
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(1)
            const firstSignal = mockDetectScripture.mock.calls[0][3]

            // new speech while in flight: the call is NOT aborted & no overlapping call starts
            coordinator.onTranscriptSegment(seg("fresh speech " + words(14), 6000))
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(1)
            expect(firstSignal.aborted).toBe(false)

            // once the call settles the fresh transcript is analyzed immediately
            resolveFirst({ references: [] })
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(2)
            expect(mockDetectScripture.mock.calls[1][2].transcript).toContain("fresh speech")

            coordinator.stop()
        })

        it("re-runs after a transient failure when new speech arrived while the call was in flight", async () => {
            let rejectFirst: (err: any) => void = () => {}
            mockDetectScripture.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)))

            const coordinator = llmCoordinator()
            coordinator.onTranscriptSegment(seg(words(16), 0))
            await vi.advanceTimersByTimeAsync(0)
            coordinator.onTranscriptSegment(seg(words(16), 6000))
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(1)

            rejectFirst({ code: "server_error", message: "overloaded" })
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(2)

            coordinator.stop()
        })

        it("skips the re-run when too little new speech arrived while the call was in flight", async () => {
            let resolveFirst: (value: any) => void = () => {}
            mockDetectScripture.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))

            const coordinator = llmCoordinator()
            coordinator.onTranscriptSegment(seg(words(16), 0))
            await vi.advanceTimersByTimeAsync(0)
            coordinator.onTranscriptSegment(seg(words(5), 6000))
            await vi.advanceTimersByTimeAsync(0)

            resolveFirst({ references: [] })
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(1)

            coordinator.stop()
        })

        it("aborts an in-flight call only once it outlives the request timeout & replaces it right away", async () => {
            mockDetectScripture.mockImplementationOnce(() => new Promise(() => {}))

            const coordinator = llmCoordinator()
            coordinator.onTranscriptSegment(seg(words(16), 0))
            await vi.advanceTimersByTimeAsync(0)
            const firstSignal = mockDetectScripture.mock.calls[0][3]

            vi.advanceTimersByTime(12_001)
            coordinator.onTranscriptSegment(seg(words(16), 13_000))
            expect(firstSignal.aborted).toBe(true)
            await vi.advanceTimersByTimeAsync(0)
            expect(mockDetectScripture).toHaveBeenCalledTimes(2)

            coordinator.stop()
        })

        it("pauses tier 2 for the session on permanent errors (model_not_found / invalid_request)", async () => {
            for (const code of ["model_not_found", "invalid_request"]) {
                mockDetectScripture.mockClear()
                mockDetectScripture.mockRejectedValueOnce({ code, message: "the model does not exist" })

                const onStatus = vi.fn()
                const coordinator = llmCoordinator(vi.fn(), onStatus)
                coordinator.onTranscriptSegment(seg(words(16), 0))
                await vi.advanceTimersByTimeAsync(0)
                expect(onStatus).toHaveBeenCalledWith("llm_paused", { message: "the model does not exist" })

                // no further LLM calls for the rest of the session
                coordinator.onTranscriptSegment(seg(words(16), 6000))
                await vi.advanceTimersByTimeAsync(0)
                expect(mockDetectScripture).toHaveBeenCalledTimes(1)

                coordinator.stop()
            }
        })
    })

    describe("anchor context (bounded session context)", () => {
        it("resolves bare 'verse N' mentions against the anchor", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)
            coordinator.updateContext({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 1, verseEnd: 4 })

            coordinator.onTranscriptSegment({ text: "now look at verse twelve", startMs: 0, endMs: 2000 })
            expect(onDetection).toHaveBeenCalledTimes(1)
            expect(onDetection.mock.calls[0][0]).toMatchObject({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 12, verseEnd: 12, type: "explicit", source: "regex", confidence: "high", quote: "verse 12" })

            coordinator.stop()
        })

        it("resolves bare verse ranges: 'verses three to five'", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)
            coordinator.updateContext({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 1, verseEnd: 1 })

            coordinator.onTranscriptSegment({ text: "let us look at verses three to five together", startMs: 0, endMs: 2000 })
            expect(onDetection).toHaveBeenCalledTimes(1)
            expect(onDetection.mock.calls[0][0]).toMatchObject({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 3, verseEnd: 5 })

            coordinator.stop()
        })

        it("does not emit bare verse mentions when no anchor is set", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)

            coordinator.onTranscriptSegment({ text: "now look at verse twelve", startMs: 0, endMs: 2000 })
            expect(onDetection).not.toHaveBeenCalled()

            coordinator.stop()
        })

        it("does not fire on the 'fifteen verses' word order", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)
            coordinator.updateContext({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 1, verseEnd: 1 })

            coordinator.onTranscriptSegment({ text: "he has fifteen verses about this", startMs: 0, endMs: 2000 })
            expect(onDetection).not.toHaveBeenCalled()

            coordinator.stop()
        })

        it("does not double-emit the verse part of a full explicit reference", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)
            coordinator.updateContext({ book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16 })

            coordinator.onTranscriptSegment({ text: "please turn to romans chapter eight verse twenty-eight", startMs: 0, endMs: 3000 })
            expect(onDetection).toHaveBeenCalledTimes(1)
            expect(onDetection.mock.calls[0][0]).toMatchObject({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 28 })

            coordinator.stop()
        })

        it("keeps a single replaced anchor - never accumulates", () => {
            const onDetection = vi.fn()
            const coordinator = createCoordinator(onDetection)
            coordinator.updateContext({ book: "Romans", bookNumber: 45, chapter: 8, verseStart: 1, verseEnd: 4 })
            coordinator.updateContext({ book: "John", bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 16 })

            coordinator.onTranscriptSegment({ text: "now look at verse two", startMs: 0, endMs: 2000 })
            expect(onDetection).toHaveBeenCalledTimes(1)
            expect(onDetection.mock.calls[0][0]).toMatchObject({ book: "John", bookNumber: 43, chapter: 3, verseStart: 2, verseEnd: 2 })

            coordinator.stop()
        })
    })
})
