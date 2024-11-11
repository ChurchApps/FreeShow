import { get } from "svelte/store"
import type { ShowList } from "../../types/Show"
import { sortObjectNumbers } from "../components/helpers/array"
import { categories, drawerTabsData, textCache } from "../stores"
import { similarity } from "../converters/txt"

const specialChars = /[.,\/#!?$%\^&\*;:{}=\-_'"´`~()]/g
export function formatSearch(value: string, removeSpaces: boolean = false) {
    let newValue = value.toLowerCase().replace(specialChars, "")
    if (removeSpaces) newValue = newValue.replace(/\s+/g, "")

    return newValue
}

export function showSearch(searchValue: string, shows: any) {
    let newShows: ShowList[] = []

    // fix invalid regular expression
    searchValue = searchValue.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1")

    shows.forEach((s: any) => {
        // don't search show if archived
        const isArchived = get(categories)[s.category || ""]?.isArchive
        if (isArchived && get(drawerTabsData).shows?.activeSubTab !== s.category) return

        let match = showSearchFilter(searchValue, s)
        if (match) newShows.push({ ...s, match })
    })
    newShows = sortObjectNumbers(newShows, "match", true) as ShowList[]

    // change all values relative to the highest value
    let highestValue = newShows[0]?.match || 0
    newShows = newShows.map((a) => ({ ...a, match: ((a.match || 0) / highestValue) * 100 }))

    return newShows
}

export function showSearchFilter(searchValue: string, show: any) {
    // WIP tag search?

    // Priority 0: Number Exact Match
    const songNumber = show.quickAccess?.number || ""
    if (songNumber && Number(songNumber) === Number(searchValue)) return 100

    const showName = songNumber + formatSearch(show.name, true)

    // Priority 1: Title Exact Match
    const formattedSearchValue = formatSearch(searchValue, true)
    if (formattedSearchValue === showName) return 100

    const cache = get(textCache)[show.id] || ""

    // Priority 2: Content Includes Percentage Match
    const contentIncludesMatchScore = calculateContentIncludesScore(cache, searchValue) // + calculateContentIncludesScore(cache, searchValue, true)

    // Priority 3: Title Word-for-Word Match
    const titleWordMatch = matchWords(showName, searchValue)
    const titleIncludesMatchScore = titleWordMatch * 0.5 * 100 // max 50%

    // Priority 4: Title Letter-for-Letter Match
    const titleSimilarity = similarity(showName, removeShortWords(formatSearch(searchValue, true)))
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

function calculateContentIncludesScore(cache: string, search: string, noShortWords: boolean = false): number {
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
