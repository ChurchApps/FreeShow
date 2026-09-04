import { get } from "svelte/store"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import type { BibleInstance } from "../../components/drawer/bible/scripture"
import { loadJsonBible, playScripture } from "../../components/drawer/bible/scripture"
import { clone } from "../../components/helpers/array"
import { setDrawerTabData } from "../../components/helpers/historyHelpers"
import { getFirstActiveOutput, setOutput } from "../../components/helpers/output"
import { clearSlide } from "../../components/output/clear"
import { activeDrawerTab, activeScripture, aiScriptureHasProjected, drawerTabsData, openScripture, outLocked, scriptures, scripturesCache } from "../../stores"
import { setQuoteMatchAnchor } from "./quoteMatch/quoteMatcherEngine"
import { scriptureState } from "./scriptureState"
import { updateScriptureCoordinatorContext } from "./session"

function resolvePrimaryBibleId(id: string): string {
    return get(scriptures)[id]?.collection?.versions?.[0] || id
}

function parseNumber(value: number | string | undefined): number {
    if (typeof value === "number") return value
    const parsed = parseInt(String(value ?? ""), 10)
    return Number.isFinite(parsed) ? parsed : 0
}

export async function projectDetection(detection: DetectedReference, manual?: boolean): Promise<boolean> {
    if (!manual) {
        scriptureState.lastAutoProjectionAt = Date.now()
        scriptureState.lastAutoProjectedRef = detection
    }

    const openedTranslation = get(drawerTabsData).scripture?.activeSubTab || ""
    if (detection.matchedBibleId && detection.matchedBibleId !== openedTranslation) return false

    const targetId = openedTranslation
    if (!targetId) return false
    scriptureState.lastAutoProjectedBibleId = targetId

    const parseId = resolvePrimaryBibleId(targetId)

    let book: number | string = detection.bookNumber
    let chapter = detection.chapter
    let verseStart = detection.verseStart
    let verseEnd = Math.max(detection.verseStart, detection.verseEnd)

    let bible: BibleInstance | null = null
    try {
        bible = await loadJsonBible(parseId)
    } catch (err) {
        console.error("Error loading Bible for AI scripture projection:", parseId, err)
    }

    if (bible) {
        const resolvedBook = resolveBookNumber(bible, detection)
        if (!resolvedBook) return false
        book = resolvedBook

        try {
            const Book = await bible.getBook(book)
            const chapterCount = Book.data.chapters?.length || 0
            if (chapterCount) chapter = Math.min(Math.max(1, chapter), chapterCount)
            if (chapter !== detection.chapter) {
                console.warn(`[AiScripture] ${detection.book} ${detection.chapter} clamped to chapter ${chapter} in "${parseId}"`)
            }

            const Chapter = await Book.getChapter(chapter)
            const chapterVerses = Chapter.data.verses || []
            const maxVerse = chapterVerses.length ? (chapterVerses[chapterVerses.length - 1]?.number ?? chapterVerses.length) : 0
            if (maxVerse) {
                verseStart = Math.min(Math.max(1, verseStart), maxVerse)
                verseEnd = Math.min(Math.max(verseStart, verseEnd), maxVerse)
            }
        } catch (err) {
            if (!manual) return false
        }
    } else if (!manual) {
        return false
    }

    const maxVerses = 10
    verseEnd = Math.min(verseEnd, verseStart + maxVerses - 1)

    if (targetId !== openedTranslation) setDrawerTabData("scripture", targetId)

    const verses = Array.from({ length: verseEnd - verseStart + 1 }, (_, i) => verseStart + i)

    console.info(`[AiScripture] Projecting ${detection.book} ${chapter}:${verseStart}${verseEnd > verseStart ? "-" + verseEnd : ""} in "${targetId}"`)
    await projectResolved(targetId, book, chapter, verses)
    showInDrawer(detection, false)

    return true
}

