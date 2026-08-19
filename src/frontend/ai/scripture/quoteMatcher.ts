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
import { BIGRAM_VOTE_IDF, bigramKey, bigramPostings, postingsForKey, prefixIdf } from "./quoteMatchIndex"
import { alignQuoteWindow, classify, meetsFloors, phraseEvidence, TUNING, type AlignResult, type QueryToken, type Tuning } from "./quoteMatchScore"
import { cachedPhoneticKey, canonKey, confusableAlternates, tokenizeTranscriptWithSpans } from "./quoteMatchTokens"

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
    substantial: boolean // clears the evidence floors or carries phrase evidence - junk alignments score 1.0 too (span-relative), this is what separates them
}

interface ActiveTracker {
    translationId: string
    book: number
    chapter: number
    verseOrdinal: number // ordinal of the last emitted verse in its translation index
    lastAdvanceMs: number
    // confidence of the emission that armed this tracker: continuations of a HIGH reading stay
    // high (auto-project), continuations of a MEDIUM suggestion stay suggestions
    seedConfidence: "high" | "medium"
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

    private ring: { token: string; endMs: number; seg: number; from: number; to: number }[] = []
    // raw segment texts still referenced by the ring, so emissions can quote the words as spoken
    private segmentTexts = new Map<number, string>()
    private segmentOrdinal = 0
    private lastSegmentEndMs = 0
    private cueUntilMs = 0 // a spoken quote cue is active until this transcript time

    private anchor: QuoteMatchAnchor | null = null
    private seededOrdinals: { index: TranslationIndex; ordinal: number }[] = []
    private tracker: ActiveTracker | null = null
    // chapters this session recently detected (transcript clock) - long-lived soft anchors
    private passageMemory: { book: number; chapter: number; atMs: number }[] = []
    // the translation of the last emission (seeded with the drawer's - the first index) - ties
    // between translations break toward it, so cards stop hopping versions mid-reading
    private stickyTranslationId: string | null = null

    // canonical refs already emitted (with confidence, for the single medium->high upgrade)
    private emitted = new Map<string, { confidence: "high" | "medium"; upgraded: boolean }>()
    // the last emission and WHEN its matched speech ended - a different ref built from the same
    // speech stretch is a reinterpretation (more words narrowed the search), not a second quote
    private lastEmitted: { ref: RefKey; queryToMs: number } | null = null
    // sustained-path memory: the top ref of the previous segment. phraseWeight is the baseline a
    // held short phrase run must GROW from before it may emit (see the phrase gate in tryFresh)
    private previousTop: { key: string; count: number; phraseWeight?: number } | null = null
    // cross-book escape hatch memory
    private escapeCandidate: { key: string; count: number } | null = null

    constructor(indexes: TranslationIndex[], tuning?: Partial<Tuning>) {
        this.indexes = indexes
        this.tuning = { ...TUNING, ...tuning }
        this.stickyTranslationId = indexes[0]?.translationId ?? null // the drawer translation is indexed first
    }

    setAnchor(anchor: QuoteMatchAnchor | null): void {
        // moving to an unrelated passage ends any active recitation tracking
        if (anchor && this.tracker && (this.tracker.book !== anchor.bookNumber || this.tracker.chapter !== anchor.chapter)) this.tracker = null
        this.anchor = anchor
    }

    get translationCount(): number {
        return this.indexes.length
    }

    /** Translations ticked mid-session join the running matcher (built on the same shared pool). */
    addIndexes(indexes: TranslationIndex[]): void {
        this.indexes.push(...indexes)
    }

    /**
     * The priority changed (favourites or the main translation): stable-sort the indexes into
     * the given order - earlier indexes win candidate ties, so the order IS the preference. The
     * bigram route stays on the index it was built for (one route is enough for fragments to
     * surface their verse).
     */
    reorderTranslations(order: string[]): void {
        const rank = new Map(order.map((id, position) => [id, position]))
        this.indexes = [...this.indexes].sort((a, b) => (rank.get(a.translationId) ?? order.length) - (rank.get(b.translationId) ?? order.length))
    }

