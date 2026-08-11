// AI AUTO SCRIPTURE - quote matching: streaming state machine
// Consumes transcript segments and emits verse references when the speaker is RECITING scripture,
// with no LLM involved. Candidates come from an inverted-index vote over the rolling transcript
// window, are scored by ordered alignment (quoteMatchScore), and pass through:
//
//   - minimum-evidence floors, so coincidental overlap with sermon speech never emits
//   - anchor hysteresis, so a recitation stays in the chapter being read instead of jumping
//     to a similar verse in another book (parallel gospel passages are the classic trap)
//   - a continuation tracker, so a reading that flows into the next verse follows along
//
// The whole machine is pure: segments in, emissions out, time taken from segment timestamps.

import type { TranslationIndex } from "./quoteMatchIndex"
import { prefixIdf } from "./quoteMatchIndex"
import { alignQuoteWindow, classify, meetsFloors, TUNING, type AlignResult, type Tuning } from "./quoteMatchScore"
import { canonKey, tokenizeTranscript } from "./quoteMatchTokens"

export interface QuoteMatchSegment {
    text: string
    startMs: number
    endMs: number
}

export interface QuoteMatchAnchor {
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
}

export interface QuoteMatchEmission {
    book: number // the matched translation's book number (canon for 66-book bibles)
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium"
    translationId: string
    quoteText: string // the transcript stretch that matched
    kind: "fresh" | "continuation" | "upgrade"
}

interface Candidate {
    index: TranslationIndex
    ordinal: number
    align: AlignResult
    effectiveScore: number // raw score + anchor/consensus bonuses (threshold comparisons only)
    zone: number // 0 same chapter, 1 +-1 chapter, 2 same book, 3 cross book (relative to anchor/tracker)
    injected: boolean
}

interface ActiveTracker {
    translationId: string
    book: number
    chapter: number
    verseOrdinal: number // ordinal of the last emitted verse in its translation index
    lastAdvanceMs: number
}

interface RefKey {
    book: number
    chapter: number
    verseStart: number
    verseEnd: number
}

const refKey = (r: RefKey) => `${r.book}.${r.chapter}.${r.verseStart}-${r.verseEnd}`

// spoken cues announcing that a quote is coming ("Paul said", "the Bible says", "it is written").
// a cue only relaxes the SPEED bar (no waiting for a second confirming segment) - the evidence
// floors are untouched, so a cue can never turn sermon speech into a detection
const QUOTE_CUE_REGEX = /\b(?:bible|scriptures?|word(?: of god)?|jesus|christ|lord|god|apostle \w+|prophet \w+|paul|peter|john|james|moses|david|isaiah|solomon)\s+(?:says?|said|tells? us|told us|wrote|writes|declares?|reminds? us)\b|\bit is written\b/

export class QuoteMatcher {
    private indexes: TranslationIndex[]
    private tuning: Tuning

    private ring: { token: string; endMs: number }[] = []
    private lastSegmentEndMs = 0
    private cueUntilMs = 0 // a spoken quote cue is active until this transcript time

    private anchor: QuoteMatchAnchor | null = null
    private seededOrdinals: { index: TranslationIndex; ordinal: number }[] = []
    private tracker: ActiveTracker | null = null

    // canonical refs already emitted (with confidence, for the single medium->high upgrade)
    private emitted = new Map<string, { confidence: "high" | "medium"; upgraded: boolean }>()
    // sustained-path memory: the top ref of the previous segment
    private previousTop: { key: string; count: number } | null = null
    // cross-book escape hatch memory
    private escapeCandidate: { key: string; count: number } | null = null

    constructor(indexes: TranslationIndex[], tuning?: Partial<Tuning>) {
        this.indexes = indexes
        this.tuning = { ...TUNING, ...tuning }
    }

    setAnchor(anchor: QuoteMatchAnchor | null): void {
        // moving to an unrelated passage ends any active recitation tracking
        if (anchor && this.tracker && (this.tracker.book !== anchor.bookNumber || this.tracker.chapter !== anchor.chapter)) this.tracker = null
        this.anchor = anchor
    }

    /** A tier-1 explicit reference was just spoken - its verse becomes a guaranteed candidate. */
    noteExplicitReference(ref: { bookNumber: number; chapter: number; verseStart: number }): void {
        this.seededOrdinals = []
        for (const index of this.indexes) {
            const ordinal = findOrdinal(index, ref.bookNumber, ref.chapter, ref.verseStart)
            if (ordinal >= 0) this.seededOrdinals.push({ index, ordinal })
        }
    }