export async function projectResolved(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    scriptureState.backDepth = 0
    scriptureState.previousState = {
        activeScripture: clone(get(activeScripture)),
        outSlide: clone(getFirstActiveOutput()?.out?.slide || null)
    }

    scriptureState.selfProjecting = true
    try {
        activeScripture.set({ id: targetId, reference: { book, chapters: [chapter], verses: [verses] } })
        await playScripture()
    } finally {
        scriptureState.selfProjecting = false
    }

    aiScriptureHasProjected.set(true)
    sendAnchorContext(targetId, book, chapter, verses)
}

async function sendAnchorContext(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    if (!verses.length) return
    try {
        const parseId = resolvePrimaryBibleId(targetId)
        const bible = await loadJsonBible(parseId)
        if (!bible) return

        const Book = await bible.getBook(book)
        const name = Book.data.name || String(book)
        const bookNumber = Number(Book.data.number ?? book)
        if (!name || !Number.isFinite(bookNumber) || bookNumber < 1) return

        const anchor = { book: name, bookNumber, chapter, verseStart: Math.min(...verses), verseEnd: Math.max(...verses) }
        updateScriptureCoordinatorContext(anchor)
        setQuoteMatchAnchor(anchor)
        scriptureState.lastQuoteMatchAnchor = anchor
    } catch (err) {
        // Context anchor is best effort
    }
}

export function resolveBookNumber(bible: BibleInstance, ref: DetectedReference): number {
    const books = bible.data.books || []
    if (books.length === 0 || books.length === 66) return ref.bookNumber

    const nameLower = (ref.book || "").toLowerCase()
    const match = books.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
    if (match) return match.number

    if (!nameLower || /^\d+$/.test(nameLower)) return 0
    const searched = bible.bookSearch(ref.book)
    const foundName = (searched?.book ? books.find((a) => a.number === searched.book)?.name || "" : "").toLowerCase()

    if (foundName && (foundName.startsWith(nameLower.slice(0, 4)) || nameLower.startsWith(foundName.slice(0, 4)))) {
        return searched!.book
    }

    console.warn(`[AiScripture] Could not resolve book "${ref.book}" in bible`)
    return 0
}

export function restorePrevious(): void {
    if (!scriptureState.previousState || get(outLocked)) return

    const previous = scriptureState.previousState
    scriptureState.previousState = null

    scriptureState.selfProjecting = true
    try {
        activeScripture.set(previous.activeScripture)
        if (previous.outSlide) setOutput("slide", previous.outSlide)
        else clearSlide()
    } finally {
        scriptureState.selfProjecting = false
    }

    aiScriptureHasProjected.set(false)
}

export async function showInDrawer(detection: DetectedReference, focusTab = true): Promise<void> {
    const verses = Array.from({ length: Math.max(detection.verseStart, detection.verseEnd) - detection.verseStart + 1 }, (_, i) => detection.verseStart + i)
    let book: number = detection.bookNumber

    const drawerTabId = get(drawerTabsData).scripture?.activeSubTab || ""
    if (drawerTabId) {
        const parseId = resolvePrimaryBibleId(drawerTabId)
        if (get(scripturesCache)[parseId]?.books?.length !== 66) {
            try {
                const bible = await loadJsonBible(parseId)
                if (bible) book = resolveBookNumber(bible, detection) || detection.bookNumber
            } catch (err) {
                console.error("Error resolving AI scripture drawer book:", parseId, err)
            }
        }
    }

    openScripture.set({ book, chapter: detection.chapter, verses: [verses], play: false })
    if (focusTab) activeDrawerTab.set("scripture")
}

export function updateAnchorFromActiveScripture(): void {
    try {
        const current = get(activeScripture)
        const id = current.id || get(drawerTabsData).scripture?.activeSubTab || ""
        const reference = current.reference
        if (!id || !reference) return

        const chapter = parseNumber(reference.chapters[0])
        const verses = (reference.verses[0] || []).map(parseNumber).filter((a) => a >= 1)
        if (chapter >= 1 && verses.length) {
            sendAnchorContext(id, reference.book, chapter, verses)
        }
    } catch (err) {
        // Skip unparsable state
    }
}
