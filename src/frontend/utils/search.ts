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

export function showSearch(searchValue: string, shows: ShowList[]) {
    let newShows: ShowList[] = []

    // fix invalid regular expression
    searchValue = searchValue.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1")

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
    newShows = newShows.map((a) => ({ ...a, originalMatch: a.match, match: ((a.match || 0) / highestValue) * 100 }))

    return newShows
}

export function showSearchFilter(searchValue: string, show: ShowList) {
    if (!show.name) return 0

    // WIP tag search?

    // Priority 0: Number Exact Match
    const songNumber: string = show.quickAccess?.number || ""
    if (songNumber && Number(songNumber) === Number(searchValue)) return 100
    // Priority 0.5: CCLI Exact Match
    const songId = show.quickAccess?.metadata?.CCLI || ""
    if (songId.toString() === searchValue) return 100

    const showName = formatSearch(show.name, true)
    const showNameWithNumber = songNumber + showName

    // Priority 1: Title Exact Match
    const formattedSearchValue = formatSearch(searchValue, true)
    if (formattedSearchValue === showName || formattedSearchValue === showNameWithNumber) return 100

    // Priority 1.5: Title Word Start Match
    if (showName.startsWith(formattedSearchValue)) return 100

    const cache = get(textCache)[show.id] || ""

    // Priority 2: Content Includes Percentage Match
    const contentIncludesMatchScore = calculateContentIncludesScore(cache, searchValue) // + calculateContentIncludesScore(cache, searchValue, true)

    // Priority 3: Title Word-for-Word Match
    const titleWordMatch = matchWords(showNameWithNumber, searchValue)
    const titleIncludesMatchScore = titleWordMatch * 0.5 * 100 // max 50%

    // Priority 4: Title Letter-for-Letter Match
    const titleSimilarity = similarity(showNameWithNumber, removeShortWords(formatSearch(searchValue, true)))
    const titleSimilarityMatchScore = titleSimilarity * 0.3 * 100 // max 30%

    // Priority 5: Content Word-for-Word Match
    let contentWordMatchScore = 0
    if (cache) {
        const formattedCache = formatSearch(cache, true)
        const wordMatchCount = matchWords(formattedCache, searchValue)
        const wordMatchCountExtra = matchWords(formattedCache, removeShortWords(searchValue))
        contentWordMatchScore = Math.min(wordMatchCount, 100) * 0.03 + Math.min(wordMatchCountExtra, 100) * 0.07 // max 10%
    }

    // Priority 6: Content Letter-for-Letter Match
    // let contentSimilarityMatchScore = 0
    // if (cache) {
    //     const contentSimilarity = similarity(removeShortWords(formatSearch(cache, true)), removeShortWords(formatSearch(searchValue, true)))
    //     contentSimilarityMatchScore = contentSimilarity * 0.05 * 100 // max 5%
    // }

    const combinedScore = contentIncludesMatchScore + titleIncludesMatchScore + titleSimilarityMatchScore + contentWordMatchScore
    return combinedScore >= 100 ? 99 : combinedScore < 3 ? 0 : combinedScore
}

function calculateContentIncludesScore(cache: string, search: string, noShortWords = false): number {
    if (!cache) return 0

    // remove short words
    cache = formatSearch(noShortWords ? removeShortWords(cache) : cache, true)
    search = formatSearch(noShortWords ? removeShortWords(search) : search, true)

    let re
    try {
        re = new RegExp(search, "g")
    } catch (err) {
        console.error(err)
        return 0
    }

    const occurrences = (cache.match(re) || []).length
    const cacheLength = cache.length

    // content includes match score, based on occurrences relative to cache length
    if (cacheLength > 0) {
        const percentageMatch = Math.min(((occurrences * search.length) / cacheLength) * 40, 1)
        // return percentageMatch * (noShortWords ? 20 : 50) // max 70%
        return percentageMatch * 70 // max 70%
    }

    return 0
}

function removeShortWords(value: string) {
    return value
        .split(" ")
        .filter((a) => a.length > 2)
        .join(" ")
}

function matchWords(text: string, value: string): number {
    const words = value.split(" ").filter(Boolean)
    const matchCount = words.filter((word) => text.includes(word)).length

    // value between 0 and 1
    return matchCount / words.length
}
