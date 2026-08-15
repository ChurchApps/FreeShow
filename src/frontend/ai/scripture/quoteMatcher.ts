// AI AUTO SCRIPTURE - quote matching: streaming state machine
// Consumes transcript segments and emits verse references when the speaker is RECITING scripture,
// with no LLM involved. Candidates come from an inverted-index vote over the rolling transcript
// window, are scored by ordered alignment (quoteMatchScore), and pass through:
//
//   - minimum-evidence floors, so coincidental overlap with sermon speech never emits
//   - anchor hysteresis, so a recitation stays in the chapter being read instead of jumping
//     to a similar verse in another book (parallel gospel passages are the classic trap)
//   - a continuation tracker, so a reading that flows into the next verse follows along
//   - a correction path, so a similar-passage mispick is superseded once later words settle it
//
// Emissions are per verse - the verse being read RIGHT NOW - and a reading advances verse by
// verse through continuations. The whole machine is pure: segments in, emissions out, time
// taken from segment timestamps.

import type { PrefixPool, TranslationIndex } from "./quoteMatchIndex"
import { postingsForKey, prefixIdf } from "./quoteMatchIndex"
import { alignQuoteWindow, classify, meetsFloors, TUNING, type AlignResult, type QueryToken, type Tuning } from "./quoteMatchScore"
import { cachedPhoneticKey, canonKey, tokenizeTranscript } from "./quoteMatchTokens"

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
    kind: "fresh" | "continuation" | "upgrade" | "correction"
    corrects?: RefKey // correction only: the earlier emission this one supersedes (same speech, better match)
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

export interface RefKey {
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
    // the last emission and WHEN its matched speech ended - a different ref built from the same
    // speech stretch is a reinterpretation (more words narrowed the search), not a second quote
    private lastEmitted: { ref: RefKey; queryToMs: number } | null = null
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
        this.lastEmitted = null
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

    private windowQuery(): QueryToken[] {
        return this.ring.map((entry) => ({ token: entry.token, endMs: entry.endMs }))
    }

