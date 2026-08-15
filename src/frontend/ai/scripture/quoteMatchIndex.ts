// AI AUTO SCRIPTURE - quote matching: per-translation verse index
// One compact index per selected translation: every verse becomes an ordinal with packed metadata,
// a full-token id sequence (for order-aware alignment) and prefix-key postings (for candidate
// lookup). Common keys above the document-frequency cap keep their df but drop their postings -
// they are useless for finding a verse, while their idf weight still lets them glue an alignment
// together once a candidate is being scored.
//
// Everything is columnar: token sequences live in one flat buffer per translation (CSR), and
// prefix keys are interned once per session in a PrefixPool shared by every translation's index -
// the per-translation data is typed arrays over the shared prefix-id space. A full 31k-verse
// bible lands around 4-6 MB instead of the ~25 MB the object/Map layout used to cost, and a
// voting pass resolves each spoken token's key to an id once for ALL translations.

import { canonKey, phoneticKey, tokenizeVerseText } from "./quoteMatchTokens"

export interface IndexableVerse {
    book: number
    chapter: number
    verseStart: number
    verseEnd: number // differs from verseStart for merged verses (json-bible Verse.endNumber)
    cleanText: string // already through stripMarkdown/stripText
}

/** Session-wide prefix-key interning - all indexes of one session share the same id space. */
export class PrefixPool {
    keys: string[] = []
    private idByKey = new Map<string, number>()

    /** Build time: id for the key, growing the pool. */
    intern(key: string): number {
        let id = this.idByKey.get(key)
        if (id === undefined) {
            id = this.keys.length
            this.keys.push(key)
            this.idByKey.set(key, id)
        }
        return id
    }

    /** Query time: id for the key, -1 when no indexed translation ever saw it. */
    lookup(key: string): number {
        const id = this.idByKey.get(key)
        return id === undefined ? -1 : id
    }

    get size(): number {
        return this.keys.length
    }

    /** Rough heap cost of the pool itself (strings + map entries). */
    get sizeBytes(): number {
        let bytes = 0
        for (const key of this.keys) bytes += key.length * 2 + 16
        return bytes + this.keys.length * 64
    }
}

export interface TranslationIndex {
    translationId: string
    pool: PrefixPool // shared by every index built in the same session
    verseCount: number
    // per-ordinal packed metadata, ordinals follow book/chapter/verse traversal order
    book: Uint8Array
    chapter: Uint8Array
    verseStart: Uint8Array
    verseEnd: Uint8Array
    chapterBreak: Uint8Array // 1 when this ordinal starts a new chapter
    vocab: string[]
    idfByVocabId: Float32Array
    informativeIdf: number // tokens at/above this idf count as informative match evidence
    // all verse token-id sequences in one flat buffer (verseTokensAt() returns the per-ordinal view)
    tokenData: Uint16Array | Uint32Array
    tokenOffsets: Uint32Array // verseCount + 1
    // by shared prefix id: verse df, and CSR postings (dropped above the df cap: start === end while df > 0)
    prefixDf: Uint32Array
    postingStarts: Uint32Array // pool.size + 1
    postingData: Uint32Array
    sizeBytes: number // rough heap cost of this index (the shared pool is accounted once per session)
}

export const IDF_CAP = 6
// keys present in more than this fraction of verses never vote for candidates
export const DF_VOTE_MAX_FRACTION = 1 / 16

// a token counts as "informative" evidence at/above this idf. Expressed relative to the corpus's
// observed idf ceiling so the floor means the same thing for a full bible (ceiling 6 -> 2.5) and
// for the small corpora used in tests, where idf never gets near the cap.
const INFORMATIVE_IDF_ABSOLUTE = 2.5
const INFORMATIVE_IDF_FRACTION = 0.42

