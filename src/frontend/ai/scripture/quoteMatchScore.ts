// AI AUTO SCRIPTURE - quote matching: alignment scoring
// Scores a window of transcript tokens against one candidate verse (plus a spill into the next
// verse, so recitations crossing a verse boundary still score). The core is an order-aware
// weighted longest-common-subsequence: gaps are free, because the two normalizers ARE the
// penalty - cherry-picked far-apart matches inflate the verse span (denting coverage) and the
// query span (denting density). That kills bag-of-words coincidences without a tuned gap cost.

import { tokenGrade } from "./quoteMatchTokens"
import { verseTokensAt, type TranslationIndex } from "./quoteMatchIndex"

export const TUNING = {
    WINDOW_TOKENS: 48, // rolling transcript query size (~2 average verses of speech)
    WINDOW_MAX_AGE_MS: 25000,
    GAP_RESET_MS: 15000, // transcript silence that clears the rolling window
    SEGMENT_TOKEN_CAP: 60,
    SPILL_TOKENS: 24, // next-verse tokens appended to the scoring window

    TOP_K: 8, // candidates scored per segment (beyond injected ones)
    // scores are span-relative, so a verse and the neighbor a reading flowed into often tie at
    // ~1.0. Within this band the candidate matching the EARLIEST transcript stretch wins - that
    // is where the reading started, and continuations advance from there
    TOP_TIE_BAND: 0.05,
    // 2, not 3: a short verse ("The LORD is my shepherd; I shall not want.") only OWNS two rare
    // keys - the weight floor still demands real idf mass, and the emission floors do the rest
    MIN_VOTE_KEYS: 2,
    MIN_VOTE_WEIGHT: 6,
    // a phonetic-skeleton vote (misheard rare word) counts, but weaker than a prefix-key hit
    PHONETIC_VOTE_DISCOUNT: 0.7,

    DENSITY_REF: 0.7,
    DENSITY_FLOOR: 0.6,
    MIN_INFORMATIVE: 5,
    MIN_WEIGHT: 14,
    MIN_QUERY_SPAN: 6,
    // fuzzy grades (0.8 stems / 0.75 shared-prefix / 0.7 phonetic) exist to forgive 1-2 mangled
    // words inside a real recitation - an alignment BUILT of partial credits is transcription
    // debris, and this caps how much of one may be fuzzy
    FUZZY_MAX_FRACTION: 0.34,

    EMIT_MEDIUM: 0.52,
    EMIT_HIGH: 0.66,
    HIGH_MIN_INFORMATIVE: 6,
    // high auto-projects - it must mean a solidly recited stretch, not a window of thematic
    // vocabulary plus a truncated rare word
    HIGH_MIN_WEIGHT: 22,

    SINGLE_SHOT_INFORMATIVE: 8, // immediate emission from one segment
    SINGLE_SHOT_WEIGHT: 24,
    SUSTAIN_SEGMENTS: 2, // otherwise: same ref on top for this many consecutive segments
    CUE_WINDOW_MS: 12000, // after "the Bible says" / "Jesus said" etc, the sustain wait is skipped

    // short-fragment path: a CONTIGUOUS ordered run shared with a verse is evidence in itself -
    // "let there be light" is four common words, but as a sequence it is nearly unique in the
    // whole bible. Each adjacency multiplies specificity, captured as a flat idf-equivalent
    // bonus; the peak floor demands one genuinely uncommon word in the run, which is what
    // separates a quoted fragment from liturgical filler ("in the name of jesus")
    PHRASE_MIN_RUN: 3,
    // an isolated (uncued, unanchored) run must be at least this long to emit on sight - shorter
    // runs are everyday collocations often enough ("are going to inherit", "dont know whether")
    // that they need context: a cue, the anchored passage, or growth as the speaker keeps quoting
    PHRASE_SHOT_MIN_RUN: 5,
    // a held short run emits once its weight grows by this much on a later segment (one more
    // matched word adds ~3 with its adjacency bonus; a static junk run re-scores identically)
    PHRASE_GROWTH_MIN: 2,
    PHRASE_ADJACENCY_IDF: 2.2,
    // 16 is measured, not guessed: real sermon chatter produces runs up to ~15 ("makes it
    // plain" -> Habakkuk 2:2, "week and we give" -> Genesis 29:27), while wanted fragments
    // ("and there was light" 17.4, "for god so loved" 19+) clear it
    PHRASE_MIN_WEIGHT: 16,
    PHRASE_HIGH_WEIGHT: 22,
    PHRASE_MIN_PEAK_IDF: 4,
    // a run only records its best on a non-trivial token: liturgical fragments diverge from the
    // verse right after the shared words ("glory to god IN..."), so a weak trailing extension
    // must not carry a run over the floor
    PHRASE_EDGE_MIN_IDF: 1.5,
    // another verse is a real phrase RIVAL (ambiguity - wait for sustain) only when its run
    // carries comparable weight; "the shadow of death" in Job must not hold back "the VALLEY of
    // the shadow of death" in Psalm 23
    PHRASE_RIVAL_MARGIN: 4,

    CONT_MIN_INFORMATIVE: 4, // relaxed continuation floors (sequential prior)
    CONT_MIN_WEIGHT: 10,
    CONT_DENSITY: 0.6,
    CONT_COVERAGE: 0.5,
    // a short next verse of all-common words ("And God said, Let there be light...") can never
    // produce informative matches - reciting essentially ALL of it verbatim continues instead
    CONT_VERBATIM_DENSITY: 0.75,
    CONT_VERBATIM_COVERAGE: 0.8,
    CONT_VERBATIM_MATCHED: 6,

    ANCHOR_BONUS_Z0: 0.1, // same book+chapter as the live passage
    ANCHOR_BONUS_Z1: 0.05, // same book, +-1 chapter
    ANCHOR_BONUS_Z2: 0.02, // same book
    CROSS_BOOK_MARGIN: 0.12, // raw-score lead a cross-book candidate needs over the best anchored one
    CROSS_BOOK_MIN_INFORMATIVE: 7,
    TRACKER_ESCAPE_MARGIN: 0.25, // cross-book lead needed to override an actively advancing recitation
    // scores are span-relative (a matched opening stretch scores like a matched whole verse), so
    // score margins can't see one candidate PULLING AHEAD in evidence. Carrying this much more
    // matched idf weight than the anchored/tracked candidate bypasses the score-margin gates -
    // that is how a similar-passage mispick gets corrected once later words settle the ambiguity
    CORRECTION_WEIGHT_RATIO: 1.6,
    TRACKER_TTL_MS: 20000,

    CONSENSUS_BONUS: 0.04, // two translations independently agree on the ref

    // passage memory: chapters the session recently detected keep guiding candidate ranking
    // (anchor-style zones) after the tracker/anchor expire - a sermon lives in a passage for
    // minutes, and without this the matcher "jumps all over the place" between look-alikes
    PASSAGE_MEMORY_MS: 240000,
    PASSAGE_MEMORY_MAX: 5
}