    /** Translations removed mid-session leave; only state that points at them is dropped. */
    removeTranslations(translationIds: string[]): void {
        const removed = new Set(translationIds)
        this.indexes = this.indexes.filter((index) => !removed.has(index.translationId))
        this.seededOrdinals = this.seededOrdinals.filter((seed) => !removed.has(seed.index.translationId))
        if (this.tracker && removed.has(this.tracker.translationId)) this.tracker = null
        // the drawer translation is indexed first and can never be unticked away
        if (this.stickyTranslationId && removed.has(this.stickyTranslationId)) this.stickyTranslationId = this.indexes[0]?.translationId ?? null
    }

    /** A tier-1 explicit reference was just spoken - its verse becomes a guaranteed candidate. */
    noteExplicitReference(ref: { bookNumber: number; chapter: number; verseStart: number }): void {
        this.seededOrdinals = []
        for (const index of this.indexes) {
            const ordinal = findOrdinal(index, ref.bookNumber, ref.chapter, ref.verseStart)
            if (ordinal >= 0) this.seededOrdinals.push({ index, ordinal })
        }
        // a spoken reference declares the passage as surely as a matched quote does
        this.rememberPassage(ref.bookNumber, ref.chapter, this.lastSegmentEndMs)
    }

    private rememberPassage(book: number, chapter: number, atMs: number): void {
        this.passageMemory = [{ book, chapter, atMs }, ...this.passageMemory.filter((entry) => entry.book !== book || entry.chapter !== chapter)].slice(0, this.tuning.PASSAGE_MEMORY_MAX)
    }

    private rememberedPassages(nowMs: number): { book: number; chapter: number }[] {
        return this.passageMemory.filter((entry) => nowMs - entry.atMs <= this.tuning.PASSAGE_MEMORY_MS)
    }

