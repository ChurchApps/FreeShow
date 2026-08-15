// AI AUTO SCRIPTURE - quote matching: token normalization
// The quote matcher compares LIVE SPEECH (ASR output, with truncated and misheard words) against
// VERSE TEXT (clean written English). Both sides normalize through here, and the two-level design
// below is what makes the comparison survive ASR damage:
//
//   - canonKey (first 4 chars) groups a token with its truncations and inflections, so candidate
//     lookup still finds the verse when "believeth" arrives as "believe" or "verse" as "vers"
//   - tokenGrade scores how compatible two full tokens are, so alignment can prefer exact words
//     while still crediting a truncation or a same-prefix substitution ("matter" for "matthew")
//   - phoneticKey (consonant skeleton) recovers rare words the prefix can't: ASR mishears biblical
//     names mid-word ("analekite" for "amalekites"), which breaks even the 4-char prefix - but the
//     mishearing keeps the sound, and the skeleton keys both to the same value

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

/** Tokens shorter than this never take the phonetic path - short-word skeletons collide too easily. */
export const PHONETIC_MIN_LEN = 6

// soundex consonant classes: sounds ASR confuses map to the same digit (m/n merging is what
// rescues "analekite"/"amalekites"). Vowels and h/w/y are skipped and reset the run-collapse.
const SOUNDEX_CLASS: Record<string, string> = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6"
}

/**
 * Consonant-skeleton key for rare-word recovery ("analekite" ≡ "amalekites"). Null for tokens too
 * short or too vowel-heavy to produce a distinctive skeleton - those must never phonetic-merge.
 */
export function phoneticKey(token: string): string | null {
    if (token.length < PHONETIC_MIN_LEN || token === NUMBER_PLACEHOLDER) return null

    const base = token.endsWith("s") ? token.slice(0, -1) : token // fold plural/possessive tails
    let key = /^[aeiou]/.test(base) ? "a" : "" // leading vowel is audible - keep it distinctive
    let previous = ""
    for (const char of base) {
        const cls = SOUNDEX_CLASS[char] || ""
        if (cls && cls !== previous) key += cls
        previous = cls
    }

    // skeleton floor: keys carrying too little signal ("through" -> "36") are dropped, not merged
    return key.length >= (key.startsWith("a") ? 4 : 3) ? key.slice(0, 8) : null
}

// the alignment DP calls the phonetic path once per (query token, verse token) cell - memoize per
// token. Bible vocab plus live speech converges around ~15k distinct tokens, the cap only guards
// against pathological input
const PHONETIC_CACHE_MAX = 20000
const phoneticCache = new Map<string, string | null>()

export function cachedPhoneticKey(token: string): string | null {
    let key = phoneticCache.get(token)
    if (key === undefined) {
        if (phoneticCache.size >= PHONETIC_CACHE_MAX) phoneticCache.clear()
        phoneticCache.set(token, (key = phoneticKey(token)))
    }
    return key
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
 *   0.7  same phonetic skeleton ("analekite"/"amalekites") - only when the caller allows it,
 *        which alignment restricts to informative (high-idf) verse tokens so common words
 *        never phonetic-merge
 *   0    incompatible
 */
export function tokenGrade(a: string, b: string, allowPhonetic = false): number {
    if (a === NUMBER_PLACEHOLDER || b === NUMBER_PLACEHOLDER) return 0
    if (a === b) return 1

    const cpl = commonPrefixLength(a, b)
    if (cpl >= PREFIX_LEN) {
        if (cpl === a.length || cpl === b.length) return 0.9
        if (a.length - cpl <= 4 && b.length - cpl <= 4) return 0.75
    }

    if (allowPhonetic && a.length >= PHONETIC_MIN_LEN && b.length >= PHONETIC_MIN_LEN && Math.abs(a.length - b.length) <= 3) {
        const keyA = cachedPhoneticKey(a)
        if (keyA && keyA === cachedPhoneticKey(b)) return 0.7
    }
    return 0
}
