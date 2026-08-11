// AI AUTO SCRIPTURE
// tier 1: fast local regex detection of explicitly spoken references ("John chapter 3 verse 16")
// tier 2: LLM detection over the rolling transcript for paraphrased/quoted references (optional, needs an API key)

import type { AIProviderId, AiScriptureBook, AiScriptureState, DetectedReference } from "../../types/ai/AiScripture"
import { getProvider } from "./providers"
import { REQUEST_TIMEOUT } from "./providers/types"

// SPOKEN NUMBERS

const UNIT_WORDS: { [word: string]: number } = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEEN_WORDS: { [word: string]: number } = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS_WORDS: { [word: string]: number } = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINAL_PREFIXES: { [word: string]: string } = { first: "1", second: "2", third: "3" }

interface SpokenToken {
    prefix: string // leading punctuation
    core: string
    suffix: string // trailing punctuation
}

function toToken(raw: string): SpokenToken {
    const match = raw.match(/^([^a-z0-9]*)(.*?)([^a-z0-9]*)$/)
    return match ? { prefix: match[1], core: match[2], suffix: match[3] } : { prefix: "", core: raw, suffix: "" }
}

// read a 1-99 number word at index i ("six", "sixteen", "seventy", "seventy-six", "seventy six") - null when tokens[i] is not one
function readTens(tokens: SpokenToken[], i: number): { value: number; end: number } | null {
    const token = tokens[i]
    if (!token) return null

    const parts = token.core.split("-")
    if (parts.length === 2 && TENS_WORDS[parts[0]] !== undefined && UNIT_WORDS[parts[1]] !== undefined) return { value: TENS_WORDS[parts[0]] + UNIT_WORDS[parts[1]], end: i + 1 }

    if (TENS_WORDS[token.core] !== undefined) {
        const next = tokens[i + 1]
        if (!token.suffix && next && !next.prefix && UNIT_WORDS[next.core] !== undefined) return { value: TENS_WORDS[token.core] + UNIT_WORDS[next.core], end: i + 2 }
        return { value: TENS_WORDS[token.core], end: i + 1 }
    }

    if (TEEN_WORDS[token.core] !== undefined) return { value: TEEN_WORDS[token.core], end: i + 1 }
    if (UNIT_WORDS[token.core] !== undefined) return { value: UNIT_WORDS[token.core], end: i + 1 }
    return null
}

// lowercase the text & convert spoken numbers to digits: "john chapter three verse sixteen" -> "john chapter 3 verse 16",
// "one hundred seventy-six" -> "176", ordinal book prefixes "first john" -> "1 john"
export function normalizeSpokenNumbers(text: string): string {
    const tokens = text
        .toLowerCase()
        .split(/\s+/)
        .filter((part: string) => part.length > 0)
        .map(toToken)

    const out: string[] = []
    let i = 0
    while (i < tokens.length) {
        const token = tokens[i]
        const next = tokens[i + 1]

        // ordinal book prefixes: only converted when followed by another word ("first john" -> "1 john")
        if (ORDINAL_PREFIXES[token.core] !== undefined && !token.suffix && next && !next.prefix && /^[a-z]/.test(next.core)) {
            out.push(token.prefix + ORDINAL_PREFIXES[token.core])
            i++
            continue
        }

        const small = readTens(tokens, i)
        if (!small) {
            out.push(token.prefix + token.core + token.suffix)
            i++
            continue
        }

        let value = small.value
        let end = small.end

        // "<unit> hundred (and) <1-99>" composition: "one hundred seventy-six" -> 176
        if (value >= 1 && value <= 9 && !tokens[end - 1].suffix && tokens[end] && !tokens[end].prefix && tokens[end].core === "hundred") {
            value *= 100
            end++
            let k = end
            if (!tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix && !tokens[k].suffix && tokens[k].core === "and" && tokens[k + 1] && !tokens[k + 1].prefix && readTens(tokens, k + 1)) k++
            const remainder = !tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix ? readTens(tokens, k) : null
            if (remainder) {
                value += remainder.value
                end = remainder.end
            }
        }

        out.push(tokens[i].prefix + String(value) + tokens[end - 1].suffix)
        i = end
    }

    return out.join(" ")
}