export type Tuning = typeof TUNING

export interface QueryToken {
    token: string
    endMs: number // end time of the segment the token arrived in
}

export interface AlignResult {
    score: number
    coverage: number
    density: number
    matched: number
    matchedInformative: number
    matchedWeight: number
    matchedFuzzy: number // matches below the prefix grade (0.8/0.75/0.7) - partial-credit forgiveness
    queryFrom: number // first/last matched positions in the query window
    queryTo: number
    verseFrom: number // first/last matched positions in the verse window (verse + spill)
    verseTo: number
    spillInformative: number // informative matches landing in the spill region
    verseLength: number // tokens in the verse itself (spill excluded)
    // best contiguous ordered run (adjacent in BOTH query and verse): the short-fragment evidence
    bestRunLength: number
    bestRunWeight: number // matched weight of the run + an adjacency bonus per consecutive pair
    bestRunPeakIdf: number // highest token idf inside that run
    bestRunQueryFrom: number // the run's query span, so a phrase emission can quote the run itself (-1 when no run)
    bestRunQueryTo: number
}

/**
 * Align the query window against verse `ordinal` (+ spill from the next ordinal in the same book).
 * Returns null when nothing aligned.
 */
export function alignQuoteWindow(query: QueryToken[], index: TranslationIndex, ordinal: number, tuning: Tuning = TUNING): AlignResult | null {
    if (ordinal < 0 || ordinal >= index.verseCount || !query.length) return null
    const verseIds = verseTokensAt(index, ordinal)

    const verseLength = verseIds.length
    const next = ordinal + 1
    const spillIds = next < index.verseCount && index.book[next] === index.book[ordinal] ? verseTokensAt(index, next).subarray(0, tuning.SPILL_TOKENS) : new Uint16Array(0)

    const m = query.length
    const n = verseLength + spillIds.length
    const verseTokenAt = (j: number) => index.vocab[j < verseLength ? verseIds[j] : spillIds[j - verseLength]]
    const verseIdfAt = (j: number) => index.idfByVocabId[j < verseLength ? verseIds[j] : spillIds[j - verseLength]]

    // phonetic recovery only against informative verse tokens (proper nouns, rare words) - common
    // words never phonetic-merge. The flag must be computed identically in the DP fill and the
    // backtrace below, or the backtrace desynchronizes from the table
    const informativeIdf = index.informativeIdf

    // weighted LCS: dp[i][j] = best matched weight of query[0..i) vs verse[0..j)
    const width = n + 1
    const dp = new Float32Array((m + 1) * width)
    for (let i = 1; i <= m; i++) {
        const q = query[i - 1].token
        for (let j = 1; j <= n; j++) {
            const skip = Math.max(dp[(i - 1) * width + j], dp[i * width + j - 1])
            const idf = verseIdfAt(j - 1)
            const grade = tokenGrade(q, verseTokenAt(j - 1), idf >= informativeIdf)
            const take = grade > 0 ? dp[(i - 1) * width + j - 1] + grade * idf : 0
            dp[i * width + j] = take > skip ? take : skip
        }
    }
    if (dp[m * width + n] <= 0) return null

    // backtrace: prefer the diagonal (an actual match), then up, then left
    const matchedQ: number[] = []
    const matchedV: number[] = []
    let matchedWeight = 0
    let matchedInformative = 0
    let matchedFuzzy = 0
    let spillInformative = 0
    let i = m
    let j = n
    while (i > 0 && j > 0) {
        const idf = verseIdfAt(j - 1)
        const grade = tokenGrade(query[i - 1].token, verseTokenAt(j - 1), idf >= informativeIdf)
        if (grade > 0 && Math.abs(dp[i * width + j] - (dp[(i - 1) * width + j - 1] + grade * idf)) < 1e-6) {
            matchedQ.push(i - 1)
            matchedV.push(j - 1)
            matchedWeight += grade * idf
            if (grade < 0.9) matchedFuzzy++
            if (idf >= index.informativeIdf) {
                matchedInformative++
                if (j - 1 >= verseLength) spillInformative++
            }
            i--
            j--
        } else if (dp[(i - 1) * width + j] >= dp[i * width + j - 1]) i--
        else j--
    }
    if (!matchedQ.length) return null

    matchedQ.reverse()
    matchedV.reverse()

    const queryFrom = matchedQ[0]
    const queryTo = matchedQ[matchedQ.length - 1]
    const verseFrom = matchedV[0]
    const verseTo = matchedV[matchedV.length - 1]

    // best contiguous ordered run: consecutive matched pairs advancing by exactly one on BOTH
    // sides. Common words carry little idf alone, but every adjacency multiplies specificity -
    // the flat bonus is the log of that multiplication, coarse but tunable. Spill matches never
    // count: a phrase found in the spill is evidence for the NEXT verse, which has its own
    // candidate - counting it here would make every verse rival its successor
    let bestRunLength = 0
    let bestRunWeight = 0
    let bestRunPeakIdf = 0
    let bestRunQueryFrom = -1
    let bestRunQueryTo = -1
    let runLength = 0
    let runWeight = 0
    let runPeakIdf = 0
    let runQueryFrom = -1
    for (let k = 0; k < matchedQ.length; k++) {
        if (matchedV[k] >= verseLength) {
            runLength = 0
            runWeight = 0
            runPeakIdf = 0
            runQueryFrom = -1
            continue
        }
        const idf = verseIdfAt(matchedV[k])
        const grade = tokenGrade(query[matchedQ[k]].token, verseTokenAt(matchedV[k]), idf >= informativeIdf)
        const weight = grade * idf
        // the run's PEAK must be a word actually heard (exact/prefix match) - a phonetic fuzz is
        // fine as run glue, but a misheard word must never be the distinctiveness evidence itself
        const peak = grade >= 0.9 ? idf : 0
        if (runLength > 0 && matchedQ[k] === matchedQ[k - 1] + 1 && matchedV[k] === matchedV[k - 1] + 1) {
            runLength++
            runWeight += weight + tuning.PHRASE_ADJACENCY_IDF
            if (peak > runPeakIdf) runPeakIdf = peak
        } else {
            runLength = 1
            runWeight = weight
            runPeakIdf = peak
            runQueryFrom = matchedQ[k]
        }
        if (idf >= tuning.PHRASE_EDGE_MIN_IDF && runWeight > bestRunWeight) {
            bestRunLength = runLength
            bestRunWeight = runWeight
            bestRunPeakIdf = runPeakIdf
            bestRunQueryFrom = runQueryFrom
            bestRunQueryTo = matchedQ[k]
        }
    }

    // coverage: matched weight over ALL verse-window weight inside the matched verse span
    // (a mid-verse start is not punished - unmatched text before/after the recited stretch is outside the span)
    let spanWeight = 0
    for (let v = verseFrom; v <= verseTo; v++) spanWeight += verseIdfAt(v)
    const coverage = spanWeight > 0 ? matchedWeight / spanWeight : 0

    const querySpan = queryTo - queryFrom + 1
    const density = matchedQ.length / querySpan
    const score = coverage * Math.min(1, density / tuning.DENSITY_REF)

    return { score, coverage, density, matched: matchedQ.length, matchedInformative, matchedWeight, matchedFuzzy, queryFrom, queryTo, verseFrom, verseTo, spillInformative, verseLength, bestRunLength, bestRunWeight, bestRunPeakIdf, bestRunQueryFrom, bestRunQueryTo }
}

