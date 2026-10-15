import type { MatchResult } from "../../../types/ai/Ai"
import type { BibleCacheData } from "./BibleCacheManager"
import { normalizeMishearings } from "./mishearings"
import { normalizeNumbers } from "./numbers"
import { normalizeBookName, RANGE_PATTERN, VERSE_PATTERN } from "./referenceDictionary"
import { normalizeReferences } from "./references"

export class BibleSearchDetector {
    constructor(private cacheData: BibleCacheData) {}

    public findReferenceMatch(cleanInput: string): MatchResult | null {
        if (!this.cacheData.refRegex) return null

        const globalRegex = new RegExp(this.cacheData.refRegex.source, "giu")
        const matches = Array.from(cleanInput.matchAll(globalRegex))
        if (matches.length === 0) return null

        for (let i = matches.length - 1; i >= 0; i--) {
            const refMatch = matches[i]
            const matchIndex = refMatch.index ?? 0
            const matchLength = refMatch[0].length

            if (cleanInput.length - (matchIndex + matchLength) > 120) continue

            const matchedBookName = normalizeBookName(refMatch[1])

            const chapterNum = parseInt(refMatch[2], 10)
            const startVerseNum = refMatch[3] ? parseInt(refMatch[3], 10) : undefined
            const endVerseNum = refMatch[4] ? parseInt(refMatch[4], 10) : undefined

            const refKey = `${matchedBookName.toLowerCase()} ${chapterNum}`
            const chapterData = this.cacheData.referenceIndex.get(refKey)
            if (!chapterData) continue

            if (!startVerseNum) {
                if (chapterData.verseCount < 1) continue
                return {
                    type: "scripture",
                    content: `${chapterData.bookName} ${chapterData.chapterNumber}:1`,
                    confidence: 75
                }
            }

            if (startVerseNum < 1 || startVerseNum > chapterData.verseCount) continue

            let referenceContent = `${chapterData.bookName} ${chapterData.chapterNumber}:${startVerseNum}`
            if (endVerseNum && endVerseNum > startVerseNum) {
                referenceContent += `-${endVerseNum}`
            }

            return {
                type: "scripture",
                content: referenceContent,
                confidence: 98
            }
        }

        return null
    }

    public findStandaloneVerseMatch(cleanInput: string, currentlyOutputted?: string | null): MatchResult | null {
        const verseRegex = new RegExp(`\\b(?:${VERSE_PATTERN})\\s*(\\d+)(?:\\s*(?:[-–—]|${RANGE_PATTERN})\\s*(\\d+))?\\b`, "giu")
        const matches = Array.from(cleanInput.matchAll(verseRegex))
        if (matches.length === 0) return this.findNextVerseCue(cleanInput, currentlyOutputted)

        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i]
            const matchIndex = match.index ?? 0
            const matchLength = match[0].length

            if (cleanInput.length - (matchIndex + matchLength) > 80) continue

            const startVerseNum = parseInt(match[1], 10)
            const endVerseNum = match[2] ? parseInt(match[2], 10) : undefined

            const priorText = cleanInput.slice(0, matchIndex)
            const inlineRef = this.findReferenceMatch(priorText)
            const targetRef = inlineRef?.content || currentlyOutputted

            if (!targetRef) continue

            const parsedCurrent = this.parseReference(targetRef)
            if (!parsedCurrent) continue

            const refKey = `${parsedCurrent.book.toLowerCase()} ${parsedCurrent.chapter}`
            const chapterData = this.cacheData.referenceIndex.get(refKey)

            if (!chapterData || startVerseNum < 1 || startVerseNum > chapterData.verseCount) continue

            let referenceContent = `${chapterData.bookName} ${chapterData.chapterNumber}:${startVerseNum}`
            if (endVerseNum && endVerseNum > startVerseNum) {
                referenceContent += `-${endVerseNum}`
            }

            const isSequential = startVerseNum === parsedCurrent.verse + 1