// TIER 1 (local regex)

interface BookIndex {
    regex: RegExp | null
    byToken: Map<string, { name: string; number: number; chapterCount: number }>
    bookPattern: string // alternation of all book name patterns ("" when no books)
}

// a spoken "8 18" often reaches us as "818". Recover the pair when the number cannot be a chapter of this book,
// and only when exactly one split works - an ambiguous number keeps its literal reading and waits for confirmation.
export function splitGluedReference(value: number, chapterCount: number): { chapter: number; verse: number } | null {
    if (!chapterCount || value <= chapterCount) return null

    const digits = String(value)
    const candidates: { chapter: number; verse: number }[] = []
    for (let cut = 1; cut < digits.length; cut++) {
        const versePart = digits.slice(cut)
        if (versePart.startsWith("0")) continue // "805" is not "8" + "05"

        const chapter = parseInt(digits.slice(0, cut), 10)
        const verse = parseInt(versePart, 10)
        if (chapter >= 1 && chapter <= chapterCount && verse >= 1 && verse <= MAX_VERSE_NUMBER) candidates.push({ chapter, verse })
    }

    return candidates.length === 1 ? candidates[0] : null
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildBookIndex(books: AiScriptureBook[]): BookIndex {
    const byToken = new Map<string, { name: string; number: number; chapterCount: number }>()
    const tokens: string[] = []

    books.forEach((book) => {
        // only a canon book has a known chapter count - without one a glued chapter+verse cannot be told apart from a chapter
        const chapterCount = book.canonNumber ? CANON_CHAPTER_COUNTS[book.canonNumber] || 0 : 0
        book.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (!token || byToken.has(token)) return
            // prefer the 66 book canon number so tier 1 & tier 2 (which always reports canon numbers) share one numbering domain
            byToken.set(token, { name: name.trim(), number: book.canonNumber ?? book.number, chapterCount })
            tokens.push(token)
        })
    })

    // longest names first so "1 john" wins over "john"
    tokens.sort((a, b) => b.length - a.length)
    const patterns = tokens.map((token) => escapeRegex(token).replace(/ /g, "\\s+"))

    // speakers often say just "matthew 5 1", and whisper's punctuation varies - accept every separator it
    // produces between chapter & verse: "5:1", "5 verse 1", "5 1", "5, 1", "5. 1", "5-1", "5–1"
    const regex = patterns.length ? new RegExp("(^|[^a-z0-9])(" + patterns.join("|") + ")\\s+(?:chapter\\s+)?(\\d{1,3})\\b(?:(?:\\s*(?::|verses?\\b)\\s*|\\s*[-–,.]\\s*|\\s+)(\\d{1,3})\\b(?:\\s*(?:-|–|to\\b|through\\b)\\s*(\\d{1,3})\\b)?)?", "g") : null
    return { regex, byToken, bookPattern: patterns.join("|") }
}

interface ReferenceMatch {
    bookNumber: number
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    quote: string
}

