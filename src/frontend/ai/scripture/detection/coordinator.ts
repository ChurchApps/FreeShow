import type { AiScriptureBook, DetectedReference } from "../../../../types/ai/AiScripture"
import type { AiFeatureState } from "../../../../types/ai/Ai"
import { normalizeSpokenNumbers } from "./numberUtils"
import type { AIProviderId } from "../../models"
import { getLLMScriptureProvider } from "../llmTalkScripture"
import type { BookIndex } from "./references"
import { buildBookIndex, matchReferences } from "./references"

const LLM_API_TIMEOUT = 12000
const ROLLING_MAX_MS = 90000
const ROLLING_MAX_CHARS = 2000
const TIER1_WINDOW_MS = 15000
const LLM_MIN_NEW_WORDS = 15
const LLM_ALREADY_DETECTED_MS = 180000
const DEFAULT_COOLDOWN_SECONDS = 90

export interface AiScriptureAnchor {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
}

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
    confidence: number
    type: "explicit" | "quoted"
    quote?: string
}

interface DetectionCoordinatorOptions {
    books: AiScriptureBook[]
    llm: { provider: AIProviderId; model: string } | null
    onDetection: (ref: DetectedReference) => void
    onStatus: (state: AiFeatureState, extra?: { message?: string; keyless?: boolean }) => void
    cooldownSeconds?: number
}

const BARE_VERSE_REGEX = /(^|[^a-z0-9])((?:the\s+)?(?:verses?\s+(?:number\s+)?(?<n1>\d{1,3})\b|(?<n2>\d{1,3})(?:st|nd|rd|th)\s+verses?\b)(?:\s*(?:-|–|to\b|through\b|and\b|till\b|until\b)\s*(?<end>\d{1,3})\b)?)/g

export class DetectionCoordinator {
    private opts: DetectionCoordinatorOptions
    private bookIndex: BookIndex
    private cooldownMs: number

    private anchor: AiScriptureAnchor | null = null
    private anchorBookPrefix: RegExp | null = null

    private segments: TranscriptSegment[] = []
    private emitted = new Map<string, EmittedReference[]>()
    private idCounter = 0
    private stopped = false

    private totalWords = 0
    private wordsAtLastLlmCall = 0
    private llmController: AbortController | null = null
    private llmCallStartedAt = 0
    private llmRerunPending = false
    private llmStopped = false
    private llmPermanentFailures = 0
    private llmCooldownUntil = 0

