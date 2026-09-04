// AI AUTO SCRIPTURE - quote matching: session lifecycle
// Owns quote matching for the duration of a listening session: packs the bibles already loaded
// for the session into worker payloads, mirrors the main process's segment gating (music /
// interpretation language), and turns matcher emissions into DetectedReference objects for the
// controller's normal detection funnel. The matcher itself runs in a MatcherHost - a Web Worker
// in production (index build and matching never touch the renderer thread), the same matcher
// in-thread when workers are unavailable.
//
// The detection callback is injected at start, so this module never imports the controller
// (no aiScripture <-> quoteMatchSession import cycle).

import { get } from "svelte/store"
import type { DetectedReference } from "../../../../types/ai/AiScripture"
import { aiQuoteMatchActive, scriptures, scripturesCache } from "../../../stores"
import { createDirectHost, createMatcherHost, type MatcherHost, type MatcherHostCallbacks } from "./quoteMatchHost"
import { buildTranslationPayload, type TranslationPayload } from "./quoteMatchPayload"
import type { QuoteMatchEmission } from "./quoteMatcher"

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

let host: MatcherHost | null = null
let starting = false
let gate: { interpretationMode: boolean; listenLanguage?: string } | null = null
let onDetection: ((ref: DetectedReference) => void) | null = null
let pendingSegments: TranscriptSegment[] = []
let pendingAnchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null = null
// bumped on every start/stop so a slow build that got superseded discards itself
let sessionToken = 0
let idCounter = 0
// the translations currently indexed (payloads actually shipped), so a mid-session change only
// touches the difference; updates run one at a time so concurrent diffs cannot double-add
let currentBibleIds: string[] = []
let updateChain: Promise<void> = Promise.resolve()

const PENDING_SEGMENT_CAP = 50

export function startQuoteMatching(config: QuoteMatchSessionConfig): void {
    stopQuoteMatching()
    const token = ++sessionToken

    starting = true
    gate = { interpretationMode: config.interpretationMode, listenLanguage: config.listenLanguage }
    onDetection = config.onDetection

    void startSession(token, config.bibleIds)
}

export function stopQuoteMatching(): void {
    sessionToken++
    starting = false
    aiQuoteMatchActive.set(false)
    host?.stop()
    host = null
    gate = null
    onDetection = null
    pendingSegments = []
    pendingAnchor = null
    currentBibleIds = []
}

/**
 * The session's bible set or priority changed mid-session: only the DIFFERENCE is applied -
 * added translations are indexed into the running matcher, removed ones are dropped. The
 * matcher, its transcript window, anchor and passage memory all stay live. Before the matcher
 * is ready (or when matching never started) the full start IS the update.
 */
export function updateQuoteMatchBibles(bibleIds: string[]): void {
    if (!host || starting) {
        if (gate && onDetection) startQuoteMatching({ bibleIds, interpretationMode: gate.interpretationMode, listenLanguage: gate.listenLanguage, onDetection })
        return
    }

    const token = sessionToken
    updateChain = updateChain.then(() => updateSession(token, bibleIds)).catch(() => undefined)
}

async function updateSession(token: number, bibleIds: string[]): Promise<void> {
    if (token !== sessionToken) return

    const removed = currentBibleIds.filter((id) => !bibleIds.includes(id))
    const addedIds = bibleIds.filter((id) => !currentBibleIds.includes(id))

    const addPayloads = addedIds.length ? await buildPayloads(addedIds) : []
    if (token !== sessionToken) return

    // bibleIds is also the desired PRIORITY order (main & favourite translations first) - a
    // pure re-prioritization changes nothing in the set but still must reorder the indexes
    const rank = new Map(bibleIds.map((id, position) => [id, position]))
    const nextIds = [...currentBibleIds.filter((id) => !removed.includes(id)), ...addPayloads.map((payload) => payload.translationId)].sort((a, b) => (rank.get(a) ?? bibleIds.length) - (rank.get(b) ?? bibleIds.length))
    if (!removed.length && !addPayloads.length && nextIds.join("|") === currentBibleIds.join("|")) return

    console.info(`[AiScripture] Session bibles changed - updating quote match indexes (+${addPayloads.length} / -${removed.length})`)
    currentBibleIds = nextIds
    host?.update(addPayloads, removed, nextIds)
}

export function handleQuoteMatchTranscript(segment: TranscriptSegment): void {
    if (!host && !starting) return

    // mirror the main process's detection gating: music lyrics are
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
    host?.setAnchor(anchor)
}

/** A spoken explicit reference seeds the matcher, so the recitation that follows lands faster. */
export function noteExplicitDetection(ref: DetectedReference): void {
    if (ref.type !== "explicit") return
    host?.noteExplicit({ bookNumber: ref.bookNumber, chapter: ref.chapter, verseStart: ref.verseStart })
}

