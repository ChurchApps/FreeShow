import { get } from "svelte/store"
import type { AiScriptureBook } from "../../../types/ai/AiScripture"
import { loadJsonBible } from "../../components/drawer/bible/scripture"
import { drawerTabsData, scriptures, scripturesCache } from "../../stores"
import { setQuoteMatchAnchor, updateQuoteMatchBibles } from "./quoteMatch/quoteMatcherEngine"
import { scriptureState } from "./scriptureState"
import { updateScriptureCoordinatorBooks } from "./session"

function expandBibleIds(ids: string[]): string[] {
    const expanded: string[] = []
    ids.forEach((id) => {
        const versions = get(scriptures)[id]?.collection?.versions
        const list = versions?.length ? versions : [id]
        list.forEach((v) => {
            if (v && !expanded.includes(v)) expanded.push(v)
        })
    })
    return expanded
}

/** All installed local translations in priority order: main first, then the rest by name. */
export function sessionBibleIds(): string[] {
    const openedTranslation = get(drawerTabsData).scripture?.activeSubTab || ""
    const lead = expandBibleIds([openedTranslation].filter(Boolean))
    const leadSet = new Set(lead)

    const rest = Object.entries(get(scriptures))
        .filter(([id, bible]) => !!bible && !bible.api && !bible.collection && !leadSet.has(id))
        .sort(([, a], [, b]) => (a.customName || a.name || "").localeCompare(b.customName || b.name || ""))
        .map(([id]) => id)

    return [...lead, ...rest]
}

export function bookTableIds(): string[] {
    const api = Object.entries(get(scriptures))
        .filter(([, bible]) => !!bible?.api)
        .map(([id]) => id)
    return Array.from(new Set([...scriptureState.searchBibleIds, ...api]))
}

// SESSION BIBLES LIVE REFRESH
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
    const books = await buildBookTable(bookTableIds())

    if (!scriptureState.sessionActive || token !== sessionBiblesRefreshToken) return
    updateScriptureCoordinatorBooks(books)

    updateQuoteMatchBibles(scriptureState.searchBibleIds)
    if (scriptureState.lastQuoteMatchAnchor) setQuoteMatchAnchor(scriptureState.lastQuoteMatchAnchor)
}

// BOOK TABLE
export async function buildBookTable(bibleIds: string[]): Promise<AiScriptureBook[]> {
    // Collect all (name, number) pairs and track which are canonical
    const nameEntries = new Map<string, { number: number; isCanon: boolean }[]>()
    const canonNumbers = new Set<number>()
    const namesByNumber = new Map<number, string[]>()

    const addName = (number: number, name: string | undefined, isCanon: boolean) => {
        const trimmed = name?.trim()
        if (!number || !trimmed) return

        const nameLower = trimmed.toLowerCase()
        const entries = nameEntries.get(nameLower) || []
        if (!entries.some((e) => e.number === number)) {
            entries.push({ number, isCanon })
            nameEntries.set(nameLower, entries)
        }

        const list = namesByNumber.get(number) || []
        if (!list.some((e) => e.toLowerCase() === nameLower)) {
            list.push(trimmed)
            namesByNumber.set(number, list)
        }
    }

    const processBookList = (books: any[], isCanon: boolean) => {
        books.forEach((book) => {
            addName(book.number, book.name, isCanon)
            addName(book.number, book.customName, isCanon)
            addName(book.number, book.abbreviation, isCanon)
            addName(book.number, book.id, isCanon)
            if (isCanon) canonNumbers.add(book.number)
        })
    }

    for (const id of bibleIds) {
        try {
            const bible = await loadJsonBible(id)
            const books = bible?.data.books || []
            processBookList(books, books.length === 66)
        } catch (err) {
            console.error("Error loading Bible for AI scripture book table:", id, err)
        }

        const cachedBooks = get(scripturesCache)[id]?.books || []
        processBookList(cachedBooks, cachedBooks.length === 66)
    }

    // For names that appear with multiple numbers, keep only the canonical one
    nameEntries.forEach((entries, nameLower) => {
        if (entries.length > 1) {
            // Multiple numbers for same name - prefer canonical
            const canonical = entries.find((e) => e.isCanon)
            const preferred = canonical || entries.sort((a, b) => a.number - b.number)[0]

            // Remove names from non-preferred numbers
            entries.forEach((entry) => {
                if (entry.number !== preferred.number) {
                    const list = namesByNumber.get(entry.number)
                    if (list) {
                        const idx = list.findIndex((n) => n.toLowerCase() === nameLower)
                        if (idx >= 0) list.splice(idx, 1)
                        if (list.length === 0) namesByNumber.delete(entry.number)
                    }
                }
            })
        }
    })

    const result = Array.from(namesByNumber.entries())
        .sort(([a], [b]) => a - b)
        .map(([number, names]) => ({ number, names, canonNumber: canonNumbers.has(number) ? number : undefined }))

    return result
}
