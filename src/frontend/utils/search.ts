import { get } from "svelte/store"
import type { ShowList } from "../../types/Show"
import { sortObjectNumbers } from "../components/helpers/array"
import { similarity } from "../converters/txt"
import { textCache } from "../stores"

const specialChars = /[.,\/#!?$%\^&\*;:{}=\-_`~()]/g

export function formatSearch(value: string, removeSpaces: boolean = false) {
    let newValue = value.toLowerCase().replace(specialChars, "")
    if (removeSpaces) newValue = newValue.replaceAll(" ", "")

    return newValue
}

const searchIncludes = (text: string, search: string): boolean => formatSearch(text, true).includes(search)
// const searchEquals = (text: string, search: string): boolean => formatSearch(text, true) === search

export function showSearch(searchValue: string, shows: any) {
    let newShows: ShowList[] = []

    shows.forEach((s: any) => {
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
    let match: any[] = []

    let showName = formatSearch(show.name, true)
    if (searchValue.replaceAll(" ", "") === showName) return 100

    let titleWordMatch = matchWords(showName, searchValue)
    let titleLetterMatch = similarity(showName, searchValue.replaceAll(" ", "")) || 0
    let titleMatch = titleWordMatch + titleLetterMatch * 0.4
    if (titleMatch > 0.4 || searchValue.length < 5) return titleMatch * 100

    // content search
    const MAX_CONTENT = 100
    let splittedValue = searchValue.split(" ").filter((a) => a)
    splittedValue.forEach((search, i) => {
        if (!search.length) return

        let cache = get(textCache)[show.id]
        if (!cache) return

        match[i] = 0
        cache.split(".").forEach((text: string) => {
            // if (searchEquals(text, search)) match[i] += 5
            if (searchIncludes(text, search)) match[i] += MAX_CONTENT / splittedValue.length / cache.split(".").length
        })
    })

    let sum = match.reduce((count, num) => (count += num), 0)
    if (sum < 11) return titleMatch * 100

    sum = Math.min(sum, 100)

    // 40% is content
    sum = sum * 0.4 + titleMatch * 100

    // only exact show name is 100
    if (sum >= 100) sum = 99

    if (sum < 3) sum = 0
    return sum
}

function matchWords(text: string, value: string) {
    let match = 0
    value
        .split(" ")
        .filter((a) => a)
        .forEach((s) => {
            if (text.includes(s)) match += s.length / text.length
        })

    return Math.min(1, match)
}
