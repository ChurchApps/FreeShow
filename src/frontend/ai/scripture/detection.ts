import { Bible } from "json-bible/lib/Bible"
import { get } from "svelte/store"
import { loadJsonBible } from "../../components/drawer/bible/scripture"
import { scriptures } from "../../stores"
import { MatchResult } from "../manager/AiManager"
import { normalizeMishearings } from "./mishearings"
import { normalizeNumbers } from "./numbers"

export class BibleCacheManager {
    private static caches: Map<string, BibleSearchCache> = new Map()

    public static async getCache(bibleId: string): Promise<BibleSearchCache | null> {
        if (this.caches.has(bibleId)) return this.caches.get(bibleId)!

        const scriptureData = get(scriptures)[bibleId]
        if (!scriptureData || scriptureData?.api) return null

        const bible = (await loadJsonBible(bibleId))?.data
        if (!bible) return null

        const searchCache = new BibleSearchCache(bible)
        this.caches.set(bibleId, searchCache)
        return searchCache
    }
}

export class BibleSearchCache {
    private referenceIndex: Map<string, { bookName: string; chapterNumber: number; verses: Map<number, boolean> }> = new Map()
    private invertedWordIndex: Map<string, Set<string>> = new Map()
    private verseTokensMap: Map<string, string[]> = new Map()
    private verseTokenSetsMap: Map<string, Set<string>> = new Map()
    private wordIdfMap: Map<string, number> = new Map()
    private bookNames: string[] = []
    private refRegex: RegExp | null = null
    private totalVerses = 0

    constructor(bible: Bible) {
        this.buildCache(bible)
    }

    private buildCache(bible: Bible): void {
        for (const book of bible.books) {
            this.bookNames.push(book.name)
            for (const chapter of book.chapters) {
                const refKey = `${book.name.toLowerCase()} ${chapter.number}`
                const verseMap = new Map<number, boolean>()

                for (const verse of chapter.verses) {
                    this.totalVerses++
                    verseMap.set(verse.number, true)
                    const verseRef = `${book.name} ${chapter.number}:${verse.number}`
                    const tokens = this.tokenizeText(verse.text)

                    this.verseTokensMap.set(verseRef, tokens)

                    const uniqueTokens = new Set(tokens)
                    this.verseTokenSetsMap.set(verseRef, uniqueTokens)
                    for (const word of uniqueTokens) {
                        if (!this.invertedWordIndex.has(word)) {
                            this.invertedWordIndex.set(word, new Set())
                        }
                        this.invertedWordIndex.get(word)!.add(verseRef)
                    }
                }

                this.referenceIndex.set(refKey, {
                    bookName: book.name,
                    chapterNumber: chapter.number,
                    verses: verseMap
                })
            }
        }

        for (const [word, verseSet] of this.invertedWordIndex.entries()) {
            const docFreq = verseSet.size
            const idf = Math.log((this.totalVerses + 1) / (docFreq + 1))
            this.wordIdfMap.set(word, idf)
        }

        const bookPattern = this.bookNames.map((b) => b.replace(/\s+/g, "\\s+")).join("|")
        this.refRegex = new RegExp(`\\b((?:(?:[1-3]|first|second|third)\\s+)?(?:${bookPattern}))\\b\\s*(?:chapter)?\\s*(\\d+)(?:[\\s,:.]+(?:verse|v|verses)?\\s*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?)?`, "i")
    }

    private normalizeReferences(text: string): string {
        let normalized = text

        // Convert "Mark chapter 8 and 22" or "Mark 8 verse 22" -> "Mark 8:22"
        normalized = normalized.replace(/\b([\p{L}\p{N}\s]+?)\s*(?:chapter\s*)?(\d+)\s+(?:and|verse|v)\s+(\d+)\b/giu, "$1 $2:$3")

        // Normalize various scripture reference formats to a standard "Book Chapter:Verse" format
        normalized = normalized.replace(/\b([\p{L}\p{N}\s]+?)\s+(\d+)\.(\d+)\b/gu, "$1 $2:$3")
        normalized = normalized.replace(/\b([\p{L}\p{N}\s]+?)\s+(\d+),\s*(\d+)\b/gu, "$1 $2:$3")
        normalized = normalized.replace(/\b([\p{L}\p{N}\s]+?)\s+(\d+)\s+(\d+)\b/gu, "$1 $2:$3")

        // Split concatenated 3- and 4-digit reference numbers (e.g., 4610 -> 46:10 or 316 -> 3:16)
        normalized = normalized.replace(/\b([\p{L}]+)\s+(\d{3,4})\b/gu, (match, book, digits) => {
            if (digits.length === 3) {
                return `${book} ${digits.slice(0, 1)}:${digits.slice(1)}`
            } else if (digits.length === 4) {
                return `${book} ${digits.slice(0, 2)}:${digits.slice(2)}`
            }
            return match
        })

        return normalized
    }

