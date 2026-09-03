// AI AUTO SCRIPTURE - PROJECTION
// putting a resolved passage on the output: translation targeting & clamping, the shared
// projectResolved choke point (detections AND voice commands), restore, drawer follow & the
// sermon anchor reported back to the electron process

import { get } from "svelte/store"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { Main } from "../../../types/IPC/Main"
import type { BibleInstance } from "../../components/drawer/bible/scripture"
import { loadJsonBible, playScripture } from "../../components/drawer/bible/scripture"
import { clone } from "../../components/helpers/array"
import { setDrawerTabData } from "../../components/helpers/historyHelpers"
import { getFirstActiveOutput, setOutput } from "../../components/helpers/output"
import { clearSlide } from "../../components/output/clear"
import { sendMain } from "../../IPC/main"
import { activeDrawerTab, activeScripture, aiScriptureHasProjected, drawerTabsData, openScripture, outLocked, scriptures, scripturesCache } from "../../stores"
import { setQuoteMatchAnchor } from "./quoteMatch/quoteMatchSession"
import { scriptureState } from "./scriptureState"
import { preferredTranslationId } from "./translationPreference"

// chapter/verse values can be strings, including split ids like "12_1" - parseInt reads the leading number
export function parseNumber(value: number | string | undefined): number {
    if (typeof value === "number") return value
    const parsed = parseInt(String(value ?? ""), 10)
    return Number.isFinite(parsed) ? parsed : 0
}

export async function projectDetection(detection: DetectedReference, manual?: boolean): Promise<boolean> {
    // arm the cooldown before any awaits so parallel detections can't project concurrently
    if (!manual) {
        scriptureState.lastAutoProjectionAt = Date.now()
        scriptureState.lastAutoProjectedRef = detection
    }

    const openedTranslation = preferredTranslationId()
    if (detection.matchedBibleId && detection.matchedBibleId !== openedTranslation) {
        // WIP request to change
        return false
    }

    const targetId = openedTranslation
    if (!targetId) return false
    scriptureState.lastAutoProjectedBibleId = targetId

    // collections load one version at a time - validate against the first one
    const parseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId

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

        // clamp chapter/verses to what actually exists in the target translation
        try {
            const Book = await bible.getBook(book)
            const chapterCount = Book.data.chapters?.length || 0
            if (chapterCount) chapter = Math.min(Math.max(1, chapter), chapterCount)
            // a clamp here means the target bible disagrees about the book's structure - the
            // projected label would no longer match the detected reference, so say it loudly
            if (chapter !== detection.chapter) console.warn(`[AiScripture] ${detection.book} ${detection.chapter} clamped to chapter ${chapter} in "${parseId}" (${chapterCount} chapters found) - the projected label will not match the detection`)

            const Chapter = await Book.getChapter(chapter)
            const chapterVerses = Chapter.data.verses || []
            const maxVerse = chapterVerses.length ? (chapterVerses[chapterVerses.length - 1]?.number ?? chapterVerses.length) : 0
            if (maxVerse) {
                verseStart = Math.min(Math.max(1, verseStart), maxVerse)
                verseEnd = Math.min(Math.max(verseStart, verseEnd), maxVerse)
            }
        } catch (err) {
            // API bibles fetch chapters on demand - a network failure should not block manual projections
            if (!manual) return false
        }
    } else if (!manual) {
        return false
    }

    // guard against misheard giant ranges ("verse 1 to 176") - the projected selection still
    // splits across slides through the normal scripture settings, this only caps the range
    const maxVerses = 10
    verseEnd = Math.min(verseEnd, verseStart + maxVerses - 1)

    // navigate the drawer's scripture view to the projected translation (star 1 or the match)
    if (targetId !== (get(drawerTabsData).scripture?.activeSubTab || "")) setDrawerTabData("scripture", targetId)

    const verses: number[] = []
    for (let v = verseStart; v <= verseEnd; v++) verses.push(v)

    // one line per projection makes "why did THIS fire" reports diagnosable after the fact
    console.info(`[AiScripture] Projecting ${detection.book} ${chapter}:${verseStart}${verseEnd > verseStart ? "-" + verseEnd : ""} in "${targetId}" [${detection.type}/${detection.confidence}${manual ? "/manual" : ""}${detection.matchedBibleId ? " matched:" + detection.matchedBibleId : ""}]`)
    await projectResolved(targetId, book, chapter, verses)

    // follow along in the drawer so the operator tracks the passage (if scripture drawer is active)
    showInDrawer(detection, false)

    return true
}

