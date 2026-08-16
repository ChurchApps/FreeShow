// AI AUTO SCRIPTURE - quote matching: worker payload & index construction
// The matcher runs off the renderer's main thread (quoteMatch.worker.ts), so the verse text has
// to cross a structured-clone boundary once per session. Cloning 31k verse objects per
// translation is exactly the kind of cost that stalls the thread this move is meant to protect -
// instead each translation ships as packed metadata (transferable typed arrays) plus ONE joined
// text blob with an offset table. Markdown stripping and index building then happen on the far
// side of the boundary, and the built indexes never come back (they stay in the worker's heap).
//
// buildIndexesFromPayloads is shared by the worker and by the in-thread fallback host, so both
// paths build byte-identical indexes.

import { stripMarkdown } from "json-bible/lib/markdown"
import { stripText } from "json-bible/lib/util"
import { buildTranslationIndex, PrefixPool, type IndexableVerse, type TranslationIndex } from "./quoteMatchIndex"

export interface TranslationPayload {
    translationId: string
    book: Uint8Array
    chapter: Uint8Array
    verseStart: Uint8Array
    verseEnd: Uint8Array
    textBlob: string // every verse's RAW text, concatenated (stripping happens at build)
    textOffsets: Uint32Array // verseCount + 1 offsets into textBlob
}

// indexes are compact (~4-6 MB per full bible) but a huge library still adds up - stop
// indexing further translations once the session's indexes reach this budget
export const INDEX_MEMORY_BUDGET_BYTES = 256 * 1024 * 1024

interface PayloadBible {
    books?: { number: number; chapters?: { number: number; verses?: { number: number; endNumber?: number; text?: string }[] }[] }[]
}

/** Pack one cached bible into its transfer shape. Cheap enough for the session's build loop. */
export function buildTranslationPayload(translationId: string, bible: PayloadBible): TranslationPayload | null {
    const book: number[] = []
    const chapter: number[] = []
    const verseStart: number[] = []
    const verseEnd: number[] = []
    const textParts: string[] = []
    const textOffsets: number[] = [0]
    let textLength = 0

    for (const bibleBook of bible.books || []) {
        for (const bibleChapter of bibleBook.chapters || []) {
            for (const verse of bibleChapter.verses || []) {
                book.push(bibleBook.number)
                chapter.push(bibleChapter.number)
                verseStart.push(verse.number)
                verseEnd.push(verse.endNumber ?? verse.number)

                const text = verse.text || ""
                textParts.push(text)
                textLength += text.length
                textOffsets.push(textLength)
            }
        }
    }

    if (!book.length) return null
    return {
        translationId,
        book: Uint8Array.from(book),
        chapter: Uint8Array.from(chapter),
        verseStart: Uint8Array.from(verseStart),
        verseEnd: Uint8Array.from(verseEnd),
        textBlob: textParts.join(""),
        textOffsets: Uint32Array.from(textOffsets)
    }
}

/** The typed-array buffers of a payload, for zero-copy postMessage transfer. */
export function payloadTransferables(payloads: TranslationPayload[]): ArrayBuffer[] {
    const buffers: ArrayBuffer[] = []
    for (const payload of payloads) {
        buffers.push(payload.book.buffer as ArrayBuffer, payload.chapter.buffer as ArrayBuffer, payload.verseStart.buffer as ArrayBuffer, payload.verseEnd.buffer as ArrayBuffer, payload.textOffsets.buffer as ArrayBuffer)
    }
    return buffers
}

/**
 * Build the session's indexes (one shared PrefixPool) from payloads, honoring the memory budget.
 * Yields between translations so the hosting thread stays responsive during the ~seconds-long
 * build - the worker keeps answering messages, the fallback keeps the UI alive.
 */
export async function buildIndexesFromPayloads(payloads: TranslationPayload[]): Promise<{ indexes: TranslationIndex[]; totalBytes: number }> {
    const indexes: TranslationIndex[] = []
    const pool = new PrefixPool()
    // the first payload is the drawer translation (the session orders it first): it alone carries
    // the bigram fragment route - one is enough for a fragment to surface its verse, and a route
    // per translation would eat most of the memory budget
    const bigramPool = new PrefixPool()
    let budgetBytes = INDEX_MEMORY_BUDGET_BYTES

    for (const payload of payloads) {
        if (budgetBytes <= 0 && indexes.length) break

        const verses: IndexableVerse[] = []
        const verseCount = payload.textOffsets.length - 1
        for (let ordinal = 0; ordinal < verseCount; ordinal++) {
            verses.push({
                book: payload.book[ordinal],
                chapter: payload.chapter[ordinal],
                verseStart: payload.verseStart[ordinal],
                verseEnd: payload.verseEnd[ordinal],
                cleanText: stripMarkdown(stripText(payload.textBlob.slice(payload.textOffsets[ordinal], payload.textOffsets[ordinal + 1])))
            })
        }
        if (!verses.length) continue

        const index = buildTranslationIndex(payload.translationId, verses, pool, indexes.length === 0 ? { bigrams: true, bigramPool } : {})
        indexes.push(index)
        budgetBytes -= index.sizeBytes

        await new Promise((resolve) => setTimeout(resolve))
    }

    const totalBytes = indexes.reduce((sum, index) => sum + index.sizeBytes, 0) + (indexes.length ? pool.sizeBytes + bigramPool.sizeBytes : 0)
    return { indexes, totalBytes }
}