function matchReferences(text: string, index: BookIndex): ReferenceMatch[] {
    if (!index.regex) return []

    const normalized = normalizeSpokenNumbers(text)
    const results: ReferenceMatch[] = []

    index.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = index.regex.exec(normalized)) !== null) {
        const bookToken = match[2].replace(/\s+/g, " ")
        const book = index.byToken.get(bookToken)
        if (!book) continue

        let chapter = parseInt(match[3], 10)
        if (!(chapter >= 1)) continue

        const hasVerse = match[4] !== undefined
        let verseStart = 1
        let verseEnd = 1
        let unglued = false
        if (hasVerse) {
            verseStart = parseInt(match[4], 10)
            if (!(verseStart >= 1)) continue
            verseEnd = match[5] !== undefined ? parseInt(match[5], 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart
        } else {
            // no separator was spoken/transcribed - the single number may be a chapter and verse run together
            const split = splitGluedReference(chapter, book.chapterCount)
            if (split) {
                chapter = split.chapter
                verseStart = split.verse
                verseEnd = split.verse
                unglued = true
            }
        }

        const quote = match[0].slice(match[1].length)

        // CUE RULE: "high" only with an explicit cue in the spoken text - the word "chapter"/"verse", an ordinal/numbered
        // book prefix ("first john"/"1 john") or a digit:digit shape ("3:16"). normalizeSpokenNumbers() never introduces any
        // of these words/shapes, so checking the normalized snippet reflects the original text.
        const hasCue = /\bchapter\b|\bverses?\b/.test(quote) || /\d:\d/.test(quote) || /^[1-3]\b/.test(bookToken)

        // book + chapter + verse ("matthew 12 4"), the same pair run together ("deuteronomy 818") or a cued
        // chapter ("turn to matthew chapter 5") is deliberate spoken intent - "high" so auto mode projects it.
        // only a bare "bookname 15" ("he acts 15 years old") stays "medium" and waits for confirmation
        const confidence: "high" | "medium" | "low" = hasVerse || unglued || hasCue ? "high" : "medium"

        results.push({ bookNumber: book.number, book: book.name, chapter, verseStart, verseEnd, confidence, quote })
    }

    return results
}

export function detectExplicitReferences(text: string, books: AiScriptureBook[]): { bookNumber: number; book: string; chapter: number; verseStart: number; verseEnd: number; confidence: "high" | "medium" | "low" }[] {
    return matchReferences(text, buildBookIndex(books)).map((match) => ({ bookNumber: match.bookNumber, book: match.book, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence }))
}

// COORDINATOR

// the anchor passage: what is live on the output right now - bare "verse N" mentions resolve against it
export interface AiScriptureAnchor {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
}

// cue-gated: the word "verse(s)" with the number AFTER it is required, so "he has fifteen verses" never fires
const BARE_VERSE_REGEX = /(^|[^a-z0-9])(verses?\s+(\d{1,3})\b(?:\s*(?:-|to\b|through\b)\s*(\d{1,3})\b)?)/g

interface TranscriptSegment {
    text: string
    startMs: number
    endMs: number
}

interface EmittedReference {
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    timestamp: number
}

interface DetectionCandidate {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    type: "explicit" | "quoted"
    quote?: string
}

interface DetectionCoordinatorOptions {
    books: AiScriptureBook[]
    llm: { provider: AIProviderId; model: string } | null
    getApiKey: (provider: AIProviderId) => string
    onDetection: (ref: DetectedReference) => void
    onStatus: (state: AiScriptureState, extra?: { message?: string; keyless?: boolean }) => void
    cooldownSeconds?: number
}

const ROLLING_MAX_MS = 90000 // rolling transcript cap
const ROLLING_MAX_CHARS = 2000
const TIER1_WINDOW_MS = 15000 // tier 1 only rescans the most recent speech
const LLM_MIN_NEW_WORDS = 15 // don't call the LLM again until this much new speech arrived
const LLM_ALREADY_DETECTED_MS = 180000 // recently emitted refs sent to the LLM so it skips them
const DEFAULT_COOLDOWN_SECONDS = 90 // suppress re-emitting an intersecting reference within this window

export class DetectionCoordinator {
    private opts: DetectionCoordinatorOptions
    private bookIndex: BookIndex
    private cooldownMs: number

    // a single replaced anchor object - strictly bounded, never accumulates over a long sermon
    private anchor: AiScriptureAnchor | null = null
    private anchorBookPrefix: RegExp | null

    private segments: TranscriptSegment[] = []
    private emitted = new Map<string, EmittedReference[]>() // key: "bookNumber.chapter"
    private idCounter = 0
    private stopped = false

