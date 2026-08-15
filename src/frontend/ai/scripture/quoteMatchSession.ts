// AI AUTO SCRIPTURE - quote matching: session lifecycle
// Owns the QuoteMatcher for the duration of a listening session: builds the per-translation
// indexes from the bibles already loaded for the session, mirrors the main process's segment
// gating (music / interpretation language), and turns matcher emissions into DetectedReference
// objects for the controller's normal detection funnel.
//
// The detection callback is injected at start, so this module never imports the controller
// (no aiScripture <-> quoteMatchSession import cycle).

import { get } from "svelte/store"
import { stripMarkdown } from "json-bible/lib/markdown"
import { stripText } from "json-bible/lib/util"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { ai, aiQuoteMatchActive, scriptures, scripturesCache } from "../../stores"
import { buildTranslationIndex, PrefixPool, type IndexableVerse, type TranslationIndex } from "./quoteMatchIndex"
import { QuoteMatcher, type QuoteMatchEmission } from "./quoteMatcher"

export interface QuoteMatchSessionConfig {
    bibleIds: string[] // expanded leaf ids (collections already flattened)
    interpretationMode: boolean
    listenLanguage?: string
    onDetection: (ref: DetectedReference) => void
}

interface TranscriptSegment {
    text: string
    startMs: number
    endMs: number
    language?: string
    music?: boolean
}

let matcher: QuoteMatcher | null = null
let starting = false
let gate: { interpretationMode: boolean; listenLanguage?: string } | null = null
let onDetection: ((ref: DetectedReference) => void) | null = null
let pendingSegments: TranscriptSegment[] = []
let pendingAnchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null = null
// bumped on every start/stop so a slow index build that got superseded discards itself
let sessionToken = 0
let idCounter = 0

const PENDING_SEGMENT_CAP = 50
// indexes are compact (~4-6 MB per full bible) but a huge library still adds up - stop
// indexing further translations once the session's indexes reach this budget
const INDEX_MEMORY_BUDGET_BYTES = 256 * 1024 * 1024

export function startQuoteMatching(config: QuoteMatchSessionConfig): void {
    stopQuoteMatching()
    const token = ++sessionToken

    starting = true
    gate = { interpretationMode: config.interpretationMode, listenLanguage: config.listenLanguage }
    onDetection = config.onDetection

    buildIndexes(config.bibleIds)
        .then((indexes) => {
            if (token !== sessionToken) return // superseded by a newer start or a stop
            starting = false
            if (!indexes.length) {
                // no local verse text available (e.g. API bibles only) - say so, or this is invisible
                console.warn("[AiScripture] Quote matching inactive: none of the selected bibles have local verse text", config.bibleIds)
                return
            }

            const totalBytes = indexes.reduce((sum, index) => sum + index.sizeBytes, 0) + indexes[0].pool.sizeBytes
            console.info(`[AiScripture] Quote matching active: ${indexes.length} translation${indexes.length === 1 ? "" : "s"} indexed (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`)
            aiQuoteMatchActive.set(true)
            matcher = new QuoteMatcher(indexes)
            if (pendingAnchor) matcher.setAnchor(pendingAnchor)

            // segments that arrived while the indexes were building
            const buffered = pendingSegments
            pendingSegments = []
            for (const segment of buffered) feedSegment(segment)
        })
        .catch((err) => {
            if (token !== sessionToken) return
            starting = false
            console.error("AI scripture quote matching failed to start:", err)
        })
}

export function stopQuoteMatching(): void {
    sessionToken++
    starting = false
    aiQuoteMatchActive.set(false)
    matcher = null
    gate = null
    onDetection = null
    pendingSegments = []
    pendingAnchor = null
}

