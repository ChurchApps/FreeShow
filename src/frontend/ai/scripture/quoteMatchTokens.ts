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

// lowercase, strip html, fold diacritics (both sides normalize identically, so "señor" spoken or
// written matches either way), keep letters/numbers/apostrophes, then fold apostrophes away
function baseTokens(text: string): string[] {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
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

/** A normalized transcript token plus the character span it came from in the raw segment text. */
export interface SpannedToken {
    token: string
    from: number
    to: number
}

/**
 * Tokenize a transcript segment, keeping each token's source span so the UI can show the raw
 * spoken words (casing and punctuation intact) instead of normalized token soup. Digits 1-99 are
 * spelled out so a spoken quantity matches the written verse ("5 barley loaves" -> "five");
 * anything larger becomes a placeholder that keeps its position in the stream (an honest span
 * breaker) but never matches verse text. Spelled-out digit parts share their source span.
 */
export function tokenizeTranscriptWithSpans(text: string): SpannedToken[] {
    const out: SpannedToken[] = []
    const push = (token: string, from: number, to: number) => out.push({ token, from, to })

    // word runs are matched on the RAW text so spans stay valid against it - each run then
    // normalizes through the same steps as baseTokens (marks are kept in the run so a
    // diacritic-carrying word stays one chunk before the fold)
    for (const match of text.matchAll(/[\p{L}\p{M}\p{N}']+/gu)) {
        const from = match.index ?? 0
        const to = from + match[0].length
        const token = match[0]
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/'/g, "")
        if (token.length < 1 || (token.length === 1 && !/^\d$/.test(token))) continue

        if (!/^\d+$/.test(token)) {
            push(token, from, to)
            continue
        }

        const value = parseInt(token, 10)
        if (value < 1 || value > 99) {
            push(NUMBER_PLACEHOLDER, from, to)
            continue
        }
        if (value < 10) push(NUMBER_UNITS[value], from, to)
        else if (value < 20) push(NUMBER_TEENS[value - 10], from, to)
        else {
            push(NUMBER_TENS[Math.floor(value / 10)], from, to)
            if (value % 10) push(NUMBER_UNITS[value % 10], from, to)
        }
    }
    return out
}

/** Tokenize a transcript segment (span-free view of tokenizeTranscriptWithSpans). */
export function tokenizeTranscript(text: string): string[] {
    return tokenizeTranscriptWithSpans(text).map((entry) => entry.token)
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

// the tails the 3-char stem rule accepts: archaic verb/pronoun endings & plain inflections
const STEM_TAILS = new Set(["e", "s", "t", "st", "th", "es", "ed", "ee"])

// ASR-CONFUSABLE LEXICON
// Sound-alike words the prefix and skeleton rules cannot reach: live speech arrives as "pray
// without SEASON" for "pray without CEASING" - different first letter, different skeleton.
// Curated (true homophones + preaching-frequent near-misses), because algorithmic phonetics
// both misses this class and widens junk matching. Grown one line per observed confusion.
//
// Deliberately EXCLUDED: anything under 4 chars and the short/common homophones (son/sun,
// no/know, one/won, not/knot, new/knew, hour/our, would/wood, you/ewe, him/hymn), "great"
// (far too frequent in speech to glue onto "gates"), and name pairs whose merge would
// misattribute people (judas/judah).
const ASR_CONFUSABLE_SETS: string[][] = [
    // observed & scripture-frequent
    ["season", "seasons", "ceasing"],
    ["junia", "junior"], // Romans 16:7, heard live
    ["altar", "alter"],
    ["prophet", "prophets", "profit", "profits"],
    ["morning", "mourning"],
    ["immortality", "immorality"],
    ["praise", "praises", "prays", "preys"],
    ["soul", "souls", "sole"],
    ["whole", "hole", "wholly", "holy"],
    ["weak", "week"],
    ["peace", "piece"],
    ["meet", "meat", "mete"],
    ["heir", "heirs", "air"],
    ["vain", "vein", "vane"],
    ["waist", "waste"],
    ["wait", "weight"],
    ["tale", "tail"],
    ["rite", "right", "write"],
    ["role", "roll"],
    ["seas", "sees", "seize"],
    ["made", "maid"],
    ["bread", "bred"],
    ["flour", "flower"],
    ["sword", "soared"],
    ["reign", "rain", "rein"],
    ["throne", "thrown"],
    ["heal", "heel"],
    ["idle", "idol", "idols"],
    ["fast", "vast"],
    ["bury", "berry"],
    // KJV / biblical vocabulary
    ["psalm", "psalms", "palm", "palms"],
    ["manna", "manner", "manor"],
    ["leaven", "eleven"],
    ["pilate", "pilot"],
    ["hart", "harts", "heart"],
    ["fowl", "fowls", "foul"],
    ["strait", "straight"],
    ["vale", "veil", "vail"],
    ["plumb", "plum"],
    ["loins", "lions"],
    ["leper", "lepers", "leaper"],
    ["tithes", "tides"],
    ["gait", "gate", "gates"],
    ["hallowed", "hollowed"],
    ["cain", "cane"],
    ["spake", "spoke", "speak"],
    ["saith", "sayeth"],
    ["zeal", "seal", "seals"],
    ["alms", "arms"],
    // general homophones plausible in preaching
    ["pray", "prey"],
    ["knead", "need"],
    ["counsel", "council"],
    ["principal", "principle"],
    ["presence", "presents"],
    ["bear", "bare"],
    ["dear", "deer"],
    ["fair", "fare"],
    ["gilt", "guilt"],
    ["groan", "grown"],
    ["heard", "herd"],
    ["hoard", "horde"],
    ["days", "daze"],
    ["lessen", "lesson"],
    ["mail", "male"],
    ["main", "mane"],
    ["pain", "pane"],
    ["pair", "pear", "pare"],
    ["pour", "pore", "poor"],
    ["wrap", "rap"],
    ["wretch", "retch"],
    ["ring", "wring"],
    ["road", "rode", "rowed"],
    ["sail", "sale"],
    ["stake", "steak"],
    ["steal", "steel"],
    ["tears", "tiers"],
    ["wail", "whale"],
    ["wares", "wears"],
    ["weary", "wary"],
    ["wine", "whine"],
    ["dies", "dyes"],
    ["feat", "feet"],
    ["flee", "flea"],
    ["hail", "hale"],
    ["knight", "night"],
    ["earn", "urn"],
    ["sight", "site", "cite"],
    ["scent", "sent", "cent"],
    ["vice", "vise"],
    ["muscle", "mussel"],
    ["naval", "navel"],
    ["petal", "pedal"],
    ["plain", "plane"],
    ["root", "route"],
    // ASR-typical near-misses (not strict homophones)
    ["anointing", "annoying"],
    ["manger", "major"],
    ["epistle", "pistol"],
    ["publican", "publicans", "republican"],
    ["gentile", "gentiles", "gentle"],
    ["martyr", "mortar"],
    ["faith", "fate"],
    ["esther", "ester"],
    ["dissent", "descent"],
    ["ascent", "ascend"]
]

// token -> its group's canonical member / canonical member -> full group. A token appearing in
// two sets unions them, so overlapping entries are safe
const CONFUSABLE_CANON = new Map<string, string>()
const CONFUSABLE_GROUPS = new Map<string, string[]>()
for (const set of ASR_CONFUSABLE_SETS) {
    const touched = new Set<string>()
    for (const token of set) {
        const existing = CONFUSABLE_CANON.get(token)
        if (existing !== undefined) touched.add(existing)
    }
    const canon = touched.size ? [...touched][0] : set[0]
    const members = new Set<string>(CONFUSABLE_GROUPS.get(canon) ?? [])
    for (const other of touched) {
        if (other === canon) continue
        for (const member of CONFUSABLE_GROUPS.get(other) ?? []) members.add(member)
        CONFUSABLE_GROUPS.delete(other)
    }
    for (const token of set) members.add(token)
    const list = [...members]
    CONFUSABLE_GROUPS.set(canon, list)
    for (const member of list) CONFUSABLE_CANON.set(member, canon)
}

/** Sound-alike alternates of a spoken token ([] when it has none) - candidate lookup votes with these too. */
export function confusableAlternates(token: string): string[] {
    const canon = CONFUSABLE_CANON.get(token)
    if (canon === undefined) return []
    return (CONFUSABLE_GROUPS.get(canon) ?? []).filter((member) => member !== token)
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

    // short stems with an archaic/inflection tail: one token IS the other's first three letters
    // ("has"/"hast", "the"/"thee", "day"/"days") - live speech drops KJV endings constantly, and
    // the bible search's substring matching treats these as equal. The tail itself must be a real
    // English/KJV ending: an arbitrary 3-char ASR fragment sharing three letters ("its"/"itsly")
    // is transcription debris, not a stem. Kept below 0.9 so such a pair can never be a phrase
    // run's distinctiveness peak
    if (cpl === 3 && (cpl === a.length || cpl === b.length) && Math.max(a.length, b.length) - cpl <= 2) {
        const tail = (a.length > b.length ? a : b).slice(cpl)
        if (STEM_TAILS.has(tail)) return 0.8
    }

    // curated sound-alikes ("season"/"ceasing") - like the phonetic path, only ever consulted
    // for informative verse tokens, and below 0.9 so a sound-alike is never a run's peak
    if (allowPhonetic) {
        const canonA = CONFUSABLE_CANON.get(a)
        if (canonA !== undefined && canonA === CONFUSABLE_CANON.get(b)) return 0.85
    }

    if (allowPhonetic && a.length >= PHONETIC_MIN_LEN && b.length >= PHONETIC_MIN_LEN && Math.abs(a.length - b.length) <= 3) {
        const keyA = cachedPhoneticKey(a)
        if (keyA && keyA === cachedPhoneticKey(b)) return 0.7
    }
    return 0
}