// shared by detection projections & voice command projections - the selfProjecting wrap
// keeps the manual-override output watcher from treating our own projection as an operator action
export async function projectResolved(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    // any fresh projection restarts the spoken "go back" walk (the walk itself re-bumps its depth)
    scriptureState.backDepth = 0
    // snapshot the current state so the operator can restore it
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

    // the projected passage becomes the sermon anchor, so bare "verse N" mentions resolve against it
    sendAnchorContext(targetId, book, chapter, verses)
}

// SESSION CONTEXT (anchor passage)
// tells the electron process what passage is live on the output right now

async function sendAnchorContext(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    if (!verses.length) return

    try {
        const parseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId
        const bible = await loadJsonBible(parseId)
        if (!bible) return

        const Book = await bible.getBook(book)
        const name = Book.data.name || String(book)
        // 66 book bibles use the standard Protestant canon numbering, so the local number doubles as the canon number
        const bookNumber = Number(Book.data.number ?? book)
        if (!name || !Number.isFinite(bookNumber) || bookNumber < 1) return

        const anchor = { book: name, bookNumber, chapter, verseStart: Math.min(...verses), verseEnd: Math.max(...verses) }
        sendMain(Main.AI_SCRIPTURE_CONTEXT, anchor)
        setQuoteMatchAnchor(anchor)
        scriptureState.lastQuoteMatchAnchor = anchor
    } catch (err) {
        // the anchor is best effort - a failed load just leaves the previous anchor in place
    }
}

export function resolveBookNumber(bible: BibleInstance, ref: DetectedReference): number {
    const books = bible.data.books || []

    // 66 book bibles use the standard Protestant canon numbering, and with no book list at all
    // the canon number is the only sensible read
    if (books.length === 66) return ref.bookNumber
    if (!books.length) return ref.bookNumber

    const nameLower = (ref.book || "").toLowerCase()
    const match = books.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
    if (match) return match.number

    // a fuzzy search is a last resort, and NEVER on a numeric "name" - searching "40 26" once
    // resolved a Matthew match to Proverbs and projected the wrong book entirely. The search is
    // by name alone (a chapter number only muddies it), and the result counts only when it
    // plausibly IS the asked-for book
    if (!nameLower || /^\d+$/.test(nameLower)) return 0
    const searched = bible.bookSearch(ref.book)
    const foundName = (searched?.book ? books.find((a) => a.number === searched.book)?.name || "" : "").toLowerCase()
    if (foundName && (foundName.startsWith(nameLower.slice(0, 4)) || nameLower.startsWith(foundName.slice(0, 4)))) return searched!.book

    console.warn(`[AiScripture] Could not resolve book "${ref.book}" in this bible - skipping the projection instead of guessing`)
    return 0
}

export function restorePrevious(): void {
    if (!scriptureState.previousState) return
    if (get(outLocked)) return

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
    const verses: number[] = []
    for (let v = detection.verseStart; v <= Math.max(detection.verseStart, detection.verseEnd); v++) verses.push(v)

    // map the canon book number to the drawer bible's own numbering
    let book: number = detection.bookNumber
    const drawerTabId = get(drawerTabsData).scripture?.activeSubTab || ""
    if (drawerTabId) {
        const parseId = get(scriptures)[drawerTabId]?.collection?.versions?.[0] || drawerTabId

        // 66 book bibles use the standard Protestant canon numbering - skip loading in that case
        const cachedBooks = get(scripturesCache)[parseId]?.books
        if (cachedBooks?.length !== 66) {
            try {
                const bible = await loadJsonBible(parseId)
                if (bible) book = resolveBookNumber(bible, detection) || detection.bookNumber
            } catch (err) {
                console.error("Error resolving AI scripture drawer book:", parseId, err)
            }
        }
    }

    openScripture.set({ book, chapter: detection.chapter, verses: [verses], play: false })
    // the automatic follow must never yank the operator away from another drawer tab -
    // only the explicit "show in drawer" button switches tabs
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
        if (!(chapter >= 1) || !verses.length) return

        sendAnchorContext(id, reference.book, chapter, verses)
    } catch (err) {
        // skip unparsable states - the previous anchor stays
    }
}
