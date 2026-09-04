// AI AUTO SCRIPTURE - SESSION BIBLES
// every installed local translation is searched - no list to configure. The favourited
// translations are the priority pool: they take the leading index slots and head the spoken
// cycle order. One of them (or any bible) can be picked as the MAIN translation - the
// projection/grounding target. With nothing picked, the first favourite leads; only with no
// favourites at all does the drawer's open translation fill that role, so an accidental drawer
// tab can never outrank a deliberate choice.

import { get } from "svelte/store"
import type { AiScriptureBook } from "../../../types/ai/AiScripture"
import { loadJsonBible } from "../../components/drawer/bible/scripture"
import { scriptures, scripturesCache } from "../../stores"
import { scriptureState } from "./scriptureState"
import { updateScriptureCoordinatorBooks } from "./session"
import { preferredTranslationId } from "./translationPreference"
import { setQuoteMatchAnchor, updateQuoteMatchBibles } from "./quoteMatch/quoteMatcherEngine"

function expandBibleIds(ids: string[]): string[] {
    const seen = new Set<string>()
    const expanded: string[] = []
    ids.forEach((id) => {
        const versions = get(scriptures)[id]?.collection?.versions
        const list = versions?.length ? versions : [id]
        list.forEach((a) => {
            if (!a || seen.has(a)) return
            seen.add(a)
            expanded.push(a)
        })
    })
    return expanded
}

/** All installed local translations in priority order: main first, then the rest by name. */
export function sessionBibleIds(): string[] {
    const lead = expandBibleIds([preferredTranslationId()].filter(Boolean))
    const leadSet = new Set(lead)
    const rest = Object.entries(get(scriptures))
        .filter(([id, bible]) => !!bible && !bible.api && !bible.collection && !leadSet.has(id))
        .sort(([, a], [, b]) => (a.customName || a.name || "").localeCompare(b.customName || b.name || ""))
        .map(([id]) => id)
    return [...lead, ...rest]
}

/**
 * Ids whose book names feed tier-1 reference detection: the searched locals plus every API
 * bible - API bibles cannot be quote-matched (no local verse text to index) but their book
 * names must still be recognized when spoken, and they project on demand.
 */
export function bookTableIds(): string[] {
    const api = Object.entries(get(scriptures))
        .filter(([, bible]) => !!bible?.api)
        .map(([id]) => id)
    return [...new Set([...scriptureState.searchBibleIds, ...api])]
}

// SESSION BIBLES LIVE REFRESH

// several changes usually land in a row (starring, imports) - one refresh after they settle
const SESSION_BIBLES_REFRESH_DELAY = 1200

let sessionBiblesRefreshTimer: NodeJS.Timeout | null = null
let sessionBiblesRefreshToken = 0

export function scheduleSessionBiblesRefresh(): void {
    if (sessionBiblesRefreshTimer) clearTimeout(sessionBiblesRefreshTimer)
    sessionBiblesRefreshTimer = setTimeout(() => {
        sessionBiblesRefreshTimer = null
        void refreshSessionBibles()
    }, SESSION_BIBLES_REFRESH_DELAY)
}

export function cancelSessionBiblesRefresh(): void {
    if (!sessionBiblesRefreshTimer) return
    clearTimeout(sessionBiblesRefreshTimer)
    sessionBiblesRefreshTimer = null
}

async function refreshSessionBibles(): Promise<void> {
    if (!scriptureState.sessionActive) return
    const token = ++sessionBiblesRefreshToken

    scriptureState.searchBibleIds = sessionBibleIds()

    // the frontend tier-1 tables (spoken book names, translation cues) follow the same set - the
    // book table build also loads any newly installed bibles into the cache, which the quote
    // match index build reads verse text from
    const books = await buildBookTable(bookTableIds())
    // a slow load can outlive the session or a newer change - only the latest refresh may apply
    if (!scriptureState.sessionActive || token !== sessionBiblesRefreshToken) return
    updateScriptureCoordinatorBooks(books)

    updateQuoteMatchBibles(scriptureState.searchBibleIds)
    // only the full-start fallback (matcher not ready yet) loses the anchor - re-seed it
    if (scriptureState.lastQuoteMatchAnchor) setQuoteMatchAnchor(scriptureState.lastQuoteMatchAnchor)
}

// BOOK TABLE

export async function buildBookTable(bibleIds: string[]): Promise<AiScriptureBook[]> {
    const namesByNumber: Map<number, string[]> = new Map()
    const canonNumbers: Set<number> = new Set() // book numbers matching the 66 book Protestant canon
    const addName = (number: number, name: string | undefined) => {
        if (!number) return
        const list = namesByNumber.get(number) || []
        const trimmed = (name || "").trim()
        if (!trimmed) return
        if (!list.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) list.push(trimmed)
        namesByNumber.set(number, list)
    }

    for (const id of bibleIds) {
        try {
            const bible = await loadJsonBible(id)
            const books = bible?.data.books || []
            const isCanon = books.length === 66
            books.forEach((book) => {
                addName(book.number, book.name)
                addName(book.number, book.abbreviation)
                addName(book.number, book.id)
                if (isCanon) canonNumbers.add(book.number)
            })
        } catch (err) {
            console.error("Error loading Bible for AI scripture book table:", id, err)
        }

        const cachedBooks = get(scripturesCache)[id]?.books || []
        const cachedIsCanon = cachedBooks.length === 66
        cachedBooks.forEach((book) => {
            addName(book.number, book.name)
            addName(book.number, (book as any).customName) // many XML book names are not correct
            addName(book.number, book.abbreviation)
            if (cachedIsCanon) canonNumbers.add(book.number)
        })
    }

    return Array.from(namesByNumber.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([number, names]) => ({ number, names, canonNumber: canonNumbers.has(number) ? number : undefined }))
}
