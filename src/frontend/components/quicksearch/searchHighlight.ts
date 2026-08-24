import { formatSearch, tokenize } from "../../utils/search"

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] || c)
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Maps source string to formatted text and raw index mappings
function formatWithMap(raw: string) {
    let text = "",
        map: number[] = []
    for (let i = 0; i < raw.length; i++) {
        const fmt = formatSearch(raw[i])
        text += fmt
        for (let j = 0; j < fmt.length; j++) map.push(i)
    }
    return { text, map }
}

// Finds match indexes at word boundaries
function boundaryIndexes(text: string, needle: string): number[] {
    if (!needle) return []
    const rx = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}`, "g")
    const matches: number[] = []
    let m: RegExpExecArray | null
    while ((m = rx.exec(text))) matches.push(m[0].startsWith(needle) ? m.index : m.index + 1)
    return matches
}

// Returns match ranges prioritized by phrase, then by longest token
function findMatchRanges(text: string, tokens: string[], firstOnly: boolean): [number, number][] {
    const phrase = tokens.join(" ")
    const phraseMatches = boundaryIndexes(text, phrase).map((i) => [i, i + phrase.length] as [number, number])
    if (phraseMatches.length) return firstOnly ? [phraseMatches[0]] : phraseMatches

    const ranges: [number, number][] = []
    for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
        for (const i of boundaryIndexes(text, token)) {
            ranges.push([i, i + token.length])
            if (firstOnly) return ranges
        }
    }
    return ranges
}

export function getTextSnippet(text: string, searchValue: string, before = 30, after = 50): string {
    if (!text || searchValue.length < 3) return ""
    const tokens = tokenize(formatSearch(searchValue, false))
    const { text: formatted, map } = formatWithMap(text)
    const [range] = findMatchRanges(formatted, tokens, true)
    if (!range) return ""

    const [start, end] = [map[range[0]], map[range[1] - 1] + 1]
    let from = Math.max(0, start - before)
    let to = Math.min(text.length, end + after)

    if (from > 0) from = Math.min(start, text.indexOf(" ", from) + 1 || from)
    if (to < text.length) to = Math.max(end, text.lastIndexOf(" ", to) === -1 ? to : text.lastIndexOf(" ", to))

    return `${from > 0 ? "..." : ""}${text.slice(from, to).trim()}${to < text.length ? "..." : ""}`
}

export function highlightText(text: string, searchValue: string): string {
    if (!text) return ""
    const tokens = tokenize(formatSearch(searchValue, false))
    if (!tokens.length) return escapeHtml(text)

    const { text: formatted, map } = formatWithMap(text)
    const ranges = findMatchRanges(formatted, tokens, false)
    if (!ranges.length) return escapeHtml(text)

    // Map to raw coordinates and merge overlapping ranges
    const merged = ranges
        .map(([s, e]) => [map[s], map[e - 1] + 1])
        .sort((a, b) => a[0] - b[0])
        .reduce<[number, number][]>((acc, r) => {
            const last = acc[acc.length - 1]
            last && r[0] <= last[1] ? (last[1] = Math.max(last[1], r[1])) : acc.push(r as [number, number])
            return acc
        }, [])

    let res = "",
        pos = 0
    for (const [s, e] of merged) {
        res += escapeHtml(text.slice(pos, s)) + `<mark>${escapeHtml(text.slice(s, e))}</mark>`
        pos = e
    }
    return res + escapeHtml(text.slice(pos))
}