export function buildTranslationIndex(translationId: string, verses: IndexableVerse[], pool: PrefixPool = new PrefixPool()): TranslationIndex {
    const verseCount = verses.length
    const book = new Uint8Array(verseCount)
    const chapter = new Uint8Array(verseCount)
    const verseStart = new Uint8Array(verseCount)
    const verseEnd = new Uint8Array(verseCount)
    const chapterBreak = new Uint8Array(verseCount)

    const vocab: string[] = []
    const vocabIdByToken = new Map<string, number>()
    const dfByVocabId: number[] = []

    const tokenOffsets = new Uint32Array(verseCount + 1)
    const tokenIdsFlat: number[] = []

    // raw postings per pool prefix id - materialized into CSR once every verse is tokenized
    const ordinalsByPrefixId = new Map<number, number[]>()

    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        const verse = verses[ordinal]
        book[ordinal] = verse.book
        chapter[ordinal] = verse.chapter
        verseStart[ordinal] = verse.verseStart
        verseEnd[ordinal] = Math.max(verse.verseStart, verse.verseEnd)
        chapterBreak[ordinal] = ordinal === 0 || verses[ordinal - 1].book !== verse.book || verses[ordinal - 1].chapter !== verse.chapter ? 1 : 0

        const tokens = tokenizeVerseText(verse.cleanText)
        const seenTokenIds = new Set<number>()
        const seenPrefixIds = new Set<number>()

        for (let i = 0; i < tokens.length; i++) {
            let id = vocabIdByToken.get(tokens[i])
            if (id === undefined) {
                id = vocab.length
                vocab.push(tokens[i])
                vocabIdByToken.set(tokens[i], id)
                dfByVocabId.push(0)
            }
            tokenIdsFlat.push(id)

            if (!seenTokenIds.has(id)) {
                seenTokenIds.add(id)
                dfByVocabId[id]++
            }

            const prefixId = pool.intern(canonKey(tokens[i]))
            if (!seenPrefixIds.has(prefixId)) {
                seenPrefixIds.add(prefixId)
                let list = ordinalsByPrefixId.get(prefixId)
                if (!list) ordinalsByPrefixId.set(prefixId, (list = []))
                list.push(ordinal)
            }
        }
        tokenOffsets[ordinal + 1] = tokenIdsFlat.length
    }

    // vocab ids of a single translation stay well under 65k - fall back to 32 bit if one ever does not
    if (vocab.length > 0xffff) console.warn(`[AiScripture] Unusually large vocabulary in ${translationId}: ${vocab.length} tokens`)
    const tokenData = vocab.length > 0xffff ? Uint32Array.from(tokenIdsFlat) : Uint16Array.from(tokenIdsFlat)

    const idfByVocabId = new Float32Array(vocab.length)
    let maxIdf = 0
    for (let id = 0; id < vocab.length; id++) {
        idfByVocabId[id] = Math.min(IDF_CAP, Math.log(1 + verseCount / dfByVocabId[id]))
        if (idfByVocabId[id] > maxIdf) maxIdf = idfByVocabId[id]
    }
    const informativeIdf = Math.min(INFORMATIVE_IDF_ABSOLUTE, INFORMATIVE_IDF_FRACTION * maxIdf)

    // phonetic postings: a second lookup route for informative tokens only (proper nouns, rare
    // words), so a misheard name ("analekite") still finds its verses when the prefix key fails.
    // Keys are namespaced with "~" - baseTokens can never produce that character - and live in the
    // same pool and CSR as the prefix keys, so df/idf/postings machinery applies unchanged
    // (including the df cap: a skeleton aggregating into a common bucket drops its postings)
    const phoneticIdByVocabId = new Int32Array(vocab.length).fill(-1)
    for (let id = 0; id < vocab.length; id++) {
        if (idfByVocabId[id] < informativeIdf) continue
        const key = phoneticKey(vocab[id])
        if (key) phoneticIdByVocabId[id] = pool.intern("~" + key)
    }
    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        let seenPhonetic: Set<number> | null = null
        for (let i = tokenOffsets[ordinal]; i < tokenOffsets[ordinal + 1]; i++) {
            const phoneticId = phoneticIdByVocabId[tokenIdsFlat[i]]
            if (phoneticId < 0 || seenPhonetic?.has(phoneticId)) continue
            ;(seenPhonetic ||= new Set()).add(phoneticId)
            let list = ordinalsByPrefixId.get(phoneticId)
            if (!list) ordinalsByPrefixId.set(phoneticId, (list = []))
            list.push(ordinal)
        }
    }

    // CSR postings over the shared prefix-id space. The pool can keep growing while LATER
    // translations are built - lookups beyond this index's range just read df 0 / no postings.
    // absolute floor keeps small corpora (tests, tiny translations) from dropping every posting
    const dfCap = Math.max(2, verseCount * DF_VOTE_MAX_FRACTION)
    const poolSize = pool.size
    const prefixDf = new Uint32Array(poolSize)
    const postingStarts = new Uint32Array(poolSize + 1)

    let postingTotal = 0
    ordinalsByPrefixId.forEach((ordinals, prefixId) => {
        prefixDf[prefixId] = ordinals.length
        if (ordinals.length <= dfCap) postingTotal += ordinals.length
    })

    const postingData = new Uint32Array(postingTotal)
    let cursor = 0
    for (let prefixId = 0; prefixId < poolSize; prefixId++) {
        postingStarts[prefixId] = cursor
        const ordinals = ordinalsByPrefixId.get(prefixId)
        if (ordinals && ordinals.length <= dfCap) {
            for (const ordinal of ordinals) postingData[cursor++] = ordinal
        }
    }
    postingStarts[poolSize] = cursor

    let sizeBytes = book.byteLength + chapter.byteLength + verseStart.byteLength + verseEnd.byteLength + chapterBreak.byteLength
    sizeBytes += tokenData.byteLength + tokenOffsets.byteLength + idfByVocabId.byteLength
    sizeBytes += prefixDf.byteLength + postingStarts.byteLength + postingData.byteLength
    for (const token of vocab) sizeBytes += token.length * 2 + 16

    return { translationId, pool, verseCount, book, chapter, verseStart, verseEnd, chapterBreak, vocab, idfByVocabId, informativeIdf, tokenData, tokenOffsets, prefixDf, postingStarts, postingData, sizeBytes }
}

/** The verse's token-id sequence, as a zero-copy view into the flat buffer. */
export function verseTokensAt(index: TranslationIndex, ordinal: number): Uint16Array | Uint32Array {
    return index.tokenData.subarray(index.tokenOffsets[ordinal], index.tokenOffsets[ordinal + 1])
}

/** Sorted verse ordinals for a prefix id - null when this translation never saw it or dropped it above the df cap. */
export function postingsForKey(index: TranslationIndex, prefixId: number): Uint32Array | null {
    if (prefixId < 0 || prefixId >= index.postingStarts.length - 1) return null
    const start = index.postingStarts[prefixId]
    const end = index.postingStarts[prefixId + 1]
    return end > start ? index.postingData.subarray(start, end) : null
}

/** idf of a prefix id over the verse corpus (for candidate voting weight). */
export function prefixIdf(index: TranslationIndex, prefixId: number): number {
    const df = prefixId >= 0 && prefixId < index.prefixDf.length ? index.prefixDf[prefixId] : 0
    if (!df) return 0
    return Math.min(IDF_CAP, Math.log(1 + index.verseCount / df))
}
