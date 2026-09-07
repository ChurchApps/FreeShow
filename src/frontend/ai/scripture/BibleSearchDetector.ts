import { MatchResult } from "../manager/AiManager"
import type { BibleCacheData } from "./BibleCacheManager"
import { normalizeMishearings } from "./mishearings"
import { normalizeNumbers } from "./numbers"

export class BibleSearchDetector {
    constructor(private cacheData: BibleCacheData) {}

    /**
     * Resolves single-chapter books dynamically using reference index metadata.
     */
    private isSingleChapterBook(bookName: string): boolean {
        const lowerBook = bookName.toLowerCase().trim()
        const chap1Key = `${lowerBook} 1`
        const chap2Key = `${lowerBook} 2`
        return this.cacheData.referenceIndex.has(chap1Key) && !this.cacheData.referenceIndex.has(chap2Key)
    }

    private normalizeReferences(text: string): string {
        let normalized = text

        // 1. Remove punctuation that breaks numbered books (e.g., "1, john 4" or "first, john" -> "1 john")
        normalized = normalized.replace(/\b([1-3]|first|second|third)\s*[,.\-_]\s*([\p{L}]+)/giu, "$1 $2")

        // 2. Normalize plural or localized book names (e.g., "Psalms" -> "Psalm")
        normalized = normalized.replace(/\bpsalms\b/gi, "Psalm")

        // 3. Inverted structure: "verse 16 of John chapter 3" or "16th verse of John chapter 3" -> "John 3:16"
        normalized = normalized.replace(/\b(?:the\s+)?(?:verse|v|verses)?\s*(\d+)(?:st|nd|rd|th)?\s+(?:verse\s+)?of\s+([1-3]?\s*[\p{L}]+)\s+(?:chapter\s*)?(\d+)\b/giu, "$2 $3:$1")

        // 4. Trailing verse ordinal/word: "John chapter 3, the 16th verse" -> "John 3:16"
        normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(?:chapter\s*)?(\d+)[,\s]+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+(?:verse|v|verses)\b/giu, "$1 $2:$3")

        // 5. Ordinal chapter structure: "the 8th chapter of Romans" -> "Romans 8"
        normalized = normalized.replace(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+(?:chapter|psalm)\s+of\s+([1-3]?\s*[\p{L}]+)\b/giu, "$2 $1")

        // 6. Ordinal psalm phrasing: "the 23rd psalm" -> "Psalm 23"
        normalized = normalized.replace(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+psalms?\b/giu, "Psalm $1")

