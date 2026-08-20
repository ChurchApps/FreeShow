import { formatSearch, specialChars, tokenize } from "./search"

// Snippet extraction & safe match highlighting for search results.
// Matching happens on formatSearch()-normalized text, but the returned strings
// are sliced from the original text, so punctuation/diacritics stay readable.

// formatSearch(raw, false) equivalent that also maps every formatted char back
// to its source index in `raw` (all transforms only delete or expand chars)
function formatWithMap(raw: string): { text: string; map: number[] } {
    let text = ""
    const map: number[] = []
    let rawIndex = 0
    for (const char of raw) {
        const formatted = char
            .toLowerCase()
            .replace(specialChars, "")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
        for (let i = 0; i < formatted.length; i++) {
            text += formatted[i]
            map.push(rawIndex)
        }
        rawIndex += char.length
    }
    return { text, map }
}

// every index where `needle` occurs starting at a word boundary (the last word may continue)
function boundaryIndexes(text: string, needle: string): number[] {
    const found: number[] = []
    if (!needle) return found
    let i = text.indexOf(needle)
    while (i !== -1) {
        if (i === 0 || text.charCodeAt(i - 1) <= 32) found.push(i)
        i = text.indexOf(needle, i + 1)
    }
    return found
}

// match ranges [start, end) in formatted text: the full phrase if it occurs,
// otherwise the individual words (longest first so short words don't win the anchor)
function findMatchRanges(formatted: string, tokens: string[], firstOnly: boolean): [number, number][] {
    const ranges: [number, number][] = []

    const phrase = tokens.join(" ")
    for (const i of boundaryIndexes(formatted, phrase)) {
        ranges.push([i, i + phrase.length])
        if (firstOnly) return ranges
    }
    if (ranges.length) return ranges

    const sortedTokens = [...tokens].sort((a, b) => b.length - a.length)
    for (const token of sortedTokens) {
        for (const i of boundaryIndexes(formatted, token)) {
            ranges.push([i, i + token.length])
            if (firstOnly) return ranges
        }
    }
    return ranges
}

// a short excerpt of `text` around the first match of `searchValue`, with ellipses.
// "" when nothing matches (e.g. the search only matched the title)
export function getTextSnippet(text: string, searchValue: string, before = 30, after = 50): string {
    if (!text || searchValue.length < 3) return ""
    const tokens = tokenize(formatSearch(searchValue, false))
    if (!tokens.length) return ""

    const { text: formatted, map } = formatWithMap(text)
    const range = findMatchRanges(formatted, tokens, true)[0]
    if (!range) return ""

    const rawStart = map[range[0]]
    const rawEnd = map[range[1] - 1] + 1

    let from = Math.max(0, rawStart - before)
    let to = Math.min(text.length, rawEnd + after)
    // snap truncated edges to word boundaries
    if (from > 0) {
        const space = text.indexOf(" ", from)
        if (space !== -1 && space < rawStart) from = space + 1
    }
    if (to < text.length) {
        const space = text.lastIndexOf(" ", to)
        if (space > rawEnd) to = space
    }

    return (from > 0 ? "..." : "") + text.slice(from, to).trim() + (to < text.length ? "..." : "")
}

// escaped HTML of `text` with every match of `searchValue` wrapped in <mark>.
// Safe for {@html}: all text segments are escaped, only the <mark> tags are markup
export function highlightText(text: string, searchValue: string): string {
    if (!text) return ""
    const tokens = tokenize(formatSearch(searchValue, false))
    if (!tokens.length) return escapeHtml(text)

    const { text: formatted, map } = formatWithMap(text)
    const ranges = findMatchRanges(formatted, tokens, false)
    if (!ranges.length) return escapeHtml(text)

    // map to raw indices, then merge overlapping ranges
    const rawRanges = ranges.map(([start, end]) => [map[start], map[end - 1] + 1]).sort((a, b) => a[0] - b[0])
    const merged: number[][] = []
    for (const range of rawRanges) {
        const last = merged[merged.length - 1]
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
        else merged.push([...range])
    }

    let result = ""
    let pos = 0
    for (const [start, end] of merged) {
        result += escapeHtml(text.slice(pos, start)) + "<mark>" + escapeHtml(text.slice(start, end)) + "</mark>"
        pos = end
    }
    return result + escapeHtml(text.slice(pos))
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
