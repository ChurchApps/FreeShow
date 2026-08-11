// AI AUTO SCRIPTURE - quote matching: per-translation verse index
// One compact index per selected translation: every verse becomes an ordinal with packed metadata,
// a full-token id sequence (for order-aware alignment) and prefix-key postings (for candidate
// lookup). Common keys above the document-frequency cap keep their df but drop their postings -
// they are useless for finding a verse, while their idf weight still lets them glue an alignment
// together once a candidate is being scored.

import { canonKey, tokenizeVerseText } from "./quoteMatchTokens"

export interface IndexableVerse {
    book: number
    chapter: number
    verseStart: number
    verseEnd: number // differs from verseStart for merged verses (json-bible Verse.endNumber)
    cleanText: string // already through stripMarkdown/stripText
}

export interface TranslationIndex {
    translationId: string
    verseCount: number
    // per-ordinal packed metadata, ordinals follow book/chapter/verse traversal order
    book: Uint8Array
    chapter: Uint8Array
    verseStart: Uint8Array
    verseEnd: Uint8Array
    chapterBreak: Uint8Array // 1 when this ordinal starts a new chapter
    vocab: string[]
    vocabIdByToken: Map<string, number>
    idfByVocabId: Float32Array
    informativeIdf: number // tokens at/above this idf count as informative match evidence
    prefixBuckets: Map<string, number[]> // canonKey -> vocab ids sharing the prefix
    postings: Map<string, Uint32Array> // canonKey -> sorted verse ordinals; absent above the df cap
    prefixDf: Map<string, number> // canonKey -> verse df (kept even when postings are dropped)
    verseTokens: Uint16Array[] // per-ordinal vocab-id sequence in text order
}

export const IDF_CAP = 6
// keys present in more than this fraction of verses never vote for candidates
export const DF_VOTE_MAX_FRACTION = 1 / 16

// a token counts as "informative" evidence at/above this idf. Expressed relative to the corpus's
// observed idf ceiling so the floor means the same thing for a full bible (ceiling 6 -> 2.5) and
// for the small corpora used in tests, where idf never gets near the cap.
const INFORMATIVE_IDF_ABSOLUTE = 2.5
const INFORMATIVE_IDF_FRACTION = 0.42

export function buildTranslationIndex(translationId: string, verses: IndexableVerse[]): TranslationIndex {
    const verseCount = verses.length
    const book = new Uint8Array(verseCount)
    const chapter = new Uint8Array(verseCount)
    const verseStart = new Uint8Array(verseCount)
    const verseEnd = new Uint8Array(verseCount)
    const chapterBreak = new Uint8Array(verseCount)

    const vocab: string[] = []
    const vocabIdByToken = new Map<string, number>()
    const dfByVocabId: number[] = []
    const verseTokens: Uint16Array[] = new Array(verseCount)

    const prefixDf = new Map<string, number>()
    const prefixOrdinals = new Map<string, number[]>()

    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        const verse = verses[ordinal]
        book[ordinal] = verse.book
        chapter[ordinal] = verse.chapter
        verseStart[ordinal] = verse.verseStart
        verseEnd[ordinal] = Math.max(verse.verseStart, verse.verseEnd)
        chapterBreak[ordinal] = ordinal === 0 || verses[ordinal - 1].book !== verse.book || verses[ordinal - 1].chapter !== verse.chapter ? 1 : 0

        const tokens = tokenizeVerseText(verse.cleanText)
        const ids = new Uint16Array(tokens.length)
        const seenTokenIds = new Set<number>()
        const seenKeys = new Set<string>()

        for (let i = 0; i < tokens.length; i++) {
            let id = vocabIdByToken.get(tokens[i])
            if (id === undefined) {
                id = vocab.length
                vocab.push(tokens[i])
                vocabIdByToken.set(tokens[i], id)
                dfByVocabId.push(0)
            }
            ids[i] = id

            if (!seenTokenIds.has(id)) {
                seenTokenIds.add(id)
                dfByVocabId[id]++
            }

            const key = canonKey(tokens[i])
            if (!seenKeys.has(key)) {
                seenKeys.add(key)
                prefixDf.set(key, (prefixDf.get(key) || 0) + 1)
                let list = prefixOrdinals.get(key)
                if (!list) prefixOrdinals.set(key, (list = []))
                list.push(ordinal)
            }
        }
        verseTokens[ordinal] = ids
    }

    const idfByVocabId = new Float32Array(vocab.length)
    let maxIdf = 0
    for (let id = 0; id < vocab.length; id++) {
        idfByVocabId[id] = Math.min(IDF_CAP, Math.log(1 + verseCount / dfByVocabId[id]))
        if (idfByVocabId[id] > maxIdf) maxIdf = idfByVocabId[id]
    }
    const informativeIdf = Math.min(INFORMATIVE_IDF_ABSOLUTE, INFORMATIVE_IDF_FRACTION * maxIdf)

    const prefixBuckets = new Map<string, number[]>()
    for (let id = 0; id < vocab.length; id++) {
        const key = canonKey(vocab[id])
        let bucket = prefixBuckets.get(key)
        if (!bucket) prefixBuckets.set(key, (bucket = []))
        bucket.push(id)
    }

    // absolute floor keeps small corpora (tests, tiny translations) from dropping every posting
    const dfCap = Math.max(2, verseCount * DF_VOTE_MAX_FRACTION)
    const postings = new Map<string, Uint32Array>()
    prefixOrdinals.forEach((ordinals, key) => {
        if (ordinals.length <= dfCap) postings.set(key, Uint32Array.from(ordinals))
    })

    return { translationId, verseCount, book, chapter, verseStart, verseEnd, chapterBreak, vocab, vocabIdByToken, idfByVocabId, informativeIdf, prefixBuckets, postings, prefixDf, verseTokens }
}

/** idf of a prefix key over the verse corpus (for candidate voting weight). */
export function prefixIdf(index: TranslationIndex, key: string): number {
    const df = index.prefixDf.get(key)
    if (!df) return 0
    return Math.min(IDF_CAP, Math.log(1 + index.verseCount / df))
}