    reset(): void {
        this.ring = []
        this.tracker = null
        this.previousTop = null
        this.escapeCandidate = null
        this.seededOrdinals = []
        this.cueUntilMs = 0
        this.emitted.clear()
    }

    onSegment(segment: QuoteMatchSegment): QuoteMatchEmission[] {
        const tuning = this.tuning

        // a long silence means whatever was in the window is a different train of thought
        if (this.lastSegmentEndMs && segment.startMs - this.lastSegmentEndMs > tuning.GAP_RESET_MS) {
            this.ring = []
            this.previousTop = null
        }
        this.lastSegmentEndMs = segment.endMs

        if (QUOTE_CUE_REGEX.test(segment.text.toLowerCase())) this.cueUntilMs = segment.endMs + tuning.CUE_WINDOW_MS

        const tokens = tokenizeTranscript(segment.text).slice(0, tuning.SEGMENT_TOKEN_CAP)
        for (const token of tokens) this.ring.push({ token, endMs: segment.endMs })
        this.ring = this.ring.filter((entry) => segment.endMs - entry.endMs <= tuning.WINDOW_MAX_AGE_MS)
        if (this.ring.length > tuning.WINDOW_TOKENS) this.ring = this.ring.slice(-tuning.WINDOW_TOKENS)
        if (!tokens.length) return []

        // tracker expiry (measured on transcript time, so tests can drive the clock)
        if (this.tracker && segment.endMs - this.tracker.lastAdvanceMs > tuning.TRACKER_TTL_MS) this.tracker = null

        const candidates = this.scoreCandidates(segment.endMs)
        if (!candidates.length) {
            this.previousTop = null
            return []
        }

        const emissions: QuoteMatchEmission[] = []

        // continuation first: an active recitation extending into the next verse uses relaxed floors
        const continuation = this.tryContinuation(candidates, segment.endMs)
        if (continuation) emissions.push(continuation)

        const fresh = this.tryFresh(candidates, segment.endMs)
        for (const emission of fresh) emissions.push(emission)

        return emissions
    }

    // CANDIDATES

    private scoreCandidates(nowMs: number): Candidate[] {
        const tuning = this.tuning
        const query = this.ring.map((entry) => ({ token: entry.token, endMs: entry.endMs }))
        const out: Candidate[] = []

        for (const index of this.indexes) {
            const votes = new Map<number, number>()
            const keysHit = new Map<number, number>()
            const keyCounts = new Map<string, number>()
            for (const entry of this.ring) {
                const key = canonKey(entry.token)
                keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
            }

            keyCounts.forEach((count, key) => {
                const postings = index.postings.get(key)
                if (!postings) return
                const weight = prefixIdf(index, key) * Math.min(count, 2)
                for (const ordinal of postings) {
                    votes.set(ordinal, (votes.get(ordinal) || 0) + weight)
                    keysHit.set(ordinal, (keysHit.get(ordinal) || 0) + 1)
                }
            })

            const voted = Array.from(votes.entries())
                .filter(([ordinal, weight]) => weight >= tuning.MIN_VOTE_WEIGHT && (keysHit.get(ordinal) || 0) >= tuning.MIN_VOTE_KEYS)
                .sort((a, b) => b[1] - a[1])
                .slice(0, tuning.TOP_K)
                .map(([ordinal]) => ordinal)

            // also score each vote winner's PREDECESSOR: the spill window covers a recitation running
            // forward into the next verse, this covers one that STARTED on a short earlier verse whose
            // few rare words could never win the vote on their own
            for (const ordinal of [...voted]) {
                if (ordinal > 0 && index.book[ordinal - 1] === index.book[ordinal] && !voted.includes(ordinal - 1)) voted.push(ordinal - 1)
            }

            const injected = new Set<number>()
            if (this.anchor) {
                const from = findOrdinal(index, this.anchor.bookNumber, this.anchor.chapter, this.anchor.verseStart)
                const to = findOrdinal(index, this.anchor.bookNumber, this.anchor.chapter, this.anchor.verseEnd)
                if (from >= 0) for (let o = Math.max(0, from - 1); o <= Math.min(index.verseCount - 1, (to >= 0 ? to : from) + 3); o++) injected.add(o)
            }
            if (this.tracker && this.tracker.translationId === index.translationId) {
                for (let o = this.tracker.verseOrdinal; o <= Math.min(index.verseCount - 1, this.tracker.verseOrdinal + 3); o++) injected.add(o)
            }
            for (const seed of this.seededOrdinals) if (seed.index === index) injected.add(seed.ordinal)

            const ordinals = new Set<number>([...voted, ...injected])
            ordinals.forEach((ordinal) => {
                const align = alignQuoteWindow(query, index, ordinal, tuning)
                if (!align) return
                out.push({ index, ordinal, align, effectiveScore: 0, zone: 3, injected: injected.has(ordinal) })
            })
        }

        // zones + bonuses
        for (const candidate of out) {
            candidate.zone = this.zoneOf(candidate)
            const bonus = candidate.zone === 0 ? this.tuning.ANCHOR_BONUS_Z0 : candidate.zone === 1 ? this.tuning.ANCHOR_BONUS_Z1 : candidate.zone === 2 ? this.tuning.ANCHOR_BONUS_Z2 : 0
            candidate.effectiveScore = candidate.align.score + bonus
        }

        // consensus: another translation independently placing the same canonical ref above floors
        for (const candidate of out) {
            const agrees = out.some((other) => other !== candidate && other.index !== candidate.index && sameRef(candidate, other) && meetsFloors(other.align, this.tuning))
            if (agrees) candidate.effectiveScore += this.tuning.CONSENSUS_BONUS
        }

        void nowMs
        return out.sort((a, b) => b.effectiveScore - a.effectiveScore)
    }