    // tier 2 state
    private totalWords = 0
    private wordsAtLastLlmCall = 0
    private llmController: AbortController | null = null
    private llmCallStartedAt = 0
    private llmRerunPending = false // new speech arrived while a call was in flight: re-run once it settles
    private llmStopped = false
    private llmCooldownUntil = 0

    constructor(opts: DetectionCoordinatorOptions) {
        this.opts = opts
        this.bookIndex = buildBookIndex(opts.books)
        this.anchorBookPrefix = this.bookIndex.bookPattern ? new RegExp("(?:^|[^a-z0-9])(?:" + this.bookIndex.bookPattern + ")\\s+$") : null
        this.cooldownMs = (opts.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000
    }

    // replace the anchor passage (what is live on the output right now)
    updateContext(ctx: AiScriptureAnchor): void {
        this.anchor = ctx
    }

    onTranscriptSegment(segment: { text: string; startMs: number; endMs: number }): void {
        if (this.stopped) return

        this.segments.push(segment)
        this.totalWords += countWords(segment.text)
        this.trimRollingTranscript()

        this.runTier1()
        this.maybeRunTier2()
    }

    stop(): void {
        this.stopped = true
        this.llmRerunPending = false
        if (this.llmController) {
            this.llmController.abort()
            this.llmController = null
        }
        this.segments = []
        this.emitted.clear()
    }

    // TIER 1

    private runTier1() {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        const windowText = this.segments
            .filter((segment) => segment.endMs >= newestEnd - TIER1_WINDOW_MS)
            .map((segment) => segment.text)
            .join(" ")

        matchReferences(windowText, this.bookIndex).forEach((match) => {
            this.tryEmit({ book: match.book, bookNumber: match.bookNumber, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence, type: "explicit", quote: match.quote }, "regex")
        })

        this.runAnchorTier1(windowText)
    }

    // bare "verse N" / "verses N to M" mentions (no book named) resolve against the anchor passage
    private runAnchorTier1(windowText: string) {
        const anchor = this.anchor
        if (!anchor) return

        const normalized = normalizeSpokenNumbers(windowText)

        // spans already matched as full references - the "verse 16" inside "john chapter 3 verse 16" is not anchor-relative
        const covered: [number, number][] = []
        if (this.bookIndex.regex) {
            this.bookIndex.regex.lastIndex = 0
            let full: RegExpExecArray | null
            while ((full = this.bookIndex.regex.exec(normalized)) !== null) covered.push([full.index, full.index + full[0].length])
        }

        BARE_VERSE_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = BARE_VERSE_REGEX.exec(normalized)) !== null) {
            const start = match.index + match[1].length
            if (covered.some(([from, to]) => start >= from && start < to)) continue
            // a book name directly before makes it a partial explicit reference ("john verse 7"), not an anchor-relative one
            if (this.anchorBookPrefix?.test(normalized.slice(0, start))) continue

            const verseStart = parseInt(match[3], 10)
            if (!(verseStart >= 1)) continue
            let verseEnd = match[4] !== undefined ? parseInt(match[4], 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart

            // the anchor is the chapter live on screen, so a bare verse mention is context-certain
            this.tryEmit({ book: anchor.book, bookNumber: anchor.bookNumber, chapter: anchor.chapter, verseStart, verseEnd, confidence: "high", type: "explicit", quote: match[2] }, "regex")
        }
    }

    // TIER 2 - single flight, newest transcript wins once the in-flight call settles