    reset(): void {
        this.ring = []
        this.segmentTexts.clear()
        this.tracker = null
        this.previousTop = null
        this.escapeCandidate = null
        this.seededOrdinals = []
        this.cueUntilMs = 0
        this.emitted.clear()
        this.lastEmitted = null
        this.passageMemory = []
        this.stickyTranslationId = this.indexes[0]?.translationId ?? null
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

        const tokens = tokenizeTranscriptWithSpans(segment.text).slice(0, tuning.SEGMENT_TOKEN_CAP)
        const seg = this.segmentOrdinal++
        if (tokens.length) this.segmentTexts.set(seg, segment.text)
        for (const token of tokens) this.ring.push({ token: token.token, endMs: segment.endMs, seg, from: token.from, to: token.to })
        this.ring = this.ring.filter((entry) => segment.endMs - entry.endMs <= tuning.WINDOW_MAX_AGE_MS)
        if (this.ring.length > tuning.WINDOW_TOKENS) this.ring = this.ring.slice(-tuning.WINDOW_TOKENS)
        this.pruneSegmentTexts()
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
                // sound-alike routes are additive - "season" votes for "seasons" verses AND "ceasing" verses
                for (const alternateId of route.alternateIds) {
                    if (postingsForKey(index, alternateId)) canonCounts.set(alternateId, (canonCounts.get(alternateId) || 0) + route.count)
                }
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

            // bigram route (indexes that carry one - the drawer translation): adjacent word pairs
            // find the verses their individual words are too common to vote for ("was light" ->
            // Genesis 1:3), the way typing the fragment into bible search would
            if (index.bigramIds && index.bigramPool) {
                const bigramSeen = new Map<number, number>()
                for (let i = 1; i < this.ring.length; i++) {
                    const bigramId = index.bigramPool.lookup(bigramKey(canonKey(this.ring[i - 1].token), canonKey(this.ring[i].token)))
                    if (bigramId >= 0) bigramSeen.set(bigramId, (bigramSeen.get(bigramId) || 0) + 1)
                }
                bigramSeen.forEach((count, bigramId) => {
                    const postings = bigramPostings(index, bigramId)
                    if (!postings) return
                    const weight = BIGRAM_VOTE_IDF * Math.min(count, 2)
                    for (const ordinal of postings) {
                        votes.set(ordinal, (votes.get(ordinal) || 0) + weight)
                        keysHit.set(ordinal, (keysHit.get(ordinal) || 0) + 1)
                    }
                })
            }

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
                let align = alignQuoteWindow(query, index, ordinal, tuning)
                if (!align) return
                // matches leaking into the spill stretch the span and dilute coverage (the spill's
                // job is recitations that CROSS the verse boundary) - when a spill-free reading
                // scores better, the recitation lives inside the verse, so use that reading
                if (align.verseTo >= align.verseLength) {
                    const bare = alignQuoteWindow(query, index, ordinal, { ...tuning, SPILL_TOKENS: 0 })
                    if (bare && bare.score > align.score) align = bare
                }
                out.push({ index, ordinal, align, effectiveScore: 0, zone: 3, injected: injected.has(ordinal), substantial: false })
            })
        }

        // zones + bonuses. A junk alignment (one common word over its own tiny span) scores 1.0
        // just like a matched phrase - only candidates with real evidence earn the anchor bonus,
        // or an anchor-injected coincidence outranks a genuine match elsewhere forever
        for (const candidate of out) {
            candidate.zone = this.zoneOf(candidate, nowMs)
            candidate.substantial = meetsFloors(candidate.align, this.tuning) || phraseEvidence(candidate.align, this.tuning)
            const bonus = candidate.zone === 0 ? this.tuning.ANCHOR_BONUS_Z0 : candidate.zone === 1 ? this.tuning.ANCHOR_BONUS_Z1 : candidate.zone === 2 ? this.tuning.ANCHOR_BONUS_Z2 : 0
            candidate.effectiveScore = candidate.align.score + (candidate.substantial ? bonus : 0)
        }

        // consensus: another translation independently placing the same canonical ref above floors
        for (const candidate of out) {
            const agrees = out.some((other) => other !== candidate && other.index !== candidate.index && sameRef(candidate, other) && meetsFloors(other.align, this.tuning))
            if (agrees) candidate.effectiveScore += this.tuning.CONSENSUS_BONUS
        }

        // substance first: a junk coincidence scores 1.0 like a real match (span-relative), but it
        // must never outrank one - then by score within each class
        return out.sort((a, b) => (b.substantial ? 1 : 0) - (a.substantial ? 1 : 0) || b.effectiveScore - a.effectiveScore)
    }

    private zoneOf(candidate: Candidate, nowMs: number): number {
        const book = candidate.index.book[candidate.ordinal]
        const chapter = candidate.index.chapter[candidate.ordinal]

        const bases: { book: number; chapter: number }[] = []
        if (this.anchor) bases.push({ book: this.anchor.bookNumber, chapter: this.anchor.chapter })
        if (this.tracker) bases.push({ book: this.tracker.book, chapter: this.tracker.chapter })
        // the passage memory keeps guiding after the anchor/tracker expire - a sermon lives in
        // its chapters for minutes, and candidates near them must outrank look-alikes elsewhere
        for (const passage of this.rememberedPassages(nowMs)) bases.push({ book: passage.book, chapter: passage.chapter })
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

        // the seed confidence carries: a MEDIUM suggestion's relaxed-floor continuations must not
        // chain into auto-projected HIGHs the original evidence never earned
        const emission = this.emit(candidate, this.tracker.seedConfidence, "continuation", nowMs, false, candidates)
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

        // near-tied candidates need more than the span-relative score to rank: real evidence
        // (floors/phrase) beats a junk coincidence outright; a candidate clearing the FULL floors
        // beats one carrying only phrase evidence (the speech recites 3:6 whole while 10:48 merely
        // shares its opening formula); and among equals the one matching the EARLIEST transcript
        // stretch wins - a verse and the neighbor a reading flowed into tie at ~1.0, and the
        // earlier stretch is where the reading started
        const bandTop = candidates[0].effectiveScore
        for (const candidate of candidates) {
            if (candidate === top) continue
            if (bandTop - candidate.effectiveScore > tuning.TOP_TIE_BAND) break // sorted desc
            if (candidate.substantial && !top.substantial) {
                top = candidate
                continue
            }
            if (!candidate.substantial || !top.substantial) continue
            const candidateClassified = classify(candidate.align, tuning) !== null
            const topClassified = classify(top.align, tuning) !== null
            if (candidateClassified && !topClassified) {
                top = candidate
                continue
            }
            if (candidateClassified !== topClassified) continue
            // equally evidenced: stay with the translation being read/projected - near-identical
            // versions tie constantly, and hopping between them per verse reads as instability
            const candidateSticky = candidate.index.translationId === this.stickyTranslationId
            const topSticky = top.index.translationId === this.stickyTranslationId
            if (candidateSticky && !topSticky) {
                top = candidate
                continue
            }
            if (candidateSticky === topSticky && candidate.align.queryFrom < top.align.queryFrom) top = candidate
        }

        // a verse the reading already moved past keeps accumulating evidence (the window still
        // holds its words, and its spill covers the verse now being read) - never jump the
        // projection backwards while the recitation is live
        if (this.tracker && nowMs - this.tracker.lastAdvanceMs <= tuning.TRACKER_TTL_MS && top.index.translationId === this.tracker.translationId && top.index.book[top.ordinal] === this.tracker.book && top.ordinal < this.tracker.verseOrdinal) {
            return []
        }

        const key = refKey(this.refOf(top))
        const cued = nowMs <= this.cueUntilMs

        // a distinctive contiguous fragment is evidence in itself ("and there was light") - the
        // speaker quotes a phrase and reads the REST from the projection, so the full-recitation
        // floors must not be the only way in
        const phrase = phraseEvidence(top.align, tuning)

        let confidence = classify(top.align, tuning)
        if (!confidence && phrase) {
            // a 3-4 word run is often just conversational collocation ("are going to inherit",
            // "dont know whether ... see") - alone it proves nothing. And a run of ANY length that
            // several verses share is a liturgical formula ("in the name of jesus christ" - the
            // speaker is praying, not quoting one verse), which repetition can never disambiguate.
            // Either emits only in context: announced by a cue, spoken inside the anchored passage,
            // or GROWING as the speaker continues into one specific verse. Junk and formulas
            // re-score identically every segment and quietly age out
            const shortRun = top.align.bestRunLength < tuning.PHRASE_SHOT_MIN_RUN
            // loose translations (MSG/TPT) phrase verses in everyday English - "there is no such
            // thing as" is a long run of stopwords around ONE mid-rare word ("thing"). One rare
            // word in a run is coincidence; a genuine quoted fragment carries at least two
            const thinRun = top.align.bestRunPeaks < tuning.PHRASE_SHOT_MIN_PEAKS
            const rivaled = candidates.some((candidate) => candidate !== top && !sameRef(candidate, top) && phraseEvidence(candidate.align, tuning) && candidate.align.bestRunWeight >= top.align.bestRunWeight - tuning.PHRASE_RIVAL_MARGIN)
            if ((shortRun || thinRun || rivaled) && !cued && top.zone > 1) {
                const held = this.previousTop?.key === key ? this.previousTop : null
                const grown = held?.phraseWeight !== undefined && top.align.bestRunWeight >= held.phraseWeight + tuning.PHRASE_GROWTH_MIN
                if (!grown) {
                    this.previousTop = { key, count: held ? held.count + 1 : 1, phraseWeight: held?.phraseWeight !== undefined ? held.phraseWeight : top.align.bestRunWeight }
                    // the formula's echo may be drowning a verse the words actually RECITE - a
                    // candidate clearing the full floors still gets its (sustain-gated) shot
                    const recited = candidates.find((candidate) => candidate !== top && !sameRef(candidate, top) && classify(candidate.align, tuning))
                    if (recited) return this.emitInstead(recited, nowMs, candidates)
                    return []
                }
            }
            confidence = top.align.bestRunWeight >= tuning.PHRASE_HIGH_WEIGHT ? "high" : "medium"
        }
        if (!confidence) {
            // the top ref earns sustain credit while its evidence is still building - the floors
            // stay the safety bar, sustain only proves the window keeps pointing at the same verse
            this.bumpPreviousTop(key)
            return []
        }

        // cross-book protection: while a recitation is actively advancing near the anchor,
        // a cross-book candidate must decisively beat it, twice, before it may emit. "Decisively"
        // is a score margin OR weight dominance - parallel passages tie on both, while a candidate
        // the window's later words genuinely narrowed to pulls far ahead on matched weight.
        // With no anchor and no tracker there is nothing to be "cross" to - the floors alone gate
        if (top.zone === 3 && (this.anchor || this.tracker || this.rememberedPassages(nowMs).length)) {
            const dominates = (other: Candidate | undefined) => !other || top.align.matchedWeight >= other.align.matchedWeight * tuning.CORRECTION_WEIGHT_RATIO
            const bestAnchored = candidates.find((entry) => entry.zone <= 2 && meetsFloors(entry.align, tuning))
            // a cross-book reading that FULLY classifies high outranks an anchored candidate that
            // does not - the previous passage's words linger in the window and its verses keep
            // passing the floors on residue, which must never bury a decisive new reading
            const anchoredOutclassed = bestAnchored && classify(top.align, tuning) === "high" && classify(bestAnchored.align, tuning) !== "high"
            if (bestAnchored && !anchoredOutclassed && top.align.score < bestAnchored.align.score + tuning.CROSS_BOOK_MARGIN && !dominates(bestAnchored)) {
                return this.emitInstead(bestAnchored, nowMs, candidates)
            }
            if (top.align.matchedInformative < tuning.CROSS_BOOK_MIN_INFORMATIVE && !phrase) {
                if (bestAnchored) return this.emitInstead(bestAnchored, nowMs, candidates)
                // not enough informative evidence for a cross-book jump YET - the wait still
                // counts as sustain, so the emission lands right when the evidence does
                this.bumpPreviousTop(key)
                return []
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
                    this.bumpPreviousTop(key)
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
                return [this.emit(top, "high", "upgrade", nowMs, true, candidates)]
            }
            this.bumpPreviousTop(key)
            return []
        }

        // strong single-shot: one utterance carrying a whole verse emits immediately. A spoken quote
        // cue ("the Bible says...") also skips the sustain wait - the floors still had to pass.
        // A distinctive fragment emits immediately too, UNLESS another verse shares the same phrase
        // (parallel passages, liturgical formulas) - ambiguity waits for the sustain to settle it
        const singleShot = top.align.matchedInformative >= tuning.SINGLE_SHOT_INFORMATIVE && top.align.matchedWeight >= tuning.SINGLE_SHOT_WEIGHT && top.align.score >= tuning.EMIT_HIGH
        const phraseShot = phrase && !candidates.some((candidate) => candidate !== top && !sameRef(candidate, top) && phraseEvidence(candidate.align, tuning) && candidate.align.bestRunWeight >= top.align.bestRunWeight - tuning.PHRASE_RIVAL_MARGIN)
        const sustained = this.bumpPreviousTop(key)

        if (!singleShot && !cued && !phraseShot && sustained < tuning.SUSTAIN_SEGMENTS) return []

        // a stronger match for the SAME speech that fired the previous emission means more words
        // narrowed the search - supersede that emission instead of standing next to it
        const corrects = confidence === "high" ? this.correctionTarget(top) : null
        const emission = this.emit(top, confidence, corrects ? "correction" : "fresh", nowMs, false, candidates)
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
    private emitInstead(candidate: Candidate, nowMs: number, pool: Candidate[] = []): QuoteMatchEmission[] {
        const tuning = this.tuning
        const confidence = classify(candidate.align, tuning)
        if (!confidence) return []

        const key = refKey(this.refOf(candidate))
        if (this.emitted.has(key)) return []

        const singleShot = candidate.align.matchedInformative >= tuning.SINGLE_SHOT_INFORMATIVE && candidate.align.matchedWeight >= tuning.SINGLE_SHOT_WEIGHT && candidate.align.score >= tuning.EMIT_HIGH
        const cued = nowMs <= this.cueUntilMs
        const sustained = this.bumpPreviousTop(key)
        if (!singleShot && !cued && sustained < tuning.SUSTAIN_SEGMENTS) return []

        return [this.emit(candidate, confidence, "fresh", nowMs, false, pool)]
    }

    /**
     * Sustain bookkeeping: bump the consecutive-top count for a ref, PRESERVING any held phrase
     * baseline - the growth gate reads previousTop.phraseWeight on a later segment, and a write
     * that drops it would re-baseline a held fragment at its already-grown weight (deadlock).
     */
    private bumpPreviousTop(key: string): number {
        const held = this.previousTop?.key === key ? this.previousTop : null
        const count = held ? held.count + 1 : 1
        this.previousTop = { key, count, phraseWeight: held?.phraseWeight }
        return count
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

    /**
     * Grounded in the main translation: when the SAME verse also qualifies there (within the tie
     * band), the emission stays in it - another translation only surfaces when the spoken wording
     * decisively lives in that translation alone.
     */
    private preferGrounded(pool: Candidate[], chosen: Candidate): Candidate {
        if (!this.stickyTranslationId || chosen.index.translationId === this.stickyTranslationId) return chosen
        const grounded = pool.find((candidate) => candidate.index.translationId === this.stickyTranslationId && sameRef(candidate, chosen))
        if (!grounded) return chosen
        const qualifies = meetsFloors(grounded.align, this.tuning) || phraseEvidence(grounded.align, this.tuning)
        return qualifies && grounded.effectiveScore >= chosen.effectiveScore - this.tuning.TOP_TIE_BAND ? grounded : chosen
    }

    private emit(chosen: Candidate, confidence: "high" | "medium", kind: QuoteMatchEmission["kind"], nowMs: number, skipLedger = false, pool: Candidate[] = []): QuoteMatchEmission {
        const candidate = this.preferGrounded(pool, chosen)
        const ref = this.refOf(candidate)
        const key = refKey(ref)
        if (!skipLedger) this.emitted.set(key, { confidence, upgraded: false })
        this.rememberPassage(ref.book, candidate.index.chapter[candidate.ordinal], nowMs)
        this.stickyTranslationId = candidate.index.translationId

        this.tracker = {
            translationId: candidate.index.translationId,
            book: ref.book,
            chapter: candidate.index.chapter[candidate.ordinal],
            verseOrdinal: candidate.ordinal,
            lastAdvanceMs: nowMs,
            seedConfidence: confidence
        }
        this.previousTop = null
        this.escapeCandidate = null
        this.lastEmitted = { ref, queryToMs: this.ring[candidate.align.queryTo]?.endMs ?? nowMs }

        // a phrase-only emission quotes the run itself - the full alignment span is stretched by
        // scattered common-word matches and would show unrelated speech around the fragment
        const a = candidate.align
        const phraseOnly = a.bestRunQueryFrom >= 0 && !classify(a, this.tuning) && phraseEvidence(a, this.tuning)
        const quoteText = phraseOnly ? this.quoteTextFor(a.bestRunQueryFrom, a.bestRunQueryTo) : this.quoteTextFor(a.queryFrom, a.queryTo)

        return { ...ref, confidence, translationId: candidate.index.translationId, quoteText, kind }
    }

    /** The words as actually spoken (casing/punctuation intact), sliced from the raw segment texts. */
    private quoteTextFor(from: number, to: number): string {
        const entries = this.ring.slice(from, to + 1)
        if (!entries.length) return ""

        const parts: string[] = []
        let currentSeg = -1
        let sliceFrom = 0
        let sliceTo = 0
        for (const entry of entries) {
            if (entry.seg !== currentSeg) {
                if (currentSeg >= 0) parts.push((this.segmentTexts.get(currentSeg) || "").slice(sliceFrom, sliceTo))
                currentSeg = entry.seg
                sliceFrom = entry.from
            }
            sliceTo = entry.to
        }
        if (currentSeg >= 0) parts.push((this.segmentTexts.get(currentSeg) || "").slice(sliceFrom, sliceTo))

        // raw text can only be missing on stale state - normalized tokens beat an empty quote
        return parts.filter((part) => part.length).join(" ") || entries.map((entry) => entry.token).join(" ")
    }

    // the ring holds at most WINDOW_TOKENS entries - drop the raw texts nothing references anymore
    private pruneSegmentTexts(): void {
        const oldest = this.ring.length ? this.ring[0].seg : this.segmentOrdinal
        for (const seg of this.segmentTexts.keys()) {
            if (seg < oldest) this.segmentTexts.delete(seg)
        }
    }
}

interface TokenRoute {
    canonId: number // pool id of the token's canonical prefix key, -1 when never indexed
    phoneticId: number // pool id of the token's "~"-namespaced phonetic skeleton, -1 when none
    alternateIds: number[] // pool ids of the token's sound-alikes ("season" also votes as "ceasing")
    count: number
}

/** The lookup routes per distinct spoken token (tokens resolving to none drop out). */
function resolveTokenRoutes(pool: PrefixPool, tokenCounts: Map<string, number>): TokenRoute[] {
    const routes: TokenRoute[] = []
    tokenCounts.forEach((count, token) => {
        const canonId = pool.lookup(canonKey(token))
        const skeleton = cachedPhoneticKey(token)
        const phoneticId = skeleton ? pool.lookup("~" + skeleton) : -1

        // sound-alike alternates vote alongside the canon key, or a verse findable only through
        // the word the speaker MEANT never becomes a candidate (the grade stage discounts the
        // actual match to 0.85)
        const alternateIds: number[] = []
        for (const alternate of confusableAlternates(token)) {
            const id = pool.lookup(canonKey(alternate))
            if (id >= 0 && id !== canonId && !alternateIds.includes(id)) alternateIds.push(id)
        }

        if (canonId >= 0 || phoneticId >= 0 || alternateIds.length) routes.push({ canonId, phoneticId, alternateIds, count })
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
