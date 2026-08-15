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
    DENSITY_FLOOR: 0.55,
    MIN_INFORMATIVE: 5,
    MIN_WEIGHT: 14,
    MIN_QUERY_SPAN: 6,

    EMIT_MEDIUM: 0.48,
    EMIT_HIGH: 0.62,
    HIGH_MIN_INFORMATIVE: 6,
    HIGH_MIN_WEIGHT: 18,

    SINGLE_SHOT_INFORMATIVE: 8, // immediate emission from one segment
    SINGLE_SHOT_WEIGHT: 24,
    SUSTAIN_SEGMENTS: 2, // otherwise: same ref on top for this many consecutive segments
    CUE_WINDOW_MS: 12000, // after "the Bible says" / "Jesus said" etc, the sustain wait is skipped

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

    CONSENSUS_BONUS: 0.04 // two translations independently agree on the ref
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
    queryFrom: number // first/last matched positions in the query window
    queryTo: number
    verseFrom: number // first/last matched positions in the verse window (verse + spill)
    verseTo: number
    spillInformative: number // informative matches landing in the spill region
    verseLength: number // tokens in the verse itself (spill excluded)
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

    // coverage: matched weight over ALL verse-window weight inside the matched verse span
    // (a mid-verse start is not punished - unmatched text before/after the recited stretch is outside the span)
    let spanWeight = 0
    for (let v = verseFrom; v <= verseTo; v++) spanWeight += verseIdfAt(v)
    const coverage = spanWeight > 0 ? matchedWeight / spanWeight : 0

    const querySpan = queryTo - queryFrom + 1
    const density = matchedQ.length / querySpan
    const score = coverage * Math.min(1, density / tuning.DENSITY_REF)

    return { score, coverage, density, matched: matchedQ.length, matchedInformative, matchedWeight, queryFrom, queryTo, verseFrom, verseTo, spillInformative, verseLength }
}

/** The minimum-evidence floors every emission must clear (coincidental overlap dies here). */
export function meetsFloors(a: AlignResult, tuning: Tuning = TUNING): boolean {
    return a.matchedInformative >= tuning.MIN_INFORMATIVE && a.matchedWeight >= tuning.MIN_WEIGHT && a.queryTo - a.queryFrom + 1 >= tuning.MIN_QUERY_SPAN && a.density >= tuning.DENSITY_FLOOR
}

/** Confidence classification for a floor-passing alignment ("high" may auto project downstream). */
export function classify(a: AlignResult, tuning: Tuning = TUNING): "high" | "medium" | null {
    if (!meetsFloors(a, tuning)) return null
    if (a.score >= tuning.EMIT_HIGH && a.matchedInformative >= tuning.HIGH_MIN_INFORMATIVE && a.matchedWeight >= tuning.HIGH_MIN_WEIGHT) return "high"
    if (a.score >= tuning.EMIT_MEDIUM) return "medium"
    return null
}