    private maybeRunTier2() {
        const llm = this.opts.llm
        if (!llm || this.llmStopped) return

        // a call is in flight: never abort it just because new speech arrived (during continuous speech that would starve
        // tier 2 completely) - mark a re-run so the fresh transcript is analyzed as soon as the call settles.
        // only calls stuck past the request timeout are aborted & replaced right away
        if (this.llmController) {
            if (Date.now() - this.llmCallStartedAt <= REQUEST_TIMEOUT) {
                this.llmRerunPending = true
                return
            }
            this.llmController.abort()
            this.llmController = null
        }

        if (Date.now() < this.llmCooldownUntil) return
        if (this.totalWords - this.wordsAtLastLlmCall < LLM_MIN_NEW_WORDS) return

        const apiKey = this.opts.getApiKey(llm.provider)
        if (!apiKey) return

        this.wordsAtLastLlmCall = this.totalWords
        const controller = new AbortController()
        this.llmController = controller
        this.llmCallStartedAt = Date.now()

        const transcript = this.segments.map((segment) => segment.text).join(" ")
        const liveContext = this.anchor ? "Live on screen: " + this.anchor.book + " " + this.anchor.chapter + ":" + this.anchor.verseStart + "-" + this.anchor.verseEnd + ". Bare verse mentions likely refer to this passage." : undefined
        Promise.resolve()
            .then(() => getProvider(llm.provider).detectScripture(apiKey, llm.model, { transcript, alreadyDetected: this.recentDetectionStrings(), liveContext }, controller.signal))
            .then(
                (result: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.handleLlmReferences(Array.isArray(result?.references) ? result.references : [])
                    this.runPendingRerun()
                },
                (err: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.handleLlmError(err)
                    this.runPendingRerun()
                }
            )
    }

    // speech arrived while the last call was in flight: immediately analyze the fresh transcript
    // (maybeRunTier2 re-checks the cooldown/new-words conditions & whether tier 2 was stopped meanwhile)
    private runPendingRerun() {
        if (!this.llmRerunPending) return
        this.llmRerunPending = false
        if (!this.stopped) this.maybeRunTier2()
    }

    private handleLlmReferences(references: any[]) {
        references.forEach((raw: any) => {
            const chapter = Math.floor(Number(raw?.chapter))
            const verseStart = Math.floor(Number(raw?.verseStart))
            if (!Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(verseStart) || verseStart < 1) return

            let verseEnd = Math.floor(Number(raw?.verseEnd))
            if (!Number.isFinite(verseEnd) || verseEnd < verseStart) verseEnd = verseStart

            // resolve the book against the active book table first, fall back to the canon book number
            const rawName = String(raw?.book || "").trim()
            const nameMatch = this.bookIndex.byToken.get(rawName.toLowerCase().replace(/\s+/g, " "))
            const bookNumber = nameMatch ? nameMatch.number : Math.floor(Number(raw?.bookNumber))
            if (!nameMatch && (!Number.isFinite(bookNumber) || bookNumber < 1 || bookNumber > 66)) return

            const confidence: "high" | "medium" | "low" = raw?.confidence === "high" || raw?.confidence === "low" ? raw.confidence : "medium"
            const type: "explicit" | "quoted" = raw?.type === "quoted" ? "quoted" : "explicit"
            const quote = typeof raw?.quote === "string" && raw.quote ? raw.quote : undefined

            this.tryEmit({ book: nameMatch ? nameMatch.name : rawName, bookNumber, chapter, verseStart, verseEnd, confidence, type, quote }, "llm")
        })
    }

    private handleLlmError(err: any) {
        const code = err?.code

        // permanent errors will not fix themselves - bad key, unknown model, malformed request:
        // stop tier 2 for the rest of the session & tell the user (tier 1 keeps running)
        if (code === "invalid_key" || code === "forbidden" || code === "model_not_found" || code === "invalid_request") {
            this.llmStopped = true
            this.opts.onStatus("llm_paused", { message: err?.message || String(code) })
            return
        }

        if (code === "rate_limited") {
            const retryAfter = typeof err?.retryAfter === "number" && Number.isFinite(err.retryAfter) && err.retryAfter > 0 ? err.retryAfter : 15
            this.llmCooldownUntil = Date.now() + Math.min(retryAfter, 60) * 1000
            return
        }

        // timeout/network/server_error/bad_response/refusal: just skip this window & keep going
    }

    // EMISSION

