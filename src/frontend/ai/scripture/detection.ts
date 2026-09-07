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
    // ------------------------------------------------------------------
    // Compact String Pool & Reference Management
    // ------------------------------------------------------------------
    private versePool: string[] = [] // ID -> "John 3:16"
    private verseToIdMap: Map<string, number> = new Map() // "john 3:16" -> ID

    // Quick structural index: "genesis 1" -> { bookName, chapterNumber, startVerseId, verseCount }
    private referenceIndex: Map<string, { bookName: string; chapterNumber: number; startVerseId: number; verseCount: number }> = new Map()

    // ------------------------------------------------------------------
    // Inverted Index (Packed Typed Arrays)
    // ------------------------------------------------------------------
    private vocabPool: string[] = [] // ID -> "beginning"
    private vocabToIdMap: Map<string, number> = new Map() // "beginning" -> ID
    private wordIdf: Float32Array = new Float32Array(0) // Vocabulary ID -> IDF score

    // CSR (Compressed Sparse Row) packed postings list:
    // wordPostingsOffsets[wordId] to wordPostingsOffsets[wordId + 1] slices wordPostings
    private wordPostingsOffsets: Uint32Array = new Uint32Array(0)
    private wordPostings: Uint32Array = new Uint32Array(0) // Array of Verse IDs

    // Verse token bit-sets / sorted unique token IDs per verse
    private verseTokensOffsets: Uint32Array = new Uint32Array(0)
    private verseTokens: Uint32Array = new Uint32Array(0) // Array of Word IDs per verse

    private bookNames: string[] = []
    private refRegex: RegExp | null = null
    private totalVerses = 0

    constructor(bible: Bible) {
        this.buildCache(bible)
    }

    private buildCache(bible: Bible): void {
        const tempPostingsMap: Map<number, number[]> = new Map()
        const tempVerseTokensMap: number[][] = []

        // Pass 1: Build verse pool and reference indices
        for (const book of bible.books) {
            this.bookNames.push(book.name)
            for (const chapter of book.chapters) {
                const refKey = `${book.name.toLowerCase()} ${chapter.number}`
                const startVerseId = this.totalVerses
                let chapterVerseCount = 0

                for (const verse of chapter.verses) {
                    const verseRef = `${book.name} ${chapter.number}:${verse.number}`
                    const verseId = this.totalVerses

                    this.versePool.push(verseRef)
                    this.verseToIdMap.set(verseRef.toLowerCase(), verseId)
                    this.totalVerses++
                    chapterVerseCount++

                    const rawTokens = this.tokenizeText(verse.text)
                    const uniqueWordIds = new Set<number>()

                    for (const word of rawTokens) {
                        let wordId = this.vocabToIdMap.get(word)
                        if (wordId === undefined) {
                            wordId = this.vocabPool.length
                            this.vocabToIdMap.set(word, wordId)
                            this.vocabPool.push(word)
                        }
                        uniqueWordIds.add(wordId)
                    }

                    const sortedWordIds = Array.from(uniqueWordIds).sort((a, b) => a - b)
                    tempVerseTokensMap.push(sortedWordIds)

                    for (const wordId of sortedWordIds) {
                        let list = tempPostingsMap.get(wordId)
                        if (!list) {
                            list = []
                            tempPostingsMap.set(wordId, list)
                        }
                        list.push(verseId)
                    }
                }

                this.referenceIndex.set(refKey, {
                    bookName: book.name,
                    chapterNumber: chapter.number,
                    startVerseId,
                    verseCount: chapterVerseCount
                })
            }
        }

        // Pass 2: Pack vocabulary IDFs & word postings into Uint32Array / Float32Array
        const vocabSize = this.vocabPool.length
        this.wordIdf = new Float32Array(vocabSize)
        this.wordPostingsOffsets = new Uint32Array(vocabSize + 1)

        let totalPostingsCount = 0
        for (let wordId = 0; wordId < vocabSize; wordId++) {
            const list = tempPostingsMap.get(wordId) || []
            this.wordPostingsOffsets[wordId] = totalPostingsCount
            totalPostingsCount += list.length

            const docFreq = list.length
            this.wordIdf[wordId] = Math.log((this.totalVerses + 1) / (docFreq + 1))
        }
        this.wordPostingsOffsets[vocabSize] = totalPostingsCount

        this.wordPostings = new Uint32Array(totalPostingsCount)
        for (let wordId = 0; wordId < vocabSize; wordId++) {
            const list = tempPostingsMap.get(wordId) || []
            const offset = this.wordPostingsOffsets[wordId]
            for (let i = 0; i < list.length; i++) {
                this.wordPostings[offset + i] = list[i]
            }
        }

        // Pass 3: Pack verse tokens into Uint32Array offsets
        this.verseTokensOffsets = new Uint32Array(this.totalVerses + 1)
        let totalVerseTokensCount = 0

        for (let verseId = 0; verseId < this.totalVerses; verseId++) {
            const tokens = tempVerseTokensMap[verseId] || []
            this.verseTokensOffsets[verseId] = totalVerseTokensCount
            totalVerseTokensCount += tokens.length
        }
        this.verseTokensOffsets[this.totalVerses] = totalVerseTokensCount

        this.verseTokens = new Uint32Array(totalVerseTokensCount)
        for (let verseId = 0; verseId < this.totalVerses; verseId++) {
            const tokens = tempVerseTokensMap[verseId] || []
            const offset = this.verseTokensOffsets[verseId]
            for (let i = 0; i < tokens.length; i++) {
                this.verseTokens[offset + i] = tokens[i]
            }
        }

        const bookPattern = this.bookNames.map((b) => b.replace(/\s+/g, "\\s+")).join("|")
        this.refRegex = new RegExp(`\\b((?:(?:[1-3]|first|second|third)\\s+)?(?:${bookPattern}))\\b\\s*(?:chapter)?\\s*(\\d+)(?:[\\s,:.]+(?:verse|v|verses)?\\s*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?)?`, "i")
    }

    private normalizeReferences(text: string): string {
        let normalized = text

        // Convert "Mark chapter 8 and 22" or "Mark 8 verse 22" -> "Mark 8:22"
        normalized = normalized.replace(/\b([\p{L}\p{N}\s]+?)\s*(?:chapter\s*)?(\d+)\s+(?:and|verse|v)\s+(\d+)\b/giu, "$1 $2:$3")

        // Prevent matching digits if they are immediately preceded by a colon or verse marker
        normalized = normalized.replace(/(?<!:)\b([\p{L}\p{N}\s]+?)\s+(\d+)\.(\d+)\b/gu, "$1 $2:$3")
        normalized = normalized.replace(/(?<!:)\b([\p{L}\p{N}\s]+?)\s+(\d+),\s*(\d+)\b/gu, "$1 $2:$3")
        normalized = normalized.replace(/(?<!:)\b([\p{L}\p{N}\s]+?)\s+(\d+)\s+(\d+)\b/gu, "$1 $2:$3")

        // Split concatenated 3- and 4-digit reference numbers (e.g., 4610 -> 46:10 or 316 -> 3:16)
        normalized = normalized.replace(/\b([\p{L}]+)\s+(\d{3,4})\b/gu, (match, book, digits) => {
            if (digits.length === 3) return `${book} ${digits.slice(0, 1)}:${digits.slice(1)}`
            if (digits.length === 4) return `${book} ${digits.slice(0, 2)}:${digits.slice(2)}`
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
        if (!this.refRegex) return null

        const globalRegex = new RegExp(this.refRegex.source, "gi")
        const matches = Array.from(cleanInput.matchAll(globalRegex))
        if (matches.length === 0) return null

        const refMatch = matches[matches.length - 1]
        const matchIndex = refMatch.index ?? 0
        const matchLength = refMatch[0].length

        if (cleanInput.length - (matchIndex + matchLength) > 30) return null

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
            if (chapterData.verseCount < 1) return null
            return {
                type: "scripture",
                content: `${chapterData.bookName} ${chapterData.chapterNumber}:1`,
                confidence: 75
            }
        }

        if (startVerseNum < 1 || startVerseNum > chapterData.verseCount) return null

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

    // if the text has a verse number only, we should look at the reference in the input or currently outputted reference to determine the likely chapter and book
    public findStandaloneVerseMatch(cleanInput: string, currentlyOutputted?: string | null): MatchResult | null {
        // Matches patterns like "verse 17", "v17", "verses 17-18"
        const verseRegex = /\b(?:verse|v|verses)\s*(\d+)(?:\s*[-–—]\s*(\d+))?\b/gi
        const matches = Array.from(cleanInput.matchAll(verseRegex))
        if (matches.length === 0) return null

        // Iterate backward through matches to prioritize the last (most recent) mention
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i]
            const matchIndex = match.index ?? 0
            const matchLength = match[0].length

            if (cleanInput.length - (matchIndex + matchLength) > 50) continue

            const startVerseNum = parseInt(match[1], 10)
            const endVerseNum = match[2] ? parseInt(match[2], 10) : undefined

            // Prioritize reference matches found in the text directly preceding this verse mention
            const priorText = cleanInput.slice(0, matchIndex)
            const inlineRef = this.findReferenceMatch(priorText)
            const targetRef = inlineRef?.content || currentlyOutputted

            if (!targetRef) continue

            const parsedCurrent = this.parseReference(targetRef)
            if (!parsedCurrent) continue

            const refKey = `${parsedCurrent.book.toLowerCase()} ${parsedCurrent.chapter}`
            const chapterData = this.referenceIndex.get(refKey)

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
            const chapterData = this.referenceIndex.get(refKey)

            if (chapterData && nextVerseNum <= chapterData.verseCount) {
                const verseId = chapterData.startVerseId + (nextVerseNum - 1)
                upcoming.set(verseId, dist)
                currentVerse = nextVerseNum
            } else {
                const nextChapKey = `${currentBook.toLowerCase()} ${currentChap + 1}`
                const nextChapData = this.referenceIndex.get(nextChapKey)
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

    private evaluateContentMatch(allTokens: string[], windowSize: number, parsedCurrent: { book: string; chapter: number; verse: number } | null, upcomingVerseMap: Map<number, number>, currentlyOutputted?: string | null): { match: MatchResult | null; hasAnyCandidates: boolean; isAmbiguous: boolean } {
        const inputTokens = allTokens.slice(-windowSize)
        const tokenThreshold = 1.0
        const totalTokensCount = inputTokens.length

        const highValueTokensWithWeight: Array<{ wordId: number; weightedIdf: number }> = []

        for (let index = 0; index < inputTokens.length; index++) {
            const token = inputTokens[index]
            const wordId = this.vocabToIdMap.get(token)
            if (wordId === undefined) continue

            const idf = this.wordIdf[wordId]
            if (idf <= tokenThreshold) continue

            const distanceFromEnd = totalTokensCount - 1 - index
            const decayWeight = Math.pow(0.96, distanceFromEnd)
            highValueTokensWithWeight.push({ wordId, weightedIdf: idf * decayWeight })
        }

        if (highValueTokensWithWeight.length < 2) {
            return { match: null, hasAnyCandidates: false, isAmbiguous: false }
        }

        const candidateScores = new Map<number, number>()
        const candidateMatchedIdfSum = new Map<number, number>()
        const candidateMatchedCount = new Map<number, number>()

        for (const item of highValueTokensWithWeight) {
            const startOffset = this.wordPostingsOffsets[item.wordId]
            const endOffset = this.wordPostingsOffsets[item.wordId + 1]

            for (let offset = startOffset; offset < endOffset; offset++) {
                const verseId = this.wordPostings[offset]
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

        // Apply decay to the denominator sum so distant words in long transcripts don't crush the score ratio
        const recentHighValueIdfSum = inputTokens.reduce((sum, token, index) => {
            const wordId = this.vocabToIdMap.get(token)
            if (wordId === undefined) return sum
            const idf = this.wordIdf[wordId]
            if (idf <= tokenThreshold) return sum
            const distanceFromEnd = totalTokensCount - 1 - index
            return sum + idf * Math.pow(0.96, distanceFromEnd)
        }, 0)

        const evaluatedCandidates: Array<{
            verseId: number
            ref: string
            finalScore: number
            isCurrent: boolean
            upcomingDistance: number | null
        }> = []

        const currentVerseId = currentlyOutputted ? this.verseToIdMap.get(currentlyOutputted.toLowerCase()) : undefined

        for (const [verseId, accumulatedIdf] of candidateScores.entries()) {
            const matchCount = candidateMatchedCount.get(verseId) || 0
            if (matchCount < 2) continue

            const ref = this.versePool[verseId]
            const matchedQueryIdf = candidateMatchedIdfSum.get(verseId) || 1.0
            let scoreRatio = recentHighValueIdfSum > 0 ? matchedQueryIdf / recentHighValueIdfSum : accumulatedIdf / matchedQueryIdf

            scoreRatio = Math.min(scoreRatio, 1.0)
            const candidateParsed = this.parseReference(ref)

            const isCurrent = currentVerseId === verseId
            const upcomingDist = upcomingVerseMap.get(verseId) ?? null

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

        // Step 1: Evaluate reference or standalone verse matches first (focusing on late occurrences in text)
        const refMatch = this.findStandaloneVerseMatch(mishearingsNormalized, currentlyOutputted) || this.findStandaloneVerseMatch(rawNormalized, currentlyOutputted) || this.findReferenceMatch(mishearingsNormalized) || this.findReferenceMatch(rawNormalized)

        if (this.DEBUG_MODE) console.log("[DETECTION] Reference match result:", refMatch)

        // Return immediately if an explicit verse or chapter/verse reference match was found in the text
        if (refMatch) return refMatch

        if (isCancelled?.()) return null

        // Step 2: Fall back to content-based search only if no explicit references/verses matched
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

        return bestContentMatch || null
    }
}
