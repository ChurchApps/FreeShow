import { describe, expect, it } from "vitest"
import type { BibleCacheData } from "./BibleCacheManager"
import { BibleSearchDetector } from "./BibleSearchDetector"

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/['’`\-_]/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter((w) => w.length > 1)
}

/**
 * Builds a minimal BibleCacheData with realistic corpus-scale IDF values
 * (simulating a ~31,102-verse Bible) for deterministic unit testing.
 */
function buildMockCache(verses: Array<{ book: string; chapter: number; verse: number; text: string }>, customDocFreq: Record<string, number> = {}): BibleCacheData {
    const totalVerses = 31102
    const versePool: string[] = []
    const verseToIdMap = new Map<string, number>()
    const referenceIndex = new Map<string, { bookName: string; chapterNumber: number; startVerseId: number; verseCount: number }>()
    const vocabPool: string[] = []
    const vocabToIdMap = new Map<string, number>()
    const tempPostingsMap = new Map<number, number[]>()
    const tempVerseTokens: number[][] = []
    const bookNamesSet = new Set<string>()

    verses.forEach((v, idx) => {
        const ref = `${v.book} ${v.chapter}:${v.verse}`
        versePool.push(ref)
        verseToIdMap.set(ref.toLowerCase(), idx)
        bookNamesSet.add(v.book)

        const refKey = `${v.book.toLowerCase()} ${v.chapter}`
        const existing = referenceIndex.get(refKey)
        if (!existing) {
            referenceIndex.set(refKey, { bookName: v.book, chapterNumber: v.chapter, startVerseId: idx, verseCount: 1 })
        } else {
            existing.verseCount++
        }

        const tokens = tokenize(v.text)
        const tokenIds: number[] = []
        const uniqueIds = new Set<number>()

        for (const word of tokens) {
            let wordId = vocabToIdMap.get(word)
            if (wordId === undefined) {
                wordId = vocabPool.length
                vocabToIdMap.set(word, wordId)
                vocabPool.push(word)
            }
            tokenIds.push(wordId)
            uniqueIds.add(wordId)
        }

        tempVerseTokens.push(tokenIds)
        for (const wordId of uniqueIds) {
            const list = tempPostingsMap.get(wordId) || []
            list.push(idx)
            tempPostingsMap.set(wordId, list)
        }
    })

    const vocabSize = vocabPool.length
    const wordIdf = new Float32Array(vocabSize)
    const wordPostingsOffsets = new Uint32Array(vocabSize + 1)
    let totalPostings = 0

    for (let wordId = 0; wordId < vocabSize; wordId++) {
        const word = vocabPool[wordId]
        const list = tempPostingsMap.get(wordId) || []
        wordPostingsOffsets[wordId] = totalPostings
        totalPostings += list.length

        const docFreq = customDocFreq[word] ?? 50
        wordIdf[wordId] = Math.log((totalVerses + 1) / (docFreq + 1))
    }
    wordPostingsOffsets[vocabSize] = totalPostings

    const wordPostings = new Uint32Array(totalPostings)
    for (let wordId = 0; wordId < vocabSize; wordId++) {
        const list = tempPostingsMap.get(wordId) || []
        const offset = wordPostingsOffsets[wordId]
        for (let i = 0; i < list.length; i++) {
            wordPostings[offset + i] = list[i]
        }
    }

    const verseTokensOffsets = new Uint32Array(verses.length + 1)
    let totalTokens = 0
    for (let i = 0; i < verses.length; i++) {
        verseTokensOffsets[i] = totalTokens
        totalTokens += tempVerseTokens[i].length
    }
    verseTokensOffsets[verses.length] = totalTokens

    const verseTokens = new Uint32Array(totalTokens)
    for (let i = 0; i < verses.length; i++) {
        const offset = verseTokensOffsets[i]
        for (let j = 0; j < tempVerseTokens[i].length; j++) {
            verseTokens[offset + j] = tempVerseTokens[i][j]
        }
    }

    return {
        versePool,
        verseToIdMap,
        referenceIndex,
        vocabPool,
        vocabToIdMap,
        wordIdf,
        wordPostingsOffsets,
        wordPostings,
        verseTokensOffsets,
        verseTokens,
        bookNames: Array.from(bookNamesSet),
        refRegex: null,
        totalVerses
    }
}

const commonDocFreqs: Record<string, number> = {
    the: 25000,
    and: 24000,
    of: 20000,
    to: 15000,
    in: 14000,
    you: 6000,
    for: 9000,
    god: 4000,
    lord: 6500,
    is: 6500,
    my: 4000,
    are: 2500,
    so: 2500,
    how: 500,
    beginning: 100,
    created: 40,
    heavens: 150,
    earth: 900,
    loved: 120,
    world: 200,
    shepherd: 45,
    serpents: 15,
    brood: 10,
    vipers: 10,
    escape: 50,
    being: 200,
    sentenced: 5,
    hell: 30
}

describe("BibleSearchDetector content matching", () => {
    const cache = buildMockCache(
        [
            { book: "Matthew", chapter: 23, verse: 33, text: "You serpents, you brood of vipers, how are you to escape being sentenced to hell?" },
            { book: "Genesis", chapter: 1, verse: 1, text: "In the beginning, God created the heavens and the earth." },
            { book: "John", chapter: 1, verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
            { book: "John", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." },
            { book: "Psalms", chapter: 23, verse: 1, text: "The Lord is my shepherd; I shall not want." }
        ],
        commonDocFreqs
    )
    const detector = new BibleSearchDetector(cache)

    it('does not match "Please take your seats before we begin" to any verse', async () => {
        const result = await detector.findContentMatch("Please take your seats before we begin")
        expect(result).toBeNull()
    })

    it('does not match "We are going to start in a minute" to any verse', async () => {
        const result = await detector.findContentMatch("We are going to start in a minute")
        expect(result).toBeNull()
    })

    it('matches "In the beginning God" to Genesis 1:1', async () => {
        const result = await detector.findContentMatch("In the beginning God")
        expect(result?.content).toBe("Genesis 1:1")
        expect(result?.confidence).toBeGreaterThanOrEqual(80)
    })

    it("matches Genesis 1:1 with high confidence", async () => {
        const result = await detector.findContentMatch("In the beginning God created the heavens and the earth")
        expect(result?.content).toBe("Genesis 1:1")
        expect(result?.confidence).toBeGreaterThanOrEqual(90)
    })

    it("matches John 3:16 from a distinctive phrase", async () => {
        const result = await detector.findContentMatch("For God so loved the world")
        expect(result?.content).toBe("John 3:16")
        expect(result?.confidence).toBeGreaterThanOrEqual(80)
    })

    it("matches Psalms 23:1 from a short distinctive quote", async () => {
        const result = await detector.findContentMatch("The Lord is my shepherd")
        expect(result?.content).toBe("Psalms 23:1")
        expect(result?.confidence).toBeGreaterThanOrEqual(80)
    })
})
