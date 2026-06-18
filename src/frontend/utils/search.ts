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

// check if all old tokens are still in new tokens
export function isRefinement(newTokens: string[], oldTokens: string[]): boolean {
    return oldTokens.length ? oldTokens.every((token) => newTokens.includes(token)) : false
}

export function showSearch(searchValue: string, shows: ShowList[]): ShowList[] {
    let newShows: ShowList[] = []

    shows.forEach((s) => {
        // don't search show if archived
        const isArchived = get(categories)[s.category || ""]?.isArchive
        if (isArchived && get(drawerTabsData).shows?.activeSubTab !== s.category) return

        const match = showSearchFilter(searchValue, s)
        if (match) newShows.push({ ...s, match })
    })
    newShows = sortObjectNumbers(newShows, "match", true)

    // change all values relative to the highest value
    const highestValue = newShows[0]?.match || 0
    newShows = newShows.map((a) => ({ ...a, originalMatch: a.match, match: highestValue ? ((a.match || 0) / highestValue) * 100 : 0 }))

    return newShows
}

// Scoring model (max ~130, clamped to 99 for non-exact):
//   - exact song number / CCLI / title, or title starts-with -> 100
//   - title word coverage      -> up to 65  (a title hit always beats a content-only hit)
//   - content word coverage    -> up to 35  (multi-word: more matched words ranks higher)
//   - fuzzy title similarity   -> up to 20  (typo tolerance)
//   - content density bonus    -> up to 10  (tiebreaker for repeated/contiguous hits)
export function showSearchFilter(searchValue: string, show: ShowList) {
    if (!show.name) return 0

    // a "quoted" query forces a strict, literal phrase match (no fuzzy / per-word scatter)
    const trimmedQuery = searchValue.trim()
    if (trimmedQuery.length > 2 && trimmedQuery.startsWith('"') && trimmedQuery.endsWith('"')) {
        return exactPhraseScore(trimmedQuery.slice(1, -1), show)
    }

    const songNumber: string = show.quickAccess?.number || ""
    const formattedSongNumber = formatSearch(songNumber, true)
    const formattedSearchValue = formatSearch(searchValue, true)

    // Priority 0: song number exact match (supports alphanumeric like "MP133")
    if (songNumber && formattedSongNumber === formattedSearchValue) return 100
    // Priority 0.5: CCLI exact match
    const songId = show.quickAccess?.metadata?.CCLI || ""
    if (songId && songId.toString() === searchValue.trim()) return 100

    const showName = formatSearch(show.name, true)
    const showNameWithNumber = formattedSongNumber + showName

    // Priority 1: title exact match
    if (formattedSearchValue === showName || formattedSearchValue === showNameWithNumber) return 100
    // Priority 1.5: title starts-with match (guard empty/punctuation-only queries so they don't match everything)
    if (formattedSearchValue && showName.startsWith(formattedSearchValue)) return 100

    // accent/case/punctuation-insensitive query words
    const queryWords = tokenize(formatSearch(searchValue, false))
    if (!queryWords.length) return 0
    // for content, ignore very short words (the/of/a) unless that's all the query has
    const longWords = queryWords.filter((w) => w.length >= 3)
    const wordsForContent = longWords.length ? longWords : queryWords

    const titleText = formatSearch(`${songNumber} ${show.name}`, false)
    const contentText = formatSearch(get(textCache)[show.id] || "", false)

    // Word coverage = fraction of query words present. Title is weighted well above
    // content, so a title hit outranks a content-only hit and multi-word queries
    // rank shows that contain MORE of the words higher.
    const titleCoverageScore = wordCoverage(titleText, queryWords) * 65
    const contentCoverageScore = wordCoverage(contentText, wordsForContent) * 35

    // Small tiebreaker: reward repeated/contiguous occurrences of the query in content
    const contentDensityScore = contentDensity(contentText, formattedSearchValue)

    // Fuzzy title similarity (0-1). IMPORTANT: similarity() is non-zero even for unrelated
    // text, so it must never make a show match on its own — only a strong near-match (typo)
    // qualifies; otherwise it just refines ranking among shows that already matched.
    const trimmedSearch = formatSearch(removeShortWords(formatSearch(searchValue, false)), true)
    const titleSimilarity = trimmedSearch ? similarity(showNameWithNumber, trimmedSearch) : 0

    // Require a real match: an actual word/phrase hit, or a strong fuzzy title match.
    if (!(titleCoverageScore || contentCoverageScore || contentDensityScore || titleSimilarity >= 0.7)) return 0

    const combinedScore = titleCoverageScore + contentCoverageScore + titleSimilarity * 20 + contentDensityScore
    return combinedScore >= 100 ? 99 : combinedScore
}

// strict literal-phrase match for quoted queries: the phrase must appear contiguously (normalized), no fuzzy
function exactPhraseScore(phrase: string, show: ShowList): number {
    const needle = formatSearch(phrase, false)
    if (!needle) return 0

    const songNumber = show.quickAccess?.number || ""
    const title = formatSearch(`${songNumber} ${show.name}`, false)
    if (title.includes(needle)) return 100

    const content = formatSearch(get(textCache)[show.id] || "", false)
    if (content.includes(needle)) return 60

    return 0
}

// fraction (0-1) of words present in text
function wordCoverage(text: string, words: string[]): number {
    if (!words.length || !text) return 0
    const matched = words.filter((word) => text.includes(word)).length
    return matched / words.length
}

// reward repeated/contiguous occurrences of the de-spaced query; capped small (max 10)
function contentDensity(contentText: string, despacedQuery: string): number {
    if (!contentText || despacedQuery.length < 2) return 0

    const haystack = contentText.replace(/\s+/g, "")
    let count = 0
    let i = haystack.indexOf(despacedQuery)
    while (i !== -1) {
        count++
        i = haystack.indexOf(despacedQuery, i + despacedQuery.length)
    }

    return Math.min(count * 3, 10)
}

function removeShortWords(value: string) {
    return value
        .split(" ")
        .filter((a) => a.length > 2)
        .join(" ")
}