    private tokenizeText(text: string): string[] {
        return (
            text
                .toLowerCase()
                // Split or strip all apostrophes and non-alphanumeric unicode characters generically
                .replace(/['’`\-_]/g, " ")
                .replace(/[^\p{L}\p{N}\s]/gu, "")
                .split(/\s+/)
                .filter((w) => w.length > 1)
        )
    }

    public findReferenceMatch(cleanInput: string): MatchResult | null {
        if (!this.refRegex) return null

        const globalRegex = new RegExp(this.refRegex.source, "gi")
        const matches = Array.from(cleanInput.matchAll(globalRegex))

        if (matches.length === 0) return null

        const refMatch = matches[matches.length - 1]
        const matchIndex = refMatch.index ?? 0
        const matchLength = refMatch[0].length

        // Ignore references that are buried far back in the transcript buffer
        if (cleanInput.length - (matchIndex + matchLength) > 30) {
            return null
        }

        const matchedBookName = refMatch[1]
            .trim()
            .replace(/^first\b/i, "1")
            .replace(/^second\b/i, "2")
            .replace(/^third\b/i, "3")

        const chapterNum = parseInt(refMatch[2], 10)
        const startVerseNum = refMatch[3] ? parseInt(refMatch[3], 10) : undefined
        const endVerseNum = refMatch[4] ? parseInt(refMatch[4], 10) : undefined

        const refKey = `${matchedBookName.toLowerCase()} ${chapterNum}`
        const chapterData = this.referenceIndex.get(refKey)

        if (!chapterData) return null

        if (!startVerseNum) {
            if (!chapterData.verses.has(1)) return null
            return {
                type: "scripture",
                content: `${chapterData.bookName} ${chapterData.chapterNumber}:1`,
                confidence: 75
            }
        }

        if (!chapterData.verses.has(startVerseNum)) return null

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

    private getUpcomingVerseMap(currentRefStr: string, maxLookahead: number = 3): Map<string, number> {
        const upcoming = new Map<string, number>()
        const parsed = this.parseReference(currentRefStr)
        if (!parsed) return upcoming

        let currentBook = parsed.book
        let currentChap = parsed.chapter
        let currentVerse = parsed.verse

        for (let dist = 1; dist <= maxLookahead; dist++) {
            const nextVerseNum = currentVerse + 1
            const refKey = `${currentBook.toLowerCase()} ${currentChap}`
            const chapterData = this.referenceIndex.get(refKey)

            if (chapterData && chapterData.verses.has(nextVerseNum)) {
                const refStr = `${chapterData.bookName} ${chapterData.chapterNumber}:${nextVerseNum}`
                upcoming.set(refStr, dist)
                currentVerse = nextVerseNum
            } else {
                const nextChapKey = `${currentBook.toLowerCase()} ${currentChap + 1}`
                const nextChapData = this.referenceIndex.get(nextChapKey)
                if (nextChapData && nextChapData.verses.has(1)) {
                    const refStr = `${nextChapData.bookName} ${nextChapData.chapterNumber}:1`
                    upcoming.set(refStr, dist)
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

        // Start with a 40-token base window and expand to 80/120 if ambiguous or low confidence
        const windowSizes = [40, 80, 120]
        let bestResult: { match: MatchResult | null; hasAnyCandidates: boolean; isAmbiguous: boolean } | null = null

        for (let i = 0; i < windowSizes.length; i++) {
            if (isCancelled?.()) return null

            // Yield to main thread between larger window evaluations so pending UI/STT events can run
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

    private evaluateContentMatch(allTokens: string[], windowSize: number, parsedCurrent: { book: string; chapter: number; verse: number } | null, upcomingVerseMap: Map<string, number>, currentlyOutputted?: string | null): { match: MatchResult | null; hasAnyCandidates: boolean; isAmbiguous: boolean } {
        const inputTokens = allTokens.slice(-windowSize)

        // Lower threshold to ensure words like "judge", "judged", "measured" pass through
        const tokenThreshold = 1.0
        const totalTokensCount = inputTokens.length

        const highValueTokensWithWeight = inputTokens
            .map((token, index) => {
                const idf = this.wordIdfMap.get(token) || 0
                const distanceFromEnd = totalTokensCount - 1 - index
                const decayWeight = Math.pow(0.96, distanceFromEnd)
                return { token, index, idf, weightedIdf: idf * decayWeight }
            })
            .filter((item) => item.idf > tokenThreshold)

        if (highValueTokensWithWeight.length < 2) {
            return { match: null, hasAnyCandidates: false, isAmbiguous: false }
        }

        const candidateScores = new Map<string, number>()
        const candidateMatchedIdfSum = new Map<string, number>()
        const candidateMatchedCount = new Map<string, number>()

        for (const item of highValueTokensWithWeight) {
            const matches = this.invertedWordIndex.get(item.token)
            if (!matches) continue

            for (const ref of matches) {
                const prevScore = candidateScores.get(ref) || 0
                const prevMatchedIdf = candidateMatchedIdfSum.get(ref) || 0
                const prevCount = candidateMatchedCount.get(ref) || 0

                candidateScores.set(ref, prevScore + item.weightedIdf)
                candidateMatchedIdfSum.set(ref, prevMatchedIdf + item.weightedIdf)
                candidateMatchedCount.set(ref, prevCount + 1)
            }
        }

        if (candidateScores.size === 0) {
            return { match: null, hasAnyCandidates: false, isAmbiguous: false }
        }

        // Apply decay to the denominator sum so distant words in long transcripts don't crush the score ratio
        const recentHighValueIdfSum = inputTokens.reduce((sum, token, index) => {
            const idf = this.wordIdfMap.get(token) || 0
            if (idf <= tokenThreshold) return sum
            const distanceFromEnd = totalTokensCount - 1 - index
            return sum + idf * Math.pow(0.96, distanceFromEnd)
        }, 0)

        const evaluatedCandidates: Array<{
            ref: string
            finalScore: number
            isCurrent: boolean
            upcomingDistance: number | null
        }> = []

        for (const [ref, accumulatedIdf] of candidateScores.entries()) {
            const verseTokenSet = this.verseTokenSetsMap.get(ref)
            if (!verseTokenSet) continue

            const matchCount = candidateMatchedCount.get(ref) || 0
            if (matchCount < 2) continue

            const matchedQueryIdf = candidateMatchedIdfSum.get(ref) || 1.0
            let scoreRatio = recentHighValueIdfSum > 0 ? matchedQueryIdf / recentHighValueIdfSum : accumulatedIdf / matchedQueryIdf

            scoreRatio = Math.min(scoreRatio, 1.0)
            const candidateParsed = this.parseReference(ref)

            const isCurrent = currentlyOutputted === ref
            const upcomingDist = upcomingVerseMap.get(ref) ?? null

            // Apply reading flow hysteresis unless strong keyword match indicates a jump
            if (isCurrent) {
                scoreRatio *= 1.1
            } else if (upcomingDist === 1) {
                scoreRatio *= 1.7
            } else if (upcomingDist === 2) {
                scoreRatio *= 1.2
            } else if (upcomingDist === 3) {
                scoreRatio *= 1.05
            } else if (parsedCurrent && candidateParsed) {
                // Require at least 3 keyword matches before waiving the jump penalty
                if (matchCount < 3) {
                    if (candidateParsed.book.toLowerCase() === parsedCurrent.book.toLowerCase() && candidateParsed.chapter === parsedCurrent.chapter) {
                        if (candidateParsed.verse < parsedCurrent.verse) {
                            scoreRatio *= 0.3
                        } else {
                            const verseDistance = candidateParsed.verse - parsedCurrent.verse
                            scoreRatio *= Math.pow(0.5, verseDistance - 1)
                        }
                    } else {
                        scoreRatio *= 0.35
                    }
                }
            }

            const threshold = isCurrent || upcomingDist === 1 ? 0.2 : 0.35
            if (scoreRatio >= threshold) {
                evaluatedCandidates.push({
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

        const confidence = Math.min(Math.max(Math.round(topMatch.finalScore * 100 * ambiguityPenalty), 50), 98)

        if (confidence < 55) {
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

        const normalizedDots = this.normalizeReferences(transcript)
        const mishearingsCorrected = normalizeMishearings(normalizedDots)
        const rawNormalized = normalizeNumbers(normalizedDots)
        const mishearingsNormalized = normalizeNumbers(this.normalizeReferences(mishearingsCorrected))

        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings corrected:", mishearingsCorrected)
        if (this.DEBUG_MODE) console.log("[DETECTION] Mishearings normalized:", mishearingsNormalized)

        const refMatch = this.findReferenceMatch(mishearingsNormalized) || this.findReferenceMatch(rawNormalized)
        if (this.DEBUG_MODE) console.log("[DETECTION] Reference match result:", refMatch)

        if (refMatch && refMatch.confidence > 80) {
            return refMatch
        }

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

        if (refMatch && bestContentMatch) {
            return bestContentMatch.confidence >= refMatch.confidence ? bestContentMatch : refMatch
        }

        return refMatch || bestContentMatch || null
    }
}