            return {
                type: "scripture",
                content: referenceContent,
                confidence: isSequential ? 85 : 80
            }
        }

        return null
    }

    private tokenizeText(text: string): string[] {
        if (!text || typeof text !== "string") return []
        return text
            .toLowerCase()
            .replace(/['’`\-_]/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .split(/\s+/)
            .filter((w) => w.length > 1)
    }

    // a reader says the verse number before each verse
    private findNextVerseCue(cleanInput: string, currentlyOutputted?: string | null): MatchResult | null {
        const current = currentlyOutputted ? this.parseReference(currentlyOutputted) : null
        if (!current) return null

        const cue = Number(cleanInput.slice(-40).match(/\b(\d+)\b(?!.*\b\d+\b)/)?.[1])
        if (cue !== current.verse + 1 && cue !== current.verse + 2) return null

        const chapterData = this.cacheData.referenceIndex.get(`${current.book.toLowerCase()} ${current.chapter}`)
        if (!chapterData || cue > chapterData.verseCount) return null

        return { type: "scripture", content: `${chapterData.bookName} ${chapterData.chapterNumber}:${cue}`, confidence: 85 }
    }

    // share of the verse's word weight that the spoken words account for
    private verseCoverage(verseId: number, queryWords: Set<number>): number {
        let total = 0
        let covered = 0
        for (let i = this.cacheData.verseTokensOffsets[verseId]; i < this.cacheData.verseTokensOffsets[verseId + 1]; i++) {
            const wordId = this.cacheData.verseTokens[i]
            const idf = this.cacheData.wordIdf[wordId]
            if (idf <= 0.3) continue
            total += idf
            if (queryWords.has(wordId)) covered += idf
        }
        return total ? covered / total : 0
    }

    // Calculates a bonus/penalty multiplier based on sequential phrase / n-gram match between input tokens and verse tokens
    private computePhraseBonus(verseId: number, queryWordIds: number[]): number {
        if (queryWordIds.length < 2) return 1.0

        const start = this.cacheData.verseTokensOffsets[verseId]
        const end = this.cacheData.verseTokensOffsets[verseId + 1]
        const verseLen = end - start
        if (verseLen === 0) return 1.0

        const qLen = queryWordIds.length

        // Find the longest contiguous matching sub-sequence of query tokens within the verse
        let maxRun = 0
        for (let i = start; i < end; i++) {
            for (let j = 0; j < qLen; j++) {
                if (this.cacheData.verseTokens[i] === queryWordIds[j]) {
                    let run = 1
                    while (i + run < end && j + run < qLen && this.cacheData.verseTokens[i + run] === queryWordIds[j + run]) {
                        run++
                    }
                    if (run > maxRun) maxRun = run
                }
            }
        }

        // Exact full phrase match
        if (maxRun === qLen) return 1.6

        // Substantial contiguous phrase match (e.g. 3+ contiguous words matching)
        if (maxRun >= 3) {
            const runRatio = maxRun / qLen
            return 1.2 + runRatio * 0.3
        }

        // Count matching bigrams (adjacent word pairs)
        let matchingBigrams = 0
        const totalBigrams = qLen - 1
        for (let j = 0; j < totalBigrams; j++) {
            const w1 = queryWordIds[j]
            const w2 = queryWordIds[j + 1]
            for (let i = start; i < end - 1; i++) {
                if (this.cacheData.verseTokens[i] === w1 && this.cacheData.verseTokens[i + 1] === w2) {
                    matchingBigrams++
                    break
                }
            }
        }

        if (matchingBigrams > 0) {
            const bigramRatio = matchingBigrams / totalBigrams
            return 1.0 + bigramRatio * 0.4
        }

        // For short queries (<= 5 tokens) where words are scattered with 0 adjacent bigrams, apply a penalty
        if (qLen >= 3 && qLen <= 5) return 0.65

        return 1.0
    }

    private parseReference(refStr: string): { book: string; chapter: number; verse: number } | null {
        if (!refStr) return null
        const match = refStr.match(/^((?:[1-3]\s+)?[\p{L}\s]+)\s+(\d+):(\d+)(?:-(\d+))?$/u)
        if (!match) return null
        return {
            book: match[1].trim(),
            chapter: parseInt(match[2], 10),
            verse: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10)
        }
    }

    private getUpcomingVerseMap(currentRefStr: string, maxLookahead: number = 3): Map<number, number> {
        const upcoming = new Map<number, number>()
        const parsed = this.parseReference(currentRefStr)
        if (!parsed) return upcoming

        let currentBook = parsed.book
        let currentChap = parsed.chapter
        let currentVerse = parsed.verse

        for (let dist = 1; dist <= maxLookahead; dist++) {
            const nextVerseNum = currentVerse + 1
            const refKey = `${currentBook.toLowerCase()} ${currentChap}`
            const chapterData = this.cacheData.referenceIndex.get(refKey)

            if (chapterData && nextVerseNum <= chapterData.verseCount) {
                const verseId = chapterData.startVerseId + (nextVerseNum - 1)
                upcoming.set(verseId, dist)
                currentVerse = nextVerseNum
            } else {
                const nextChapKey = `${currentBook.toLowerCase()} ${currentChap + 1}`
                const nextChapData = this.cacheData.referenceIndex.get(nextChapKey)
                if (nextChapData && nextChapData.verseCount >= 1) {
                    const verseId = nextChapData.startVerseId
                    upcoming.set(verseId, dist)
                    currentChap++
                    currentVerse = 1
                } else {
                    break
                }
            }
        }

        return upcoming
    }

    public async findContentMatch(cleanInput: string, currentlyOutputted?: string | null, isCancelled?: () => boolean): Promise<MatchResult | null> {
        const parsedCurrent = this.parseReference(currentlyOutputted || "")
        const upcomingVerseMap = this.getUpcomingVerseMap(currentlyOutputted || "", 3)

        const allTokens = this.tokenizeText(cleanInput)
        // Allow shorter phrases to match if distinct (e.g. "In the beginning God")
        if (allTokens.length < 3) return null

        const windowSizes = [20, 60, 80, 120]
        let bestResult: { match: MatchResult | null; hasAnyCandidates: boolean; isAmbiguous: boolean } | null = null

        for (let i = 0; i < windowSizes.length; i++) {
            if (isCancelled?.()) return null

            if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 0))
                if (isCancelled?.()) return null
            }

            const size = windowSizes[i]
            const evalResult = this.evaluateContentMatch(allTokens, size, parsedCurrent, upcomingVerseMap, currentlyOutputted)

            if (!evalResult.hasAnyCandidates) break

            if (evalResult.match) {
                if (evalResult.match.confidence >= 80 && !evalResult.isAmbiguous) {
                    return evalResult.match
                }
                if (!bestResult || !bestResult.match || evalResult.match.confidence > bestResult.match.confidence) {
                    bestResult = evalResult
                }
            } else if (!bestResult) {
                bestResult = evalResult
            }
        }

        return bestResult?.match || null
    }

    private evaluateContentMatch(allTokens: string[], windowSize: number, parsedCurrent: { book: string; chapter: number; verse: number } | null, upcomingVerseMap: Map<number, number>, currentlyOutputted?: string | null): { match: MatchResult | null; hasAnyCandidates: boolean; isAmbiguous: boolean } {
        const inputTokens = allTokens.slice(-windowSize)
        const tokenThreshold = 0.3
        const totalTokensCount = inputTokens.length

        const highValueTokensWithWeight: Array<{ wordId: number; weightedIdf: number }> = []

        for (let index = 0; index < inputTokens.length; index++) {
            const token = inputTokens[index]
            const wordId = this.cacheData.vocabToIdMap.get(token)
            if (wordId === undefined) continue

            const idf = this.cacheData.wordIdf[wordId]
            if (idf <= tokenThreshold) continue

            const distanceFromEnd = totalTokensCount - 1 - index
            const decayWeight = Math.pow(0.98, distanceFromEnd)
            highValueTokensWithWeight.push({ wordId, weightedIdf: idf * decayWeight })
        }

        if (highValueTokensWithWeight.length < 2) {
            return { match: null, hasAnyCandidates: false, isAmbiguous: false }
        }

        const candidateScores = new Map<number, number>()
        const candidateMatchedIdfSum = new Map<number, number>()
        const candidateMatchedCount = new Map<number, number>()

        for (const item of highValueTokensWithWeight) {
            const startOffset = this.cacheData.wordPostingsOffsets[item.wordId]
            const endOffset = this.cacheData.wordPostingsOffsets[item.wordId + 1]

            for (let offset = startOffset; offset < endOffset; offset++) {
                const verseId = this.cacheData.wordPostings[offset]
                const prevScore = candidateScores.get(verseId) || 0
                const prevMatchedIdf = candidateMatchedIdfSum.get(verseId) || 0
                const prevCount = candidateMatchedCount.get(verseId) || 0

                candidateScores.set(verseId, prevScore + item.weightedIdf)
                candidateMatchedIdfSum.set(verseId, prevMatchedIdf + item.weightedIdf)
                candidateMatchedCount.set(verseId, prevCount + 1)
            }
        }

        if (candidateScores.size === 0) {
            return { match: null, hasAnyCandidates: false, isAmbiguous: false }
        }

        const recentHighValueIdfSum = inputTokens.reduce((sum, token, index) => {
            const wordId = this.cacheData.vocabToIdMap.get(token)
            if (wordId === undefined) return sum
            const idf = this.cacheData.wordIdf[wordId]
            if (idf <= tokenThreshold) return sum
            const distanceFromEnd = totalTokensCount - 1 - index
            return sum + idf * Math.pow(0.98, distanceFromEnd)
        }, 0)

        const evaluatedCandidates: Array<{
            verseId: number
            ref: string
            finalScore: number
            isCurrent: boolean
            upcomingDistance: number | null
        }> = []

        const currentVerseId = currentlyOutputted ? this.cacheData.verseToIdMap.get(currentlyOutputted.toLowerCase()) : undefined
        const queryWords = new Set(highValueTokensWithWeight.map((item) => item.wordId))
        const queryWordIds = inputTokens.map((t) => this.cacheData.vocabToIdMap.get(t)).filter((id): id is number => id !== undefined)

        for (const [verseId, accumulatedIdf] of candidateScores.entries()) {
            const matchCount = candidateMatchedCount.get(verseId) || 0

            const isCurrent = currentVerseId === verseId
            const upcomingDist = upcomingVerseMap.get(verseId) ?? null

            let requiredMatches = 2
            if (isCurrent) requiredMatches = 2
            else if (upcomingDist !== null) requiredMatches = 3

            if (matchCount < requiredMatches) continue

            const ref = this.cacheData.versePool[verseId]
            const matchedQueryIdf = candidateMatchedIdfSum.get(verseId) || 1.0
            let scoreRatio = recentHighValueIdfSum > 0 ? matchedQueryIdf / recentHighValueIdfSum : accumulatedIdf / matchedQueryIdf

            scoreRatio = Math.min(scoreRatio, 1.0)

            // Bonus for phrase / consecutive word matches vs scattered words
            const phraseBonus = this.computePhraseBonus(verseId, queryWordIds)
            scoreRatio *= phraseBonus

            // a handful of common words can match a long verse completely; the match is worth what it covers of the verse,
            // but for short distinct phrases (e.g. 2-4 words), require less total verse coverage to not penalize long verses.
            const isShortQuery = queryWords.size <= 4
            if (!isShortQuery) {
                const coverageTarget = Math.min(0.25, Math.max(0.06, queryWords.size * 0.03))
                scoreRatio *= Math.min(1, this.verseCoverage(verseId, queryWords) / coverageTarget)
            }
            const candidateParsed = this.parseReference(ref)

            if (isCurrent) {
                scoreRatio *= 1.25
            } else if (upcomingDist === 1) {
                scoreRatio *= 1.15
            } else if (upcomingDist === 2) {
                scoreRatio *= 0.75
            } else if (upcomingDist === 3) {
                scoreRatio *= 0.5
            } else if (parsedCurrent && candidateParsed) {
                if (candidateParsed.book.toLowerCase() === parsedCurrent.book.toLowerCase() && candidateParsed.chapter === parsedCurrent.chapter) {
                    if (candidateParsed.verse < parsedCurrent.verse) {
                        scoreRatio *= 0.2
                    } else {
                        const verseDistance = candidateParsed.verse - parsedCurrent.verse
                        scoreRatio *= Math.pow(0.4, verseDistance - 1)
                    }
                } else {
                    scoreRatio *= 0.5
                }
            }

            const threshold = isCurrent || upcomingDist === 1 ? 0.18 : isShortQuery ? 0.2 : 0.28
            if (scoreRatio >= threshold) {
                evaluatedCandidates.push({
                    verseId,
                    ref,
                    finalScore: scoreRatio,
                    isCurrent,
                    upcomingDistance: upcomingDist
                })
            }
        }

        if (evaluatedCandidates.length === 0) {
            return { match: null, hasAnyCandidates: true, isAmbiguous: false }
        }

        evaluatedCandidates.sort((a, b) => b.finalScore - a.finalScore)
        const topMatch = evaluatedCandidates[0]

        let isAmbiguous = false
        let ambiguityPenalty = 1.0
        let uniquenessMultiplier = 1.0

        if (evaluatedCandidates.length > 1) {
            const secondMatch = evaluatedCandidates[1]
            const relativeRatio = secondMatch.finalScore / (topMatch.finalScore || 1)

            if (relativeRatio > 0.75 && !topMatch.isCurrent && topMatch.upcomingDistance !== 1) {
                const topParsed = this.parseReference(topMatch.ref)
                const secondParsed = this.parseReference(secondMatch.ref)

                if (topParsed?.book.toLowerCase() !== secondParsed?.book.toLowerCase() || topParsed?.chapter !== secondParsed?.chapter) {
                    isAmbiguous = true
                    ambiguityPenalty = 1 - (relativeRatio - 0.75)
                }
            } else if (relativeRatio < 0.45) {
                // Dominant winner over the next candidate
                uniquenessMultiplier = 1.25
            } else if (relativeRatio < 0.6) {
                uniquenessMultiplier = 1.15
            }
        } else {
            // Only one candidate in the entire Bible matched
            uniquenessMultiplier = 1.4
        }

        let baseConfidence = topMatch.finalScore * 100 * ambiguityPenalty * uniquenessMultiplier

        // If a candidate uniquely stands out with minimal ambiguity, ensure high confidence so it can suggest/autoplay
        if (!isAmbiguous && uniquenessMultiplier > 1.0 && topMatch.finalScore >= 0.35) {
            baseConfidence = Math.max(baseConfidence, 85)
        }

        const confidence = Math.min(Math.max(Math.round(baseConfidence), 51), 98)

        if (confidence < 70) {
            return { match: null, hasAnyCandidates: true, isAmbiguous }
        }

        return {
            match: { type: "scripture", content: topMatch.ref, confidence, scriptureMatchType: "content" },
            hasAnyCandidates: true,
            isAmbiguous
        }
    }

    private readonly DEBUG_MODE = false
    public async search(transcript: string, currentlyOutputted: string, isCancelled?: () => boolean): Promise<MatchResult | null> {
        if (this.DEBUG_MODE) console.log("[DETECTION] Starting search with transcript:", transcript)
        if (isCancelled?.()) return null

        const mishearingsCorrected = normalizeMishearings(transcript)
        const rawNormalizedNumbers = normalizeNumbers(transcript)
        const mishearingsNormalizedNumbers = normalizeNumbers(mishearingsCorrected)

        const rawNormalized = normalizeReferences(rawNormalizedNumbers, this.cacheData)
        const mishearingsNormalized = normalizeReferences(mishearingsNormalizedNumbers, this.cacheData)

        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings corrected:", mishearingsCorrected)
        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings normalized:", mishearingsNormalized)

        const refMatch = this.findReferenceMatch(mishearingsNormalized) || this.findReferenceMatch(rawNormalized) || this.findStandaloneVerseMatch(mishearingsNormalized, currentlyOutputted) || this.findStandaloneVerseMatch(rawNormalized, currentlyOutputted)

        if (this.DEBUG_MODE) console.log("[DETECTION] Reference match result:", refMatch)

        if (isCancelled?.()) return null

        // 1. Run active-context and fresh-context evaluations simultaneously
        const activeRawPromise = this.findContentMatch(transcript, currentlyOutputted, isCancelled)
        const activeMishearingPromise = this.findContentMatch(mishearingsCorrected, currentlyOutputted, isCancelled)

        const freshRawPromise = currentlyOutputted ? this.findContentMatch(transcript, null, isCancelled) : Promise.resolve(null)
        const freshMishearingPromise = currentlyOutputted ? this.findContentMatch(mishearingsCorrected, null, isCancelled) : Promise.resolve(null)

        const [activeRaw, activeMishearing, freshRaw, freshMishearing] = await Promise.all([activeRawPromise, activeMishearingPromise, freshRawPromise, freshMishearingPromise])

        if (isCancelled?.()) return null

        const activeMatch = activeRaw && activeMishearing ? (activeRaw.confidence >= activeMishearing.confidence ? activeRaw : activeMishearing) : activeRaw || activeMishearing

        const freshMatch = freshRaw && freshMishearing ? (freshRaw.confidence >= freshMishearing.confidence ? freshRaw : freshMishearing) : freshRaw || freshMishearing

        let bestContentMatch: MatchResult | null = null

        // 2. Immediate Switch Logic: Prefer fresh context match if active context is absent or weak
        if (freshMatch && (!activeMatch || freshMatch.confidence > activeMatch.confidence + 5)) {
            bestContentMatch = freshMatch
        } else {
            bestContentMatch = activeMatch || freshMatch
        }

        if (this.DEBUG_MODE) console.log("[DETECTION] Best content match:", bestContentMatch)

        if (refMatch && refMatch.confidence >= 75) {
            if (bestContentMatch && bestContentMatch.confidence >= 80) return bestContentMatch
            return refMatch
        }

        return bestContentMatch || null
    }
}