export function handleQuoteMatchTranscript(segment: TranscriptSegment): void {
    if (!matcher && !starting) return
    // live kill switch: turning the setting off mid session stops matching without a restart
    if (get(ai).scripture?.quoteMatching === false) return

    // mirror the main process's detection gating (electron/ai/index.ts): music lyrics are
    // hallucination territory, and in interpretation mode only the listen language is detectable
    if (segment.music) return
    if (gate?.interpretationMode && segment.language && gate.listenLanguage && segment.language !== gate.listenLanguage) return

    if (starting) {
        pendingSegments.push(segment)
        if (pendingSegments.length > PENDING_SEGMENT_CAP) pendingSegments.shift()
        return
    }

    feedSegment(segment)
}

/** The passage currently live on the output - keeps a recitation inside the chapter being read. */
export function setQuoteMatchAnchor(anchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number }): void {
    pendingAnchor = anchor
    matcher?.setAnchor(anchor)
}

/** A spoken explicit reference seeds the matcher, so the recitation that follows lands faster. */
export function noteExplicitDetection(ref: DetectedReference): void {
    if (ref.type !== "explicit") return
    matcher?.noteExplicitReference({ bookNumber: ref.bookNumber, chapter: ref.chapter, verseStart: ref.verseStart })
}

// INTERNAL

function feedSegment(segment: TranscriptSegment): void {
    if (!matcher || !onDetection) return
    let emissions: QuoteMatchEmission[]
    try {
        emissions = matcher.onSegment({ text: segment.text, startMs: segment.startMs, endMs: segment.endMs })
    } catch (err) {
        console.error("AI scripture quote matching error:", err)
        return
    }
    for (const emission of emissions) onDetection(toDetectedReference(emission))
}

function toDetectedReference(emission: QuoteMatchEmission): DetectedReference {
    return {
        id: "aiq-" + Date.now().toString(36) + "-" + (idCounter++).toString(36),
        book: bookNameFor(emission.translationId, emission.book),
        bookNumber: emission.book,
        chapter: emission.chapter,
        verseStart: emission.verseStart,
        verseEnd: emission.verseEnd,
        confidence: emission.confidence,
        type: "quoted",
        source: "local",
        quote: emission.quoteText,
        matchedBibleId: emission.translationId,
        continuation: emission.kind === "continuation" || undefined,
        corrects: emission.corrects ? { bookNumber: emission.corrects.book, chapter: emission.corrects.chapter, verseStart: emission.corrects.verseStart, verseEnd: emission.corrects.verseEnd } : undefined,
        timestamp: Date.now()
    }
}

function bookNameFor(bibleId: string, bookNumber: number): string {
    const books = get(scripturesCache)[bibleId]?.books || []
    return books.find((book) => book.number === bookNumber)?.name || String(bookNumber)
}

async function buildIndexes(bibleIds: string[]): Promise<TranslationIndex[]> {
    const indexes: TranslationIndex[] = []
    // one prefix pool per session: every translation's index shares the same key-id space,
    // so the strings exist once and a voting pass resolves each spoken key once for all indexes
    const pool = new PrefixPool()
    let budgetBytes = INDEX_MEMORY_BUDGET_BYTES

    for (const id of bibleIds) {
        if (budgetBytes <= 0 && indexes.length) break

        // API bibles have no local verse text; anything else was already loaded into the cache
        // by the session's book-table build (loadJsonBible fills scripturesCache)
        if (get(scriptures)[id]?.api) continue
        const bible = get(scripturesCache)[id]
        if (!bible?.books?.length) continue

        const verses: IndexableVerse[] = []
        for (const book of bible.books) {
            for (const chapter of book.chapters || []) {
                for (const verse of chapter.verses || []) {
                    verses.push({
                        book: book.number,
                        chapter: chapter.number,
                        verseStart: verse.number,
                        verseEnd: verse.endNumber ?? verse.number,
                        cleanText: stripMarkdown(stripText(verse.text || ""))
                    })
                }
            }
            // the build is CPU heavy - yield between books so the UI stays live
            await new Promise((resolve) => setTimeout(resolve))
        }

        if (!verses.length) continue
        const index = buildTranslationIndex(id, verses, pool)
        indexes.push(index)
        budgetBytes -= index.sizeBytes
    }

    return indexes
}
