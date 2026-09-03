// VOICE COMMAND GRAMMAR UTILITIES
// the language-independent matching primitives every voice feature builds its matchers from:
// imperative-vs-narration separation, alternation building and localized-table merging

// commands are short & spoken just before they should act - only the newest speech is considered
export const TAIL_CHARS = 80

// leading word boundary (\b fails before accented characters like "übersetzung")
export const LEAD = "(?:^|[^a-z0-9])"

// a command does not have to be phrased as an order - speakers just say "next chapter". Without an imperative the
// phrase has to END the utterance, which is what separates an instruction from narration that happens to contain
// the same words ("in the next verse paul says something amazing" keeps talking, so it is never a command).
export const BARE_TAIL = "\\s*[.,!?]*\\s*$"

// ...and these still read as narration even at the end of a sentence ("we will see that in the next chapter")
export const NARRATION_BEFORE = /\b(?:in|from|on|at|into|within|about|of)(?:\s+the)?\s*$/

// a leading conditional ("if we go back...") is a sentence being built, not an instruction
export const CONDITIONAL_BEFORE = /\b(?:if|when|whenever|before|until|as|should)\s+(?:we|you|i|they|he|she)?\s*$/

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// escaped alternation, longest words first so "show me" wins over "show"
export function alternation(words: string[]): string {
    return [...new Set(words.filter((word) => word.trim().length))]
        .sort((a, b) => b.length - a.length)
        .map((word) => escapeRegex(word).replace(/ /g, "\\s+"))
        .join("|")
}

// a feature's grammar always matches against the union of the spoken language & English,
// so English phrases keep working when the STT engine runs in another language
export function mergeLocalizedGrammar<G extends { [slot: string]: string[] }>(tables: { [lang: string]: G }, language: string): G {
    const base = tables.en
    const local = tables[(language || "").slice(0, 2).toLowerCase()]
    if (!local || local === base) return base

    const merged: { [slot: string]: string[] } = {}
    for (const slot of Object.keys(base)) merged[slot] = [...new Set([...local[slot], ...base[slot]])]
    return merged as G
}

export function phraseOf(match: RegExpMatchArray): string {
    return match[0].replace(/^[^a-z0-9]+/, "").replace(/[\s.,!?]+$/, "")
}

/**
 * A spoken number sequence ("1 to 5" / "1 and 2" / "1, 2 and 3") collapsed to its span. The
 * continuation only counts while the numbers ASCEND - "give me verse 5 and 2 chronicles says"
 * stops at 5, because a descending number is the start of something else, not part of the range.
 */
export function sequenceSpan(first: number, rest: string | undefined): { start: number; end: number } {
    let end = first
    for (const digits of (rest || "").matchAll(/\d{1,3}/g)) {
        const number = parseInt(digits[0], 10)
        if (number <= end) break
        end = number
    }
    return { start: first, end }
}

/**
 * Match a command body either as an order ("show the next chapter", anywhere in the tail) or as a plain
 * instruction ("next chapter") that has to end the utterance. Returns null when neither reading applies.
 */
export function matchCommand(tail: string, imperative: string, body: string): RegExpMatchArray | null {
    const ordered = tail.match(new RegExp(LEAD + imperative + "\\s+" + body))
    if (ordered) return ordered

    const bare = tail.match(new RegExp(LEAD + body + BARE_TAIL))
    if (!bare || bare.index === undefined) return null

    return NARRATION_BEFORE.test(tail.slice(0, bare.index)) ? null : bare
}