/** The short-fragment gate: a distinctive contiguous phrase is enough evidence on its own. */
export function phraseEvidence(a: AlignResult, tuning: Tuning = TUNING): boolean {
    return a.bestRunLength >= tuning.PHRASE_MIN_RUN && a.bestRunWeight >= tuning.PHRASE_MIN_WEIGHT && a.bestRunPeakIdf >= tuning.PHRASE_MIN_PEAK_IDF
}

/** The minimum-evidence floors every emission must clear (coincidental overlap dies here). */
export function meetsFloors(a: AlignResult, tuning: Tuning = TUNING): boolean {
    if (a.matchedFuzzy > Math.floor(a.matched * tuning.FUZZY_MAX_FRACTION)) return false
    return a.matchedInformative >= tuning.MIN_INFORMATIVE && a.matchedWeight >= tuning.MIN_WEIGHT && a.queryTo - a.queryFrom + 1 >= tuning.MIN_QUERY_SPAN && a.density >= tuning.DENSITY_FLOOR
}

/** Confidence classification for a floor-passing alignment ("high" may auto project downstream). */
export function classify(a: AlignResult, tuning: Tuning = TUNING): "high" | "medium" | null {
    if (!meetsFloors(a, tuning)) return null
    if (a.score >= tuning.EMIT_HIGH && a.matchedInformative >= tuning.HIGH_MIN_INFORMATIVE && a.matchedWeight >= tuning.HIGH_MIN_WEIGHT) return "high"
    if (a.score >= tuning.EMIT_MEDIUM) return "medium"
    return null
}