    constructor(opts: DetectionCoordinatorOptions) {
        this.opts = opts
        this.bookIndex = buildBookIndex(opts.books)
        this.cooldownMs = (opts.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000
        this.updateAnchorPrefix()
    }

    private updateAnchorPrefix(): void {
        this.anchorBookPrefix = this.bookIndex.bookPattern ? new RegExp(`(?:^|[^a-z0-9])(?:${this.bookIndex.bookPattern})[,.]?\\s+$`) : null
    }

    updateLlm(llm: DetectionCoordinatorOptions["llm"]): void {
        this.opts.llm = llm
        this.llmStopped = false
        this.llmPermanentFailures = 0
        this.llmCooldownUntil = 0
    }

    updateBooks(books: AiScriptureBook[]): void {
        this.opts.books = books
        this.bookIndex = buildBookIndex(books)
        this.updateAnchorPrefix()
    }

    updateContext(ctx: AiScriptureAnchor): void {
        this.anchor = ctx
    }

    onTranscriptSegment(segment: TranscriptSegment): void {
        if (this.stopped) return

        this.segments.push(segment)
        this.totalWords += segment.text.split(/\s+/).filter(Boolean).length
        this.trimRollingTranscript()

        this.runTier1()
        this.maybeRunTier2()
    }

    stop(): void {
        this.stopped = true
        this.llmRerunPending = false
        this.llmController?.abort()
        this.llmController = null
        this.segments = []
        this.emitted.clear()
    }

    private runTier1(): void {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        const windowText = this.segments
            .filter((seg) => seg.endMs >= newestEnd - TIER1_WINDOW_MS)
            .map((seg) => seg.text)
            .join(" ")

        matchReferences(windowText, this.bookIndex).forEach((match) => {
            this.tryEmit({ ...match, type: "explicit" }, "regex")
        })

        this.runAnchorTier1(windowText)
    }

    private runAnchorTier1(windowText: string): void {
        if (!this.anchor) return

        const normalized = normalizeSpokenNumbers(windowText)
        const covered: [number, number][] = []

        if (this.bookIndex.regex) {
            this.bookIndex.regex.lastIndex = 0
            let full: RegExpExecArray | null
            while ((full = this.bookIndex.regex.exec(normalized)) !== null) {
                covered.push([full.index, full.index + full[0].length])
            }
        }

        BARE_VERSE_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = BARE_VERSE_REGEX.exec(normalized)) !== null) {
            const start = match.index + match[1].length
            if (covered.some(([from, to]) => start >= from && start < to)) continue
            if (this.anchorBookPrefix?.test(normalized.slice(0, start))) continue

            const groups = (match.groups || {}) as { n1?: string; n2?: string; end?: string }
            const verseStart = parseInt(groups.n1 ?? groups.n2 ?? "", 10)
            if (!(verseStart >= 1)) continue

            const verseEnd = groups.end !== undefined ? Math.max(verseStart, parseInt(groups.end, 10)) : verseStart

            this.tryEmit(
                {
                    book: this.anchor.book,
                    bookNumber: this.anchor.bookNumber,
                    chapter: this.anchor.chapter,
                    verseStart,
                    verseEnd,
                    confidence: 90,
                    type: "explicit",
                    quote: match[2]
                },
                "regex"
            )
        }
    }

    private maybeRunTier2(): void {
        const llm = this.opts.llm
        if (!llm || this.llmStopped) return

        if (this.llmController) {
            if (Date.now() - this.llmCallStartedAt <= LLM_API_TIMEOUT) {
                this.llmRerunPending = true
                return
            }
            this.llmController.abort()
            this.llmController = null
        }

        if (Date.now() < this.llmCooldownUntil || this.totalWords - this.wordsAtLastLlmCall < LLM_MIN_NEW_WORDS) return

        this.wordsAtLastLlmCall = this.totalWords
        const controller = new AbortController()
        this.llmController = controller
        this.llmCallStartedAt = Date.now()

        const transcript = this.segments.map((seg) => seg.text).join(" ")
        const liveContext = this.anchor ? `Live on screen: ${this.anchor.book} ${this.anchor.chapter}:${this.anchor.verseStart}-${this.anchor.verseEnd}. Bare verse mentions likely refer to this passage.` : undefined

        Promise.resolve()
            .then(() => getLLMScriptureProvider(llm.provider).detectScripture(llm.model, { transcript, alreadyDetected: this.recentDetectionStrings(), liveContext }, controller.signal))
            .then(
                (result: any) => {
                    if (this.llmController !== controller) return
                    this.llmController = null
                    this.llmPermanentFailures = 0
                    this.handleLlmReferences(Array.isArray(result?.references) ? result.references : [])
                    this.runPendingRerun()
                },
                (err: any) => {
                    if (this.llmController !== controller) return
                    this.llmController = null
                    this.handleLlmError(err)
                    this.runPendingRerun()
                }
            )
    }

    private runPendingRerun(): void {
        if (!this.llmRerunPending) return
        this.llmRerunPending = false
        if (!this.stopped) this.maybeRunTier2()
    }

    private handleLlmReferences(references: any[]): void {
        references.forEach((raw) => {
            const chapter = Math.floor(Number(raw?.chapter))
            const verseStart = Math.floor(Number(raw?.verseStart))
            if (!Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(verseStart) || verseStart < 1) return

            const verseEnd = Math.max(verseStart, Math.floor(Number(raw?.verseEnd)) || verseStart)
            const rawName = String(raw?.book || "").trim()
            const nameMatch = this.bookIndex.byToken.get(rawName.toLowerCase().replace(/\s+/g, " "))
            const bookNumber = nameMatch ? nameMatch.number : Math.floor(Number(raw?.bookNumber))

            if (!nameMatch && (!Number.isFinite(bookNumber) || bookNumber < 1 || bookNumber > 66)) return

            this.tryEmit(
                {
                    book: nameMatch ? nameMatch.name : rawName,
                    bookNumber,
                    chapter,
                    verseStart,
                    verseEnd,
                    confidence: (raw?.confidence as number) ?? 50,
                    type: raw?.type === "quoted" ? "quoted" : "explicit",
                    quote: typeof raw?.quote === "string" && raw.quote ? raw.quote : undefined
                },
                "llm"
            )
        })
    }

    private handleLlmError(err: any): void {
        const code = err?.code

        if (["invalid_key", "forbidden", "model_not_found", "invalid_request"].includes(code)) {
            this.llmPermanentFailures++
            console.error(`[AI Scripture] LLM ${String(code)}:`, err?.message || "")
            if (this.llmPermanentFailures >= 2) {
                this.llmStopped = true
                const target = this.opts.llm ? ` (${this.opts.llm.provider}: ${this.opts.llm.model || "default model"})` : ""
                this.opts.onStatus("llm_paused", { message: (err?.message || String(code)) + target })
            }
            return
        }

        if (code === "rate_limited") {
            const retryAfter = typeof err?.retryAfter === "number" && Number.isFinite(err.retryAfter) && err.retryAfter > 0 ? err.retryAfter : 15
            this.llmCooldownUntil = Date.now() + Math.min(retryAfter, 60) * 1000
        }
    }

    private tryEmit(candidate: DetectionCandidate, source: "regex" | "llm"): void {
        const now = Date.now()
        const key = `${candidate.bookNumber}.${candidate.chapter}`
        const keepMs = Math.max(this.cooldownMs, LLM_ALREADY_DETECTED_MS)
        const entries = (this.emitted.get(key) || []).filter((entry) => now - entry.timestamp < keepMs)

        const suppressed = entries.some((entry) => now - entry.timestamp < this.cooldownMs && candidate.verseStart <= entry.verseEnd && candidate.verseEnd >= entry.verseStart)
        if (!suppressed) {
            entries.push({ book: candidate.book, chapter: candidate.chapter, verseStart: candidate.verseStart, verseEnd: candidate.verseEnd, timestamp: now })
            this.opts.onDetection({
                id: `ai-${now.toString(36)}-${(this.idCounter++).toString(36)}`,
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
                if (now - entry.timestamp < LLM_ALREADY_DETECTED_MS) {
                    recent.push(`${entry.book} ${entry.chapter}:${entry.verseStart}-${entry.verseEnd}`)
                }
            })
        })
        return recent
    }

    private trimRollingTranscript(): void {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        while (this.segments.length > 1 && this.segments[0].endMs < newestEnd - ROLLING_MAX_MS) {
            this.segments.shift()
        }

        let chars = this.segments.reduce((total, seg) => total + seg.text.length, 0)
        while (this.segments.length > 1 && chars > ROLLING_MAX_CHARS) {
            chars -= this.segments[0].text.length
            this.segments.shift()
        }
    }
}