    private zoneOf(candidate: Candidate): number {
        const book = candidate.index.book[candidate.ordinal]
        const chapter = candidate.index.chapter[candidate.ordinal]

        const bases: { book: number; chapter: number }[] = []
        if (this.anchor) bases.push({ book: this.anchor.bookNumber, chapter: this.anchor.chapter })
        if (this.tracker) bases.push({ book: this.tracker.book, chapter: this.tracker.chapter })
        if (!bases.length) return 3

        let best = 3
        for (const base of bases) {
            let zone = 3
            if (book === base.book) zone = chapter === base.chapter ? 0 : Math.abs(chapter - base.chapter) === 1 ? 1 : 2
            if (zone < best) best = zone
        }
        return best
    }

    // EMISSION PATHS

    private tryContinuation(candidates: Candidate[], nowMs: number): QuoteMatchEmission | null {
        if (!this.tracker) return null
        const tuning = this.tuning

        const nextOrdinal = this.tracker.verseOrdinal + 1
        const candidate = candidates.find((entry) => entry.index.translationId === this.tracker!.translationId && entry.ordinal === nextOrdinal)
        if (!candidate) return null

        const a = candidate.align
        const ok = a.matchedInformative >= tuning.CONT_MIN_INFORMATIVE && a.matchedWeight >= tuning.CONT_MIN_WEIGHT && a.density >= tuning.CONT_DENSITY && a.coverage >= tuning.CONT_COVERAGE
        if (!ok) return null

        const emission = this.emit(candidate, "high", "continuation", nowMs)
        return emission
    }

    private tryFresh(candidates: Candidate[], nowMs: number): QuoteMatchEmission[] {
        const tuning = this.tuning
        const top = candidates[0]
        if (!top) return []

        const confidence = classify(top.align, tuning)
        if (!confidence) {
            this.previousTop = null
            return []
        }

        const key = refKey(this.refOf(top))

        // cross-book protection: while a recitation is actively advancing near the anchor,
        // a cross-book candidate must decisively beat it, twice, before it may emit
        if (top.zone === 3) {
            const bestAnchored = candidates.find((entry) => entry.zone <= 2 && meetsFloors(entry.align, tuning))
            if (bestAnchored && top.align.score < bestAnchored.align.score + tuning.CROSS_BOOK_MARGIN) {
                return this.emitInstead(bestAnchored, nowMs)
            }
            if (top.align.matchedInformative < tuning.CROSS_BOOK_MIN_INFORMATIVE) {
                return bestAnchored ? this.emitInstead(bestAnchored, nowMs) : []
            }
            if (this.tracker && nowMs - this.tracker.lastAdvanceMs <= tuning.TRACKER_TTL_MS) {
                const trackerCandidate = candidates.find((entry) => entry.index.translationId === this.tracker!.translationId && entry.ordinal === this.tracker!.verseOrdinal)
                const trackerScore = trackerCandidate?.align.score ?? 0
                if (top.align.score < trackerScore + tuning.TRACKER_ESCAPE_MARGIN) return []
                const escapes = this.escapeCandidate && this.escapeCandidate.key === key ? this.escapeCandidate.count + 1 : 1
                this.escapeCandidate = { key, count: escapes }
                if (escapes < 2) return []
            }
        }

        // upgrade: an already-emitted medium ref re-detected at high strength gets one re-emission
        const already = this.emitted.get(key)
        if (already) {
            if (already.confidence === "medium" && confidence === "high" && !already.upgraded) {
                already.confidence = "high"
                already.upgraded = true
                return [this.emit(top, "high", "upgrade", nowMs, true)]
            }
            this.previousTop = { key, count: (this.previousTop?.key === key ? this.previousTop.count : 0) + 1 }
            return []
        }

        // strong single-shot: one utterance carrying a whole verse emits immediately. A spoken quote
        // cue ("the Bible says...") also skips the sustain wait - the floors still had to pass
        const singleShot = top.align.matchedInformative >= tuning.SINGLE_SHOT_INFORMATIVE && top.align.matchedWeight >= tuning.SINGLE_SHOT_WEIGHT && top.align.score >= tuning.EMIT_HIGH
        const cued = nowMs <= this.cueUntilMs
        const sustained = this.previousTop?.key === key ? this.previousTop.count + 1 : 1
        this.previousTop = { key, count: sustained }

        if (!singleShot && !cued && sustained < tuning.SUSTAIN_SEGMENTS) return []

        return [this.emit(top, confidence, "fresh", nowMs)]
    }