    private scoreCandidates(nowMs: number): Candidate[] {
        const tuning = this.tuning
        const query = this.windowQuery()
        const out: Candidate[] = []

        // resolve each distinct spoken token's lookup routes ONCE for all translations (a session
        // builds every index over one shared pool - separately built indexes fall back to their
        // own pool per index), so voting is pure typed-array reads. A token has two routes: its
        // canonical prefix key, and - only when that key finds nothing in an index - its phonetic
        // skeleton, so a misheard rare word ("analekite") still votes and still counts toward
        // keysHit, while a correctly heard word can never vote twice
        const tokenCounts = new Map<string, number>()
        for (const entry of this.ring) {
            tokenCounts.set(entry.token, (tokenCounts.get(entry.token) || 0) + 1)
        }
        const sharedPool = this.indexes.length && this.indexes.every((index) => index.pool === this.indexes[0].pool) ? this.indexes[0].pool : null
        const sharedRoutes = sharedPool ? resolveTokenRoutes(sharedPool, tokenCounts) : null

        for (const index of this.indexes) {
            const routes = sharedRoutes || resolveTokenRoutes(index.pool, tokenCounts)
            const votes = new Map<number, number>()
            const keysHit = new Map<number, number>()

            // aggregate per resolved id (distinct ring tokens can share a key) - the phonetic
            // fallback is decided per index, since each translation drops/keeps its own postings
            const canonCounts = new Map<number, number>()
            const phoneticCounts = new Map<number, number>()
            for (const route of routes) {
                if (postingsForKey(index, route.canonId)) canonCounts.set(route.canonId, (canonCounts.get(route.canonId) || 0) + route.count)
                else if (route.phoneticId >= 0 && postingsForKey(index, route.phoneticId)) phoneticCounts.set(route.phoneticId, (phoneticCounts.get(route.phoneticId) || 0) + route.count)
            }

            const castVotes = (idCounts: Map<number, number>, discount: number) => {
                idCounts.forEach((count, prefixId) => {
                    const postings = postingsForKey(index, prefixId)
                    if (!postings) return
                    const weight = prefixIdf(index, prefixId) * Math.min(count, 2) * discount
                    for (const ordinal of postings) {
                        votes.set(ordinal, (votes.get(ordinal) || 0) + weight)
                        keysHit.set(ordinal, (keysHit.get(ordinal) || 0) + 1)
                    }
                })
            }
            castVotes(canonCounts, 1)
            castVotes(phoneticCounts, tuning.PHONETIC_VOTE_DISCOUNT)

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
        // ordinal + 1 at the end of a book is another book's first verse - never a continuation
        if (candidate.index.book[nextOrdinal] !== this.tracker.book) return null

        const a = candidate.align
        const informativeOk = a.density >= tuning.CONT_DENSITY && a.coverage >= tuning.CONT_COVERAGE && a.matchedInformative >= tuning.CONT_MIN_INFORMATIVE && a.matchedWeight >= tuning.CONT_MIN_WEIGHT
        if (!informativeOk && !this.verbatimContinuation(candidate)) return null

        const emission = this.emit(candidate, "high", "continuation", nowMs)
        return emission
    }

    /**
     * Start-to-end recitation of the whole next verse: accepted even when its words are all too
     * common to count as informative ("And God said, Let there be light..."). Judged on a
     * spill-free realignment - the verse AFTER next often shares those same common words, and
     * spill matches would otherwise stretch the span and dilute its coverage.
     */
    private verbatimContinuation(candidate: Candidate): boolean {
        const tuning = this.tuning
        const bare = alignQuoteWindow(this.windowQuery(), candidate.index, candidate.ordinal, { ...tuning, SPILL_TOKENS: 0 })
        if (!bare) return false
        return bare.verseFrom <= 1 && bare.verseTo >= bare.verseLength - 2 && bare.density >= tuning.CONT_VERBATIM_DENSITY && bare.coverage >= tuning.CONT_VERBATIM_COVERAGE && bare.matched >= tuning.CONT_VERBATIM_MATCHED
    }

    private tryFresh(candidates: Candidate[], nowMs: number): QuoteMatchEmission[] {
        const tuning = this.tuning
        let top = candidates[0]
        if (!top) return []

        // near-tied candidates are usually a verse and the neighbor one reading flowed into (the
        // span-relative score can't separate them): the one matching the earliest transcript
        // stretch is where the reading started, so it emits first and continuation advances
        for (const candidate of candidates) {
            if (candidate === top) continue
            if (top.effectiveScore - candidate.effectiveScore > tuning.TOP_TIE_BAND) break // sorted desc
            if (candidate.align.queryFrom < top.align.queryFrom && meetsFloors(candidate.align, tuning)) top = candidate
        }

        const key = refKey(this.refOf(top))

        const confidence = classify(top.align, tuning)
        if (!confidence) {
            // the top ref earns sustain credit while its evidence is still building - the floors
            // stay the safety bar, sustain only proves the window keeps pointing at the same verse
            this.previousTop = { key, count: this.previousTop?.key === key ? this.previousTop.count + 1 : 1 }
            return []
        }

        // cross-book protection: while a recitation is actively advancing near the anchor,
        // a cross-book candidate must decisively beat it, twice, before it may emit. "Decisively"
        // is a score margin OR weight dominance - parallel passages tie on both, while a candidate
        // the window's later words genuinely narrowed to pulls far ahead on matched weight.
        // With no anchor and no tracker there is nothing to be "cross" to - the floors alone gate
        if (top.zone === 3 && (this.anchor || this.tracker)) {
            const dominates = (other: Candidate | undefined) => !other || top.align.matchedWeight >= other.align.matchedWeight * tuning.CORRECTION_WEIGHT_RATIO
            const bestAnchored = candidates.find((entry) => entry.zone <= 2 && meetsFloors(entry.align, tuning))
            if (bestAnchored && top.align.score < bestAnchored.align.score + tuning.CROSS_BOOK_MARGIN && !dominates(bestAnchored)) {
                return this.emitInstead(bestAnchored, nowMs)
            }
            if (top.align.matchedInformative < tuning.CROSS_BOOK_MIN_INFORMATIVE) {
                return bestAnchored ? this.emitInstead(bestAnchored, nowMs) : []
            }
            if (this.tracker && nowMs - this.tracker.lastAdvanceMs <= tuning.TRACKER_TTL_MS) {
                const trackerCandidate = candidates.find((entry) => entry.index.translationId === this.tracker!.translationId && entry.ordinal === this.tracker!.verseOrdinal)
                const trackerScore = trackerCandidate?.align.score ?? 0
                if (top.align.score < trackerScore + tuning.TRACKER_ESCAPE_MARGIN && !dominates(trackerCandidate)) return []
                const escapes = this.escapeCandidate && this.escapeCandidate.key === key ? this.escapeCandidate.count + 1 : 1
                this.escapeCandidate = { key, count: escapes }
                if (escapes < 2) {
                    // escape counting doubles as sustain credit, so the eventual emission is not
                    // delayed a second time by the sustain wait it already served here
                    this.previousTop = { key, count: this.previousTop?.key === key ? this.previousTop.count + 1 : 1 }
                    return []
                }
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

        // a stronger match for the SAME speech that fired the previous emission means more words
        // narrowed the search - supersede that emission instead of standing next to it
        const corrects = confidence === "high" ? this.correctionTarget(top) : null
        const emission = this.emit(top, confidence, corrects ? "correction" : "fresh", nowMs)
        if (corrects) emission.corrects = corrects
        return [emission]
    }

    /** The earlier emission this candidate supersedes, or null when it is simply a new quote. */
    private correctionTarget(candidate: Candidate): RefKey | null {
        const last = this.lastEmitted
        if (!last) return null
        const ref = this.refOf(candidate)
        if (refKey(ref) === refKey(last.ref)) return null
        // same chapter is a reading advancing (or a refrain), never a mispick to retract
        if (ref.book === last.ref.book && ref.chapter === last.ref.chapter) return null
        const fromMs = this.ring[candidate.align.queryFrom]?.endMs
        return fromMs !== undefined && fromMs <= last.queryToMs ? { ...last.ref } : null
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
        const { index, ordinal } = candidate
        // always the single verse being read - a recitation flowing onward advances verse by verse
        // through the continuation tracker. Showing verses combined is the speaker's explicit call
        // (a spoken range reference), never the matcher's. Verses merged by the translation itself
        // (verseEnd > verseStart in the index) stay one unit.
        return {
            book: index.book[ordinal],
            chapter: index.chapter[ordinal],
            verseStart: index.verseStart[ordinal],
            verseEnd: index.verseEnd[ordinal]
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
            verseOrdinal: candidate.ordinal,
            lastAdvanceMs: nowMs
        }
        this.previousTop = null
        this.escapeCandidate = null
        this.lastEmitted = { ref, queryToMs: this.ring[candidate.align.queryTo]?.endMs ?? nowMs }

        const quoteTokens = this.ring.slice(candidate.align.queryFrom, candidate.align.queryTo + 1).map((entry) => entry.token)

        return { ...ref, confidence, translationId: candidate.index.translationId, quoteText: quoteTokens.join(" "), kind }
    }
}

interface TokenRoute {
    canonId: number // pool id of the token's canonical prefix key, -1 when never indexed
    phoneticId: number // pool id of the token's "~"-namespaced phonetic skeleton, -1 when none
    count: number
}

/** Both lookup routes per distinct spoken token (tokens resolving to neither drop out). */
function resolveTokenRoutes(pool: PrefixPool, tokenCounts: Map<string, number>): TokenRoute[] {
    const routes: TokenRoute[] = []
    tokenCounts.forEach((count, token) => {
        const canonId = pool.lookup(canonKey(token))
        const skeleton = cachedPhoneticKey(token)
        const phoneticId = skeleton ? pool.lookup("~" + skeleton) : -1
        if (canonId >= 0 || phoneticId >= 0) routes.push({ canonId, phoneticId, count })
    })
    return routes
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