// INTERNAL

async function startSession(token: number, bibleIds: string[]): Promise<void> {
    try {
        const payloads = await buildPayloads(bibleIds)
        if (token !== sessionToken) return // superseded by a newer start or a stop

        if (!payloads.length) {
            starting = false
            // no local verse text available (e.g. API bibles only) - say so, or this is invisible
            console.warn("[AiScripture] Quote matching inactive: none of the selected bibles have local verse text", bibleIds)
            return
        }

        const created = await createMatcherHost()
        if (token !== sessionToken) {
            created.stop()
            return
        }

        host = created
        currentBibleIds = payloads.map((payload) => payload.translationId)
        host.start(payloads, callbacksFor(token, payloads))
    } catch (err) {
        if (token !== sessionToken) return
        starting = false
        console.error("AI scripture quote matching failed to start:", err)
    }
}

function callbacksFor(token: number, fallbackPayloads: TranslationPayload[] | null): MatcherHostCallbacks {
    return {
        onReady: (info) => {
            if (token !== sessionToken) return
            starting = false
            console.info(`[AiScripture] Quote matching active: ${info.count} translation${info.count === 1 ? "" : "s"} indexed (${(info.totalBytes / 1024 / 1024).toFixed(1)} MB)`)
            aiQuoteMatchActive.set(true)
            if (pendingAnchor) host?.setAnchor(pendingAnchor)

            // segments that arrived while the indexes were building
            const buffered = pendingSegments
            pendingSegments = []
            for (const segment of buffered) feedSegment(segment)
        },
        onUpdated: (info) => {
            if (token !== sessionToken) return
            console.info(`[AiScripture] Quote match indexes updated: ${info.count} translation${info.count === 1 ? "" : "s"} indexed (+${info.added} / -${info.removed}, ${(info.totalBytes / 1024 / 1024).toFixed(1)} MB)`)
        },
        onEmissions: (emissions) => {
            if (token !== sessionToken || !onDetection) return
            for (const emission of emissions) onDetection(toDetectedReference(emission))
        },
        onError: (message) => {
            if (token !== sessionToken) return
            if (starting && fallbackPayloads) {
                // the worker died before it ever became ready - same session retries in-thread
                console.warn("[AiScripture] Quote match worker failed - matching on the main thread:", message)
                host?.stop()
                host = createDirectHost()
                host.start(fallbackPayloads, callbacksFor(token, null))
                return
            }
            if (starting) {
                starting = false
                console.error("AI scripture quote matching failed to start:", message)
                return
            }
            console.error("AI scripture quote matching error:", message)
        }
    }
}

function feedSegment(segment: TranscriptSegment): void {
    host?.segment({ text: segment.text, startMs: segment.startMs, endMs: segment.endMs })
}

/** Pack the session's bibles into their transfer shape (budget & stripping live at the build). */
async function buildPayloads(bibleIds: string[]): Promise<TranslationPayload[]> {
    const payloads: TranslationPayload[] = []
    for (const id of bibleIds) {
        // API bibles have no local verse text; anything else was already loaded into the cache
        // by the session's book-table build (loadJsonBible fills scripturesCache)
        if (get(scriptures)[id]?.api) continue
        const bible = get(scripturesCache)[id]
        if (!bible?.books?.length) continue

        const payload = buildTranslationPayload(id, bible)
        if (payload) payloads.push(payload)
        // packing is light, but a 41-bible library still deserves a breath between translations
        await new Promise((resolve) => setTimeout(resolve))
    }
    return payloads
}

function toDetectedReference(emission: QuoteMatchEmission): DetectedReference {
    const id = "aiq-" + Date.now().toString(36) + "-" + (idCounter++).toString(36)
    return {
        id: id,
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
        corrects: emission.corrects ? { id, bookNumber: emission.corrects.book, chapter: emission.corrects.chapter, verseStart: emission.corrects.verseStart, verseEnd: emission.corrects.verseEnd } : undefined,
        timestamp: Date.now()
    }
}

// canonical English names, 1-indexed by Protestant canon number - the fallback when the matched
// translation's book list is not cached. A bare "40" as the book NAME once sent a Matthew match
// through a fuzzy book search and projected Proverbs
export const CANON_BOOK_NAMES = [
    "",
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation"
]

export function bookNameFor(bibleId: string, bookNumber: number): string {
    const books = get(scripturesCache)[bibleId]?.books || []
    return books.find((book) => book.number === bookNumber)?.name || CANON_BOOK_NAMES[bookNumber] || String(bookNumber)
}
