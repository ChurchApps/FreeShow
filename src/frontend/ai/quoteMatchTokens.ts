// AI AUTO SCRIPTURE - quote matching: token normalization
// The quote matcher compares LIVE SPEECH (ASR output, with truncated and misheard words) against
// VERSE TEXT (clean written English). Both sides normalize through here, and the two-level design
// below is what makes the comparison survive ASR damage:
//
//   - canonKey (first 4 chars) groups a token with its truncations and inflections, so candidate
//     lookup still finds the verse when "believeth" arrives as "believe" or "verse" as "vers"
//   - tokenGrade scores how compatible two full tokens are, so alignment can prefer exact words
//     while still crediting a truncation or a same-prefix substitution ("matter" for "matthew")

/** Length of the canonical prefix key - shared by candidate lookup and compatibility bucketing. */
export const PREFIX_LEN = 4

const NUMBER_UNITS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
const NUMBER_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const NUMBER_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

/** Placeholder for numbers too large to appear in verse text - occupies a query position but can never match. */
export const NUMBER_PLACEHOLDER = "#num"

// lowercase, strip html, keep letters/numbers/apostrophes, then fold apostrophes away (ASR rarely produces them)
function baseTokens(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/<[^>]*>/g, " ")
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/'/g, "")
        .split(/\s+/)
        .filter((token) => token.length > 1 || /^\d$/.test(token)) // keep single digits for the transcript number rewrite
}

/** Tokenize cleaned verse text (after stripMarkdown/stripText). Verse text contains no digits. */
export function tokenizeVerseText(cleanText: string): string[] {
    return baseTokens(cleanText)
}

/**
 * Tokenize a transcript segment. Digits 1-99 are spelled out so a spoken quantity matches the
 * written verse ("5 barley loaves" -> "five"); anything larger becomes a placeholder that keeps
 * its position in the stream (an honest span breaker) but never matches verse text.
 */
export function tokenizeTranscript(text: string): string[] {
    const out: string[] = []
    for (const token of baseTokens(text)) {
        if (!/^\d+$/.test(token)) {
            out.push(token)
            continue
        }

        const value = parseInt(token, 10)
        if (value < 1 || value > 99) {
            out.push(NUMBER_PLACEHOLDER)
            continue
        }
        if (value < 10) out.push(NUMBER_UNITS[value])
        else if (value < 20) out.push(NUMBER_TEENS[value - 10])
        else {
            out.push(NUMBER_TENS[Math.floor(value / 10)])
            if (value % 10) out.push(NUMBER_UNITS[value % 10])
        }
    }
    return out
}

/** Canonical candidate-lookup key: the first 4 characters (shorter tokens are their own key). */
export function canonKey(token: string): string {
    return token.length > PREFIX_LEN ? token.slice(0, PREFIX_LEN) : token
}

function commonPrefixLength(a: string, b: string): number {
    const max = Math.min(a.length, b.length)
    let i = 0
    while (i < max && a[i] === b[i]) i++
    return i
}

/**
 * Compatibility grade between a transcript token and a verse token.
 *   1.0  exact
 *   0.9  one is a prefix of the other, at least 4 chars ("vers"/"verse", "believe"/"believeth")
 *   0.75 shared 4-char prefix with short differing tails ("matter"/"matthew", "loved"/"loveth")
 *   0    incompatible
 */
export function tokenGrade(a: string, b: string): number {
    if (a === NUMBER_PLACEHOLDER || b === NUMBER_PLACEHOLDER) return 0
    if (a === b) return 1

    const cpl = commonPrefixLength(a, b)
    if (cpl >= PREFIX_LEN) {
        if (cpl === a.length || cpl === b.length) return 0.9
        if (a.length - cpl <= 4 && b.length - cpl <= 4) return 0.75
    }
    return 0
}
