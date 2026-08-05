// AI AUTO SCRIPTURE
// tier 1: fast local regex detection of explicitly spoken references ("John chapter 3 verse 16")
// tier 2: LLM detection over the rolling transcript for paraphrased/quoted references (optional, needs an API key)

import type { AIProviderId, AiScriptureBook, AiScriptureState, DetectedReference } from "../../types/AiScripture"
import { getProvider } from "./providers"

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
    byToken: Map<string, { name: string; number: number }>
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildBookIndex(books: AiScriptureBook[]): BookIndex {
    const byToken = new Map<string, { name: string; number: number }>()
    const tokens: string[] = []

    books.forEach((book) => {
        book.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (!token || byToken.has(token)) return
            byToken.set(token, { name: name.trim(), number: book.number })
            tokens.push(token)
        })
    })

    // longest names first so "1 john" wins over "john"
    tokens.sort((a, b) => b.length - a.length)
    const patterns = tokens.map((token) => escapeRegex(token).replace(/ /g, "\\s+"))

    const regex = patterns.length ? new RegExp("(^|[^a-z0-9])(" + patterns.join("|") + ")\\s+(?:chapter\\s+)?(\\d{1,3})\\b(?:\\s*(?::|verses?\\b)\\s*(\\d{1,3})\\b(?:\\s*(?:-|to\\b|through\\b)\\s*(\\d{1,3})\\b)?)?", "g") : null
    return { regex, byToken }
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

        const chapter = parseInt(match[3], 10)
        if (!(chapter >= 1)) continue

        const hasVerse = match[4] !== undefined
        let verseStart = 1
        let verseEnd = 1
        if (hasVerse) {
            verseStart = parseInt(match[4], 10)
            if (!(verseStart >= 1)) continue
            verseEnd = match[5] !== undefined ? parseInt(match[5], 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart
        }

        const quote = match[0].slice(match[1].length)

        // CUE RULE: "high" only with an explicit cue in the spoken text - the word "chapter"/"verse", an ordinal/numbered
        // book prefix ("first john"/"1 john") or a digit:digit shape ("3:16"). normalizeSpokenNumbers() never introduces any
        // of these words/shapes, so checking the normalized snippet reflects the original text.
        const hasCue = /\bchapter\b|\bverses?\b/.test(quote) || /\d:\d/.test(quote) || /^[1-3]\b/.test(bookToken)

        // a bare "bookname 15" ("he acts 15 years old") is only "medium", and a cued chapter with no verse
        // ("john chapter 3") is "low" since verse 1 is just a guess
        const confidence: "high" | "medium" | "low" = hasVerse ? (hasCue ? "high" : "medium") : hasCue ? "low" : "medium"

        results.push({ bookNumber: book.number, book: book.name, chapter, verseStart, verseEnd, confidence, quote })
    }

    return results
}

export function detectExplicitReferences(text: string, books: AiScriptureBook[]): { bookNumber: number; book: string; chapter: number; verseStart: number; verseEnd: number; confidence: "high" | "medium" | "low" }[] {
    return matchReferences(text, buildBookIndex(books)).map((match) => ({ bookNumber: match.bookNumber, book: match.book, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence }))
}

// COORDINATOR

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

    private segments: TranscriptSegment[] = []
    private emitted = new Map<string, EmittedReference[]>() // key: "bookNumber.chapter"
    private idCounter = 0
    private stopped = false

    // tier 2 state
    private totalWords = 0
    private wordsAtLastLlmCall = 0
    private llmController: AbortController | null = null
    private llmStopped = false
    private llmCooldownUntil = 0

    constructor(opts: DetectionCoordinatorOptions) {
        this.opts = opts
        this.bookIndex = buildBookIndex(opts.books)
        this.cooldownMs = (opts.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000
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
    }

    // TIER 2 - single flight, newest transcript wins

    private maybeRunTier2() {
        const llm = this.opts.llm
        if (!llm || this.llmStopped) return

        // a call is still in flight, so its transcript window is stale now: abort it & let the next segment trigger a fresh one
        if (this.llmController) {
            this.llmController.abort()
            this.llmController = null
            return
        }

        if (Date.now() < this.llmCooldownUntil) return
        if (this.totalWords - this.wordsAtLastLlmCall < LLM_MIN_NEW_WORDS) return

        const apiKey = this.opts.getApiKey(llm.provider)
        if (!apiKey) return

        this.wordsAtLastLlmCall = this.totalWords
        const controller = new AbortController()
        this.llmController = controller

        const transcript = this.segments.map((segment) => segment.text).join(" ")
        Promise.resolve()
            .then(() => getProvider(llm.provider).detectScripture(apiKey, llm.model, { transcript, alreadyDetected: this.recentDetectionStrings() }, controller.signal))
            .then(
                (result: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.handleLlmReferences(Array.isArray(result?.references) ? result.references : [])
                },
                (err: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.handleLlmError(err)
                }
            )
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

        // key problems will not fix themselves: stop tier 2 for the rest of the session (tier 1 keeps running)
        if (code === "invalid_key" || code === "forbidden") {
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