    /** The anchored candidate wins over a cross-book top - emit it if it qualifies on its own. */
    private emitInstead(candidate: Candidate, nowMs: number): QuoteMatchEmission[] {
        const tuning = this.tuning
        const confidence = classify(candidate.align, tuning)
        if (!confidence) return []

        const key = refKey(this.refOf(candidate))
        if (this.emitted.has(key)) return []

        const singleShot = candidate.align.matchedInformative >= tuning.SINGLE_SHOT_INFORMATIVE && candidate.align.matchedWeight >= tuning.SINGLE_SHOT_WEIGHT && candidate.align.score >= tuning.EMIT_HIGH
        const cued = nowMs <= this.cueUntilMs
        const sustained = this.previousTop?.key === key ? this.previousTop.count + 1 : 1
        this.previousTop = { key, count: sustained }
        if (!singleShot && !cued && sustained < tuning.SUSTAIN_SEGMENTS) return []

        return [this.emit(candidate, confidence, "fresh", nowMs)]
    }

    private refOf(candidate: Candidate): RefKey {
        const { index, ordinal, align } = candidate
        // enough of the recitation spilled into the following verse: report the range
        const spansNext = align.spillInformative >= 2 && ordinal + 1 < index.verseCount && index.book[ordinal + 1] === index.book[ordinal]
        return {
            book: index.book[ordinal],
            chapter: index.chapter[ordinal],
            verseStart: index.verseStart[ordinal],
            verseEnd: spansNext ? index.verseEnd[ordinal + 1] : index.verseEnd[ordinal]
        }
    }

    private emit(candidate: Candidate, confidence: "high" | "medium", kind: QuoteMatchEmission["kind"], nowMs: number, skipLedger = false): QuoteMatchEmission {
        const ref = this.refOf(candidate)
        const key = refKey(ref)
        if (!skipLedger) this.emitted.set(key, { confidence, upgraded: false })

        this.tracker = {
            translationId: candidate.index.translationId,
            book: ref.book,
            chapter: candidate.index.chapter[candidate.ordinal],
            verseOrdinal: candidate.ordinal + (ref.verseEnd > candidate.index.verseEnd[candidate.ordinal] ? 1 : 0),
            lastAdvanceMs: nowMs
        }
        this.previousTop = null
        this.escapeCandidate = null

        const quoteTokens = this.ring.slice(candidate.align.queryFrom, candidate.align.queryTo + 1).map((entry) => entry.token)

        return { ...ref, confidence, translationId: candidate.index.translationId, quoteText: quoteTokens.join(" "), kind }
    }
}

function sameRef(a: Candidate, b: Candidate): boolean {
    return a.index.book[a.ordinal] === b.index.book[b.ordinal] && a.index.chapter[a.ordinal] === b.index.chapter[b.ordinal] && a.index.verseStart[a.ordinal] === b.index.verseStart[b.ordinal]
}

/** Ordinal of a book/chapter/verse in an index, -1 when absent (verse ranges match containment). */
function findOrdinal(index: TranslationIndex, book: number, chapter: number, verse: number): number {
    for (let ordinal = 0; ordinal < index.verseCount; ordinal++) {
        if (index.book[ordinal] === book && index.chapter[ordinal] === chapter && verse >= index.verseStart[ordinal] && verse <= index.verseEnd[ordinal]) return ordinal
    }
    return -1
}