        // 7. Single-chapter book handler: convert "Philemon verse 6" -> "Philemon 1:6"
        normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(?:verse|v|verses)?\s*(\d+)\b/giu, (match, book, num) => {
            if (this.isSingleChapterBook(book)) {
                return `${book} 1:${num}`
            }
            return match
        })

        // 8. Standard spoken reference conversion: "Mark chapter 8 and 22" -> "Mark 8:22"
        normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(?:chapter\s*)?(\d+)\s+(?:and|verses|verse|v)\s+(\d+)(?:\s*(?:[-–—]|through|to)\s*(\d+))?\b/giu, (_match, book, chap, vStart, vEnd) => {
            return vEnd ? `${book} ${chap}:${vStart}-${vEnd}` : `${book} ${chap}:${vStart}`
        })

        // 9. Safe dot/comma/space reference formatting: convert "John 3.16" or "John 4 7" -> "John 4:7"
        normalized = normalized.replace(/(?<![:\d])\b([1-3]?\s*[\p{L}]+)\s+(\d+)[.,\s]+(\d+)\b(?!\s*[1-3]?\s*[\p{L}]+)(?!:)/giu, "$1 $2:$3")

        // 10. Split concatenated 3- and 4-digit reference numbers (e.g., "Mark 822" -> "Mark 8:22")
        normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(\d{3,4})\b/giu, (match, book, digits) => {
            let chap = 0
            let verse = 0
            if (digits.length === 3) {
                chap = parseInt(digits.slice(0, 1), 10)
                verse = parseInt(digits.slice(1), 10)
            } else if (digits.length === 4) {
                chap = parseInt(digits.slice(0, 2), 10)
                verse = parseInt(digits.slice(2), 10)
            }

            const refKey = `${book.toLowerCase()} ${chap}`
            const chapterData = this.cacheData.referenceIndex.get(refKey)

            if (chapterData && verse >= 1 && verse <= chapterData.verseCount) {
                return `${book} ${chap}:${verse}`
            }

            return match
        })

        return normalized
    }

    private tokenizeText(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/['’`\-_]/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .split(/\s+/)
            .filter((w) => w.length > 1)
    }

    public findReferenceMatch(cleanInput: string): MatchResult | null {
        if (!this.cacheData.refRegex) return null

        const globalRegex = new RegExp(this.cacheData.refRegex.source, "gi")
        const matches = Array.from(cleanInput.matchAll(globalRegex))
        if (matches.length === 0) return null

        // Iterate backwards from the latest match to evaluate the most recent reference first
        for (let i = matches.length - 1; i >= 0; i--) {
            const refMatch = matches[i]
            const matchIndex = refMatch.index ?? 0
            const matchLength = refMatch[0].length

            // Reject stale matches if followed by excessive subsequent spoken characters (> 120 chars)
            if (cleanInput.length - (matchIndex + matchLength) > 120) continue

            const matchedBookName = refMatch[1]
                .trim()
                .replace(/^first\b/i, "1")
                .replace(/^second\b/i, "2")
                .replace(/^third\b/i, "3")

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
        const verseRegex = /\b(?:verse|v|verses)\s*(\d+)(?:\s*(?:[-–—]|through|to)\s*(\d+))?\b/gi
        const matches = Array.from(cleanInput.matchAll(verseRegex))
        if (matches.length === 0) return null

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
        if (allTokens.length < 3) return null

        const windowSizes = [60, 80, 120]
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
        const tokenThreshold = 1.0
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

        for (const [verseId, accumulatedIdf] of candidateScores.entries()) {
            const matchCount = candidateMatchedCount.get(verseId) || 0

            const isCurrent = currentVerseId === verseId
            const upcomingDist = upcomingVerseMap.get(verseId) ?? null

            const requiredMatches = isCurrent || upcomingDist !== null ? 2 : 3
            if (matchCount < requiredMatches) continue

            const ref = this.cacheData.versePool[verseId]
            const matchedQueryIdf = candidateMatchedIdfSum.get(verseId) || 1.0
            let scoreRatio = recentHighValueIdfSum > 0 ? matchedQueryIdf / recentHighValueIdfSum : accumulatedIdf / matchedQueryIdf

            scoreRatio = Math.min(scoreRatio, 1.0)
            const candidateParsed = this.parseReference(ref)

            if (isCurrent) {
                scoreRatio *= 1.1
            } else if (upcomingDist === 1) {
                scoreRatio *= 1.7
            } else if (upcomingDist === 2) {
                scoreRatio *= 1.2
            } else if (upcomingDist === 3) {
                scoreRatio *= 1.05
            } else if (parsedCurrent && candidateParsed) {
                if (matchCount < 4) {
                    if (candidateParsed.book.toLowerCase() === parsedCurrent.book.toLowerCase() && candidateParsed.chapter === parsedCurrent.chapter) {
                        if (candidateParsed.verse < parsedCurrent.verse) {
                            scoreRatio *= 0.3
                        } else {
                            const verseDistance = candidateParsed.verse - parsedCurrent.verse
                            scoreRatio *= Math.max(0.6, Math.pow(0.85, verseDistance - 1))
                        }
                    } else {
                        scoreRatio *= 0.35
                    }
                }
            }

            const threshold = isCurrent || upcomingDist === 1 ? 0.2 : 0.35
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

        if (evaluatedCandidates.length > 1) {
            const secondMatch = evaluatedCandidates[1]
            const relativeRatio = secondMatch.finalScore / (topMatch.finalScore || 1)

            if (relativeRatio > 0.7) {
                isAmbiguous = true
                if (!topMatch.isCurrent && topMatch.upcomingDistance !== 1) {
                    ambiguityPenalty = 1 - (relativeRatio - 0.7)
                }
            }
        }

        const confidence = Math.min(Math.max(Math.round(topMatch.finalScore * 100 * ambiguityPenalty), 51), 98)

        if (confidence < 75) {
            return { match: null, hasAnyCandidates: true, isAmbiguous }
        }

        return {
            match: { type: "scripture", content: topMatch.ref, confidence },
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

        const rawNormalized = this.normalizeReferences(rawNormalizedNumbers)
        const mishearingsNormalized = this.normalizeReferences(mishearingsNormalizedNumbers)

        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings corrected:", mishearingsCorrected)
        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings normalized:", mishearingsNormalized)

        const refMatch = this.findReferenceMatch(mishearingsNormalized) || this.findReferenceMatch(rawNormalized) || this.findStandaloneVerseMatch(mishearingsNormalized, currentlyOutputted) || this.findStandaloneVerseMatch(rawNormalized, currentlyOutputted)

        if (this.DEBUG_MODE) console.log("[DETECTION] Reference match result:", refMatch)

        if (isCancelled?.()) return null

        const rawContentMatch = await this.findContentMatch(transcript, currentlyOutputted, isCancelled)
        if (isCancelled?.()) return null

        const mishearingContentMatch = await this.findContentMatch(mishearingsCorrected, currentlyOutputted, isCancelled)
        if (isCancelled?.()) return null

        let bestContentMatch: MatchResult | null = null
        if (rawContentMatch && mishearingContentMatch) {
            bestContentMatch = rawContentMatch.confidence >= mishearingContentMatch.confidence ? rawContentMatch : mishearingContentMatch
        } else {
            bestContentMatch = rawContentMatch || mishearingContentMatch
        }

        if (this.DEBUG_MODE) console.log("[DETECTION] Best content match:", bestContentMatch)

        if (refMatch && refMatch.confidence >= 75) {
            if (bestContentMatch && bestContentMatch.confidence >= 80) return bestContentMatch
            return refMatch
        }

        return bestContentMatch || null
    }
}
