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
//   80-94  every word in the title (adjacent words score highest)
//   65-85  strong fuzzy title match (typo tolerance)
//   55-78  words split between title and content
//   35-60  every word in the content (lyrics) only (exponential decay for repeated hits)
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

    if (!hasUnmatched) return strictScore(q, titleMatchedCount, titleText, showName, contentText)

    // typo tolerance (titles only): a strong fuzzy title match can still qualify.
    if (q.fuzzyNeedle) {
        return matchTitleTypo(titleText, showNameWithNumber, q.tokens, q.fuzzyNeedle)
    }

    return 0
}

function matchTitleTypo(titleText: string, showNameWithNumber: string, queryTokens: string[], fuzzyNeedle: string): number {
    // 1. Full despaced title similarity (e.g. 'amzinggrace' for 'Amazing Grace')
    const maxLen = Math.max(showNameWithNumber.length, fuzzyNeedle.length)
    if (maxLen && Math.abs(showNameWithNumber.length - fuzzyNeedle.length) <= maxLen * 0.3) {
        const titleSim = similarity(showNameWithNumber, fuzzyNeedle)
        if (titleSim >= 0.7) return Math.round(65 + ((titleSim - 0.7) / 0.3) * 20)
    }

    // 2. Word-by-word token similarity (e.g. 'amzing grac' for 'Amazing Grace How Sweet')
    const titleTokens = tokenize(titleText)
    if (titleTokens.length >= queryTokens.length && queryTokens.length > 0) {
        const used = new Set<number>()
        let totalSim = 0

        for (const q of queryTokens) {
            let bestIdx = -1
            let bestSim = 0

            for (let j = 0; j < titleTokens.length; j++) {
                if (used.has(j)) continue
                const t = titleTokens[j]

                if (t.startsWith(q)) {
                    bestIdx = j
                    bestSim = 1
                    break
                }

                if (q.length <= 4 && Math.abs(t.length - q.length) > 1) continue

                const sim = similarity(t, q)
                if (sim >= 0.65 && sim > bestSim) {
                    bestSim = sim
                    bestIdx = j
                }
            }

            if (bestIdx === -1 || bestSim < 0.65) return 0
            used.add(bestIdx)
            totalSim += bestSim
        }

        const avgSim = totalSim / queryTokens.length
        return Math.round(65 + ((avgSim - 0.65) / 0.35) * 20)
    }

    return 0
}

// exponential decay function for repeated matches: MaxBonus * (1 - factor^count)
function decayBonus(count: number, maxBonus: number, factor = 0.5): number {
    if (count <= 0) return 0
    return maxBonus * (1 - Math.pow(factor, count))
}

// score a full strict match into the absolute confidence bands (35-94)
function strictScore(q: ParsedQuery, titleMatchedCount: number, titleText: string, showName: string, contentText: string): number {
    const tokens = q.tokens
    const wordCount = tokens.length

    // every word in the title: 75-94 (starts-with, exact-word vs prefix, adjacency, coverage)
    if (titleMatchedCount === wordCount) {
        const titleTokens = tokenize(titleText)
        const startsWithTitle = (titleTokens.length > 0 && titleTokens[0].startsWith(tokens[0])) || showName.startsWith(q.despaced)
        const adjacency = wordCount > 1 ? titleAdjacency(titleTokens, tokens) : 0

        let exactWordMatches = 0
        for (let i = 0; i < wordCount; i++) {
            if (titleTokens.includes(tokens[i])) exactWordMatches++
        }
        const exactWordRatio = exactWordMatches / wordCount
        const lengthCoverage = Math.min(1, q.despaced.length / Math.max(1, showName.length))

        const startBonus = startsWithTitle ? 6 : 0
        const wordBonus = exactWordRatio * 6
        const adjBonus = wordCount > 1 ? adjacency * 5 : 2
        const coverageBonus = lengthCoverage * 5

        return Math.round(75 + startBonus + wordBonus + adjBonus + coverageBonus)
    }

    // words split between title and content: 55-78
    if (titleMatchedCount > 0) {
        const phraseHits = countBoundaryPhrase(contentText, q.fullPhrase)
        const phraseBonus = decayBonus(phraseHits, 3)
        return Math.round(55 + (titleMatchedCount / wordCount) * 15 + contentAdjacency(contentText, tokens) * 5 + phraseBonus)
    }

    // content (lyrics) only: 35-60, rewarding adjacency and repeated phrase/word hits with exponential decay
    const phraseHits = countBoundaryPhrase(contentText, q.fullPhrase)
    const phraseBonus = decayBonus(phraseHits, 8)

    let totalWordHits = 0
    for (let i = 0; i < wordCount; i++) {
        totalWordHits += countBoundaryPhrase(contentText, tokens[i])
    }
    const avgWordHits = totalWordHits / wordCount
    const wordBonus = decayBonus(avgWordHits, 7)

    return Math.round(35 + contentAdjacency(contentText, tokens) * 10 + phraseBonus + wordBonus)
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
