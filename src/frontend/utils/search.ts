import { get } from "svelte/store"
import type { ShowList } from "../../types/Show"
import { sortObjectNumbers } from "../components/helpers/array"
import { similarity } from "../converters/txt"
import { categories, drawerTabsData, textCache } from "../stores"

const specialChars = /[.,\/#!?$%\^&\*;:{}=\-_'"´`~()]/g
export function formatSearch(value: string, removeSpaces = false) {
    if (typeof value !== "string") return ""
    let newValue = value
        .toLowerCase()
        .replace(specialChars, "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
    if (removeSpaces) newValue = newValue.replace(/\s+/g, "")

    return newValue
}

export function tokenize(str: string): string[] {
    return str.toLowerCase().split(/\s+/).filter(Boolean)
}

interface ParsedQuery {
    tokens: string[] // normalized words
    despaced: string // normalized, all whitespace removed
    fuzzyNeedle: string // despaced with short words removed (typo matching)
    fullPhrase: string // tokens joined with single spaces
    quoted: string | null // inner phrase of a "quoted" query
}

interface SearchContext {
    query: ParsedQuery
    cache: { [key: string]: string }
}

function parseQuery(searchValue: string): ParsedQuery {
    const trimmed = searchValue.trim()
    let quoted: string | null = null
    if (trimmed.length > 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) quoted = trimmed.slice(1, -1)

    const tokens = tokenize(formatSearch(searchValue, false))
    return {
        tokens,
        despaced: formatSearch(searchValue, true),
        fuzzyNeedle: formatSearch(removeShortWords(formatSearch(searchValue, false)), true),
        fullPhrase: tokens.join(" "),
        quoted
    }
}

function createSearchContext(searchValue: string): SearchContext {
    return {
        query: parseQuery(searchValue),
        cache: get(textCache)
    }
}

export function showSearch(searchValue: string, shows: ShowList[]): ShowList[] {
    const ctx = createSearchContext(searchValue)
    const categoriesData = get(categories)
    const activeSubTab = get(drawerTabsData).shows?.activeSubTab

    const newShows: ShowList[] = []
    shows.forEach((s) => {
        // don't search show if archived
        const isArchived = categoriesData[s.category || ""]?.isArchive
        if (isArchived && activeSubTab !== s.category) return

        const match = showSearchFilter(searchValue, s, ctx)
        if (match) newShows.push({ ...s, match })
    })

    return sortObjectNumbers(newShows, "match", true)
}

// Scoring model (absolute confidence, 0-100 — the value shown by the match bar):
//   100    exact song number / CCLI / title, or title starts-with
//   75-90  every word in the title (adjacent words score highest)
//   60-85  strong fuzzy title match (typo tolerance)
//   55-75  words split between title and content
//   40-60  every word in the content (lyrics) only
// A show only matches when EVERY search word matches at the start of a word in the
// title or content, so adding words always narrows the results ("here" never
// matches "There's"). A "quoted" query requires the exact phrase.
export function showSearchFilter(searchValue: string, show: ShowList, ctx?: SearchContext): number {
    if (!show.name) return 0
    if (!ctx) ctx = createSearchContext(searchValue)
    const q = ctx.query

    const songNumber: string = show.quickAccess?.number || ""
    const formattedSongNumber = formatSearch(songNumber, true)

    // a "quoted" query forces a strict, literal phrase match (no fuzzy / per-word scatter)
    if (q.quoted !== null) {
        const needle = tokenize(formatSearch(q.quoted, false)).join(" ")
        if (!needle) return 0

        const title = formatSearch(`${songNumber} ${show.name}`, false)
        if (findBoundaryPhrase(title, needle, true) !== -1) return 100

        const content = formatSearch(ctx.cache[show.id] || "", false)
        if (content && findBoundaryPhrase(content, needle, true) !== -1) return 70

        return 0
    }

    // Priority 0: song number exact match (supports alphanumeric like "MP133")
    if (songNumber && formattedSongNumber === q.despaced) return 100
    // Priority 0.5: CCLI exact match
    const songId = show.quickAccess?.metadata?.CCLI || ""
    if (songId && songId.toString() === searchValue.trim()) return 100

    const showName = formatSearch(show.name, true)
    const showNameWithNumber = formattedSongNumber + showName

    // Priority 1: title exact match
    if (q.despaced === showName || q.despaced === showNameWithNumber) return 100
    // Priority 1.5: title starts-with match (guard empty/punctuation-only queries so they don't match everything)
    if (q.despaced && showName.startsWith(q.despaced)) return 100

    if (!q.tokens.length) return 0

    const titleText = formatSearch(`${songNumber} ${show.name}`, false)
    const contentText = formatSearch(ctx.cache[show.id] || "", false)

    // strict AND: every word must appear (in title or content) at the start of a word
    let titleMatchedCount = 0
    let hasUnmatched = false
    for (let i = 0; i < q.tokens.length; i++) {
        if (hasWordPrefix(titleText, q.tokens[i])) titleMatchedCount++
        else if (!contentText || !hasWordPrefix(contentText, q.tokens[i])) {
            hasUnmatched = true
            break
        }
    }

    if (!hasUnmatched) return strictScore(q.tokens, titleMatchedCount, titleText, contentText, q.fullPhrase)

    // typo tolerance (titles only): a strong fuzzy title match can still qualify.
    // IMPORTANT: similarity() is non-zero even for unrelated text, so only a strong
    // near-match (>= 0.7) counts. editDistance >= length difference, so the exact
    // length prune below skips Levenshtein whenever similarity can't reach 0.7.
    if (q.fuzzyNeedle) {
        const maxLength = Math.max(showNameWithNumber.length, q.fuzzyNeedle.length)
        if (maxLength && Math.abs(showNameWithNumber.length - q.fuzzyNeedle.length) <= maxLength * 0.3) {
            const titleSimilarity = similarity(showNameWithNumber, q.fuzzyNeedle)
            if (titleSimilarity >= 0.7) return Math.round(60 + ((titleSimilarity - 0.7) / 0.3) * 25)
        }
    }

    return 0
}

// score a full strict match into the absolute confidence bands (40-90)
function strictScore(tokens: string[], titleMatchedCount: number, titleText: string, contentText: string, fullPhrase: string): number {
    const wordCount = tokens.length

    // every word in the title: 75-90 (adjacent words in order score highest)
    if (titleMatchedCount === wordCount) {
        const adjacency = wordCount > 1 ? titleAdjacency(tokenize(titleText), tokens) : 0
        return Math.round(75 + (wordCount > 1 ? adjacency * 15 : 5))
    }

    // words split between title and content: 55-75
    if (titleMatchedCount > 0) {
        return Math.round(55 + (titleMatchedCount / wordCount) * 15 + contentAdjacency(contentText, tokens) * 5)
    }

    // content (lyrics) only: 40-60, rewarding adjacency and repeated phrase hits
    const phraseBonus = Math.min(countBoundaryPhrase(contentText, fullPhrase) * 5, 10)
    return Math.round(40 + contentAdjacency(contentText, tokens) * 10 + phraseBonus)
}

// does any word in text start with `word`? (indexOf walk — no allocations)
function hasWordPrefix(text: string, word: string): boolean {
    let i = text.indexOf(word)
    while (i !== -1) {
        if (i === 0 || text.charCodeAt(i - 1) <= 32) return true
        i = text.indexOf(word, i + 1)
    }
    return false
}

// first index of `phrase` starting at a word boundary, or -1.
// exactEnd requires the phrase to also END at a word boundary (quoted queries);
// otherwise the last word may continue ("amazing gra" finds "amazing grace")
function findBoundaryPhrase(text: string, phrase: string, exactEnd: boolean): number {
    let i = text.indexOf(phrase)
    while (i !== -1) {
        const end = i + phrase.length
        if ((i === 0 || text.charCodeAt(i - 1) <= 32) && (!exactEnd || end === text.length || text.charCodeAt(end) <= 32)) return i
        i = text.indexOf(phrase, i + 1)
    }
    return -1
}

// count word-boundary occurrences of `phrase` (the last word may continue)
function countBoundaryPhrase(text: string, phrase: string): number {
    if (!text || !phrase) return 0
    let count = 0
    let i = text.indexOf(phrase)
    while (i !== -1) {
        if (i === 0 || text.charCodeAt(i - 1) <= 32) count++
        i = text.indexOf(phrase, i + phrase.length)
    }
    return count
}

// fraction (0-1) of consecutive query-word pairs appearing as consecutive title words in order (prefix-matched)
function titleAdjacency(titleTokens: string[], queryTokens: string[]): number {
    let adjacentPairs = 0
    for (let q = 0; q < queryTokens.length - 1; q++) {
        for (let t = 0; t < titleTokens.length - 1; t++) {
            if (titleTokens[t].startsWith(queryTokens[q]) && titleTokens[t + 1].startsWith(queryTokens[q + 1])) {
                adjacentPairs++
                break
            }
        }
    }
    return adjacentPairs / (queryTokens.length - 1)
}

// fraction (0-1) of consecutive query-word pairs found adjacent in the content text
function contentAdjacency(contentText: string, queryTokens: string[]): number {
    if (!contentText || queryTokens.length < 2) return 0
    let adjacentPairs = 0
    for (let q = 0; q < queryTokens.length - 1; q++) {
        if (findBoundaryPhrase(contentText, queryTokens[q] + " " + queryTokens[q + 1], false) !== -1) adjacentPairs++
    }
    return adjacentPairs / (queryTokens.length - 1)
}

function removeShortWords(value: string) {
    return value
        .split(" ")
        .filter((a) => a.length > 2)
        .join(" ")
}