    private tryEmit(candidate: DetectionCandidate, source: "regex" | "llm") {
        const now = Date.now()
        const key = candidate.bookNumber + "." + candidate.chapter
        const keepMs = Math.max(this.cooldownMs, LLM_ALREADY_DETECTED_MS)
        const entries = (this.emitted.get(key) || []).filter((entry) => now - entry.timestamp < keepMs)

        // suppress when it intersects (same book+chapter and overlapping verse range) a reference emitted within the cooldown
        const suppressed = entries.some((entry) => now - entry.timestamp < this.cooldownMs && candidate.verseStart <= entry.verseEnd && candidate.verseEnd >= entry.verseStart)
        if (!suppressed) {
            entries.push({ book: candidate.book, chapter: candidate.chapter, verseStart: candidate.verseStart, verseEnd: candidate.verseEnd, timestamp: now })
            this.opts.onDetection({
                id: "ai-" + now.toString(36) + "-" + (this.idCounter++).toString(36),
                book: candidate.book,
                bookNumber: candidate.bookNumber,
                chapter: candidate.chapter,
                verseStart: candidate.verseStart,
                verseEnd: candidate.verseEnd,
                confidence: candidate.confidence,
                type: candidate.type,
                source,
                quote: candidate.quote,
                timestamp: now
            })
        }

        this.emitted.set(key, entries)
    }

    private recentDetectionStrings(): string[] {
        const now = Date.now()
        const recent: string[] = []
        this.emitted.forEach((entries) => {
            entries.forEach((entry) => {
                if (now - entry.timestamp < LLM_ALREADY_DETECTED_MS) recent.push(entry.book + " " + entry.chapter + ":" + entry.verseStart + "-" + entry.verseEnd)
            })
        })
        return recent
    }

    // ROLLING TRANSCRIPT

    private trimRollingTranscript() {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        while (this.segments.length > 1 && this.segments[0].endMs < newestEnd - ROLLING_MAX_MS) this.segments.shift()

        let chars = this.segments.reduce((total, segment) => total + segment.text.length, 0)
        while (this.segments.length > 1 && chars > ROLLING_MAX_CHARS) {
            chars -= this.segments[0].text.length
            this.segments.shift()
        }
    }
}

function countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
}

// DATA

// chapters per book of the 66 book canon, keyed by canon book number. Fixed across translations, so it can be
// a table instead of 66 async book loads - used to tell a spoken chapter from a chapter+verse pair the speech
// engine ran together ("deuteronomy 8 18" transcribed as "deuteronomy 818" - 818 is not a chapter of a 34 chapter book)
const CANON_CHAPTER_COUNTS: { [canonNumber: number]: number } = {
    1: 50,
    2: 40,
    3: 27,
    4: 36,
    5: 34,
    6: 24,
    7: 21,
    8: 4,
    9: 31,
    10: 24,
    11: 22,
    12: 25,
    13: 29,
    14: 36,
    15: 10,
    16: 13,
    17: 10,
    18: 42,
    19: 150,
    20: 31,
    21: 12,
    22: 8,
    23: 66,
    24: 52,
    25: 5,
    26: 48,
    27: 12,
    28: 14,
    29: 3,
    30: 9,
    31: 1,
    32: 4,
    33: 7,
    34: 3,
    35: 3,
    36: 3,
    37: 2,
    38: 14,
    39: 4,
    40: 28,
    41: 16,
    42: 24,
    43: 21,
    44: 28,
    45: 16,
    46: 16,
    47: 13,
    48: 6,
    49: 6,
    50: 4,
    51: 4,
    52: 5,
    53: 3,
    54: 6,
    55: 4,
    56: 3,
    57: 1,
    58: 13,
    59: 5,
    60: 5,
    61: 3,
    62: 5,
    63: 1,
    64: 1,
    65: 1,
    66: 22
}

// the longest chapter in the bible (Psalm 119) - an upper bound on a plausible verse number
const MAX_VERSE_NUMBER = 176
