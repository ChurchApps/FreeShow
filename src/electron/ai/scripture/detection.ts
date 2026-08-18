// AI AUTO SCRIPTURE
// tier 1: fast local regex detection of explicitly spoken references ("John chapter 3 verse 16")
// tier 2: LLM detection over the rolling transcript for paraphrased/quoted references (optional, needs an API key)

import type { AiScriptureBook, AiScriptureState, DetectedReference } from "../../../types/ai/AiScripture"
import { maxVerseInChapter } from "./chapterVerseCounts"
import { LLM_API_TIMEOUT } from "../llm/models/APIModel"
import { getLLMScriptureProvider } from "./llmTalkScripture"

// ASR BOOK NAME CONFUSIONS (from AlloDel's live-service observations)
// A streaming model finalizes a book name before it is finished, or hears a common word
// instead of it. An alias whose word is also ordinary English needs an explicit verse
// before it counts, so normal speech ("he acts his age", "look at this") cannot trigger.
// Aliases are only added for books the loaded bible actually has.
const ASR_BOOK_ALIASES: { alias: string; canonNumber: number; requireVerse: boolean }[] = [
    { alias: "palm", canonNumber: 19, requireVerse: false }, // Psalms
    { alias: "palms", canonNumber: 19, requireVerse: false },
    { alias: "genes", canonNumber: 1, requireVerse: false }, // Genesis, cut off mid word
    { alias: "joan", canonNumber: 43, requireVerse: true }, // John
    { alias: "jon", canonNumber: 43, requireVerse: true },
    { alias: "axe", canonNumber: 44, requireVerse: true }, // Acts
    { alias: "ask", canonNumber: 44, requireVerse: true },
    { alias: "look", canonNumber: 42, requireVerse: true }, // Luke
    { alias: "games", canonNumber: 59, requireVerse: true }, // James
    { alias: "roof", canonNumber: 8, requireVerse: true }, // Ruth
    { alias: "dude", canonNumber: 65, requireVerse: true }, // Jude
    { alias: "juice", canonNumber: 65, requireVerse: true }
]

// SPOKEN NUMBERS

const UNIT_WORDS: { [word: string]: number } = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEEN_WORDS: { [word: string]: number } = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS_WORDS: { [word: string]: number } = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINAL_PREFIXES: { [word: string]: string } = { first: "1", second: "2", third: "3" }

// spoken ordinals directly before "chapter"/"verse" ("the eighth chapter of ezra", "ninth verse of...")
const ORDINAL_UNIT_WORDS: { [word: string]: number } = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 }
const ORDINAL_TEEN_WORDS: { [word: string]: number } = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19 }
const ORDINAL_TENS_WORDS: { [word: string]: number } = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 }

/** An ordinal number word 1st-99th ("ninth", "twenty-third"), or null when `core` is not one. */
function readOrdinalWord(core: string): number | null {
    if (ORDINAL_UNIT_WORDS[core] !== undefined) return ORDINAL_UNIT_WORDS[core]
    if (ORDINAL_TEEN_WORDS[core] !== undefined) return ORDINAL_TEEN_WORDS[core]
    if (ORDINAL_TENS_WORDS[core] !== undefined) return ORDINAL_TENS_WORDS[core]
    const parts = core.split("-")
    if (parts.length === 2 && TENS_WORDS[parts[0]] !== undefined && ORDINAL_UNIT_WORDS[parts[1]] !== undefined) return TENS_WORDS[parts[0]] + ORDINAL_UNIT_WORDS[parts[1]]
    return null
}

/** "8" -> "th", "21" -> "st" - the ordinal shape survives normalization as a parsing signal. */
function ordinalSuffix(value: number): string {
    if (Math.floor(value / 10) % 10 === 1) return "th"
    const unit = value % 10
    return unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"
}

// whisper regularly mishears the word "verse" itself ("verse five" arrives as "best five" or
// "this five") - accepted wherever a verse word is expected, which is safe because every use
// site also requires the surrounding shape (book+chapter here, an imperative in commands)
export const VERSE_WORD_MISHEARINGS = ["best", "this", "vers", "versus", "worse"]
const VERSE_WORD = "(?:verses?|" + VERSE_WORD_MISHEARINGS.join("|") + ")"

// ...and spoken verse numbers arrive as their homophones ("Matthew 4 four" -> "Matthew 4 for").
// These are everyday function words, so they only count in the verse slot AND when the utterance
// ends right there - "matthew 4 for" is a reference, "matthew 4 for our reading today" keeps talking
export const NUMBER_HOMOPHONES: { [word: string]: number } = { for: 4, won: 1, tree: 3, ate: 8 }
const HOMOPHONE_ALT = "(?:" + Object.keys(NUMBER_HOMOPHONES).join("|") + ")(?=[\\s.,!?]*$)"

/** A captured verse-slot token: a digit run, or one of the accepted end-of-utterance homophones. */
export function parseNumberToken(raw: string): number {
    return NUMBER_HOMOPHONES[raw] ?? parseInt(raw, 10)
}

interface SpokenToken {
    prefix: string // leading punctuation
    core: string
    suffix: string // trailing punctuation
}

function toToken(raw: string): SpokenToken {
    const match = raw.match(/^([^a-z0-9]*)(.*?)([^a-z0-9]*)$/)
    return match ? { prefix: match[1], core: match[2], suffix: match[3] } : { prefix: "", core: raw, suffix: "" }
}

// read a 1-99 number word at index i ("six", "sixteen", "seventy", "seventy-six", "seventy six") - null when tokens[i] is not one
function readTens(tokens: SpokenToken[], i: number): { value: number; end: number } | null {
    const token = tokens[i]
    if (!token) return null

    const parts = token.core.split("-")
    if (parts.length === 2 && TENS_WORDS[parts[0]] !== undefined && UNIT_WORDS[parts[1]] !== undefined) return { value: TENS_WORDS[parts[0]] + UNIT_WORDS[parts[1]], end: i + 1 }

    if (TENS_WORDS[token.core] !== undefined) {
        const next = tokens[i + 1]
        if (!token.suffix && next && !next.prefix && UNIT_WORDS[next.core] !== undefined) return { value: TENS_WORDS[token.core] + UNIT_WORDS[next.core], end: i + 2 }
        return { value: TENS_WORDS[token.core], end: i + 1 }
    }

    if (TEEN_WORDS[token.core] !== undefined) return { value: TEEN_WORDS[token.core], end: i + 1 }
    if (UNIT_WORDS[token.core] !== undefined) return { value: UNIT_WORDS[token.core], end: i + 1 }
    return null
}

// lowercase the text & convert spoken numbers to digits: "john chapter three verse sixteen" -> "john chapter 3 verse 16",
// "one hundred seventy-six" -> "176", ordinal book prefixes "first john" -> "1 john"
export function normalizeSpokenNumbers(text: string): string {
    const tokens = text
        .toLowerCase()
        .split(/\s+/)
        .filter((part: string) => part.length > 0)
        .map(toToken)

    const out: string[] = []
    let i = 0
    while (i < tokens.length) {
        const token = tokens[i]
        const next = tokens[i + 1]

        // spoken ordinals right before "chapter"/"verse"/"psalm" become digit ordinals ("eighth
        // chapter" -> "8th chapter", "twenty-third psalm" -> "23rd psalm") - the suffix survives
        // as a parsing signal, and a bare ordinal stays a word ("he came third")
        if (!token.suffix && next && !next.prefix && /^(?:chapter|verses?|psalms?)$/.test(next.core)) {
            const ordinal = readOrdinalWord(token.core)
            if (ordinal !== null) {
                out.push(token.prefix + String(ordinal) + ordinalSuffix(ordinal))
                i++
                continue
            }
        }
        // spaced compounds too: "twenty third psalm" -> "23rd psalm"
        const after = tokens[i + 2]
        if (!token.suffix && next && !next.prefix && !next.suffix && TENS_WORDS[token.core] !== undefined && ORDINAL_UNIT_WORDS[next.core] !== undefined && after && !after.prefix && /^(?:chapter|verses?|psalms?)$/.test(after.core)) {
            const value = TENS_WORDS[token.core] + ORDINAL_UNIT_WORDS[next.core]
            out.push(token.prefix + String(value) + ordinalSuffix(value))
            i += 2
            continue
        }

        // ordinal book prefixes: only converted when followed by another word ("first john" -> "1 john",
        // "1st john" -> "1 john" - whisper writes spoken ordinals either way). Before "chapter"/
        // "verse"/"psalm" the digit ordinal stays whole - the suffix is a parsing signal there
        const digitOrdinal = /^([1-3])(?:st|nd|rd)$/.exec(token.core)
        if (digitOrdinal && !token.suffix && next && !next.prefix && /^[a-z]/.test(next.core) && !/^(?:chapter|verses?|psalms?)$/.test(next.core)) {
            out.push(token.prefix + digitOrdinal[1])
            i++
            continue
        }
        if (ORDINAL_PREFIXES[token.core] !== undefined && !token.suffix && next && !next.prefix && /^[a-z]/.test(next.core)) {
            out.push(token.prefix + ORDINAL_PREFIXES[token.core])
            i++
            continue
        }

        const small = readTens(tokens, i)
        if (!small) {
            out.push(token.prefix + token.core + token.suffix)
            i++
            continue
        }

        let value = small.value
        let end = small.end

        // "<unit> hundred (and) <1-99>" composition: "one hundred seventy-six" -> 176
        if (value >= 1 && value <= 9 && !tokens[end - 1].suffix && tokens[end] && !tokens[end].prefix && tokens[end].core === "hundred") {
            value *= 100
            end++
            let k = end
            if (!tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix && !tokens[k].suffix && tokens[k].core === "and" && tokens[k + 1] && !tokens[k + 1].prefix && readTens(tokens, k + 1)) k++
            const remainder = !tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix ? readTens(tokens, k) : null
            if (remainder) {
                value += remainder.value
                end = remainder.end
            }
        }

        out.push(tokens[i].prefix + String(value) + tokens[end - 1].suffix)
        i = end
    }

    return out.join(" ")
}

// TIER 1 (local regex)

interface BookIndex {
    regex: RegExp | null
    chapterFirstRegex: RegExp | null // "the 8th chapter of (the book of) ezra (and the verse number 10)"
    verseFirstRegex: RegExp | null // "the 9th verse of (the 8th chapter of) ezra ((chapter) 8)"
    psalmOrdinalRegex: RegExp | null // "the 23rd psalm (verse 1)" - the ordinal-as-chapter idiom
    singleChapterVerseRegex: RegExp | null // "jude verse 3" - one-chapter books are spoken without their chapter
    byToken: Map<string, { name: string; number: number; chapterCount: number; requireVerse?: boolean }>
    bookPattern: string // alternation of all book name patterns ("" when no books)
    bookWords: string[] // distinct book-name words long enough for mishearing recovery
    allBookWords: string[] // distinct book-name words >= 4 chars, for the stutter collapse
}

// a spoken "8 18" often reaches us as "818". Recover the pair when the number cannot be a chapter of this book,
// and only when exactly one split works - an ambiguous number keeps its literal reading and waits for confirmation.
export function splitGluedReference(value: number, chapterCount: number): { chapter: number; verse: number } | null {
    if (!chapterCount || value <= chapterCount) return null

    const digits = String(value)
    const candidates: { chapter: number; verse: number }[] = []
    for (let cut = 1; cut < digits.length; cut++) {
        const versePart = digits.slice(cut)
        if (versePart.startsWith("0")) continue // "805" is not "8" + "05"

        const chapter = parseInt(digits.slice(0, cut), 10)
        const verse = parseInt(versePart, 10)
        if (chapter >= 1 && chapter <= chapterCount && verse >= 1 && verse <= MAX_VERSE_NUMBER) candidates.push({ chapter, verse })
    }

    return candidates.length === 1 ? candidates[0] : null
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildBookIndex(books: AiScriptureBook[]): BookIndex {
    const byToken = new Map<string, { name: string; number: number; chapterCount: number; requireVerse?: boolean }>()
    const tokens: string[] = []

    const canonNames = new Map<number, string>()
    books.forEach((book) => {
        // only a canon book has a known chapter count - without one a glued chapter+verse cannot be told apart from a chapter
        const chapterCount = book.canonNumber ? CANON_CHAPTER_COUNTS[book.canonNumber] || 0 : 0
        book.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (!token || byToken.has(token)) return
            // prefer the 66 book canon number so tier 1 & tier 2 (which always reports canon numbers) share one numbering domain
            byToken.set(token, { name: name.trim(), number: book.canonNumber ?? book.number, chapterCount })
            tokens.push(token)
        })
        if (book.canonNumber && !canonNames.has(book.canonNumber)) canonNames.set(book.canonNumber, book.names[0]?.trim() || "")
    })

    // the misheard forms, but only for books this bible actually has
    ASR_BOOK_ALIASES.forEach((entry) => {
        if (byToken.has(entry.alias)) return
        const name = canonNames.get(entry.canonNumber)
        if (!name) return
        byToken.set(entry.alias, { name, number: entry.canonNumber, chapterCount: CANON_CHAPTER_COUNTS[entry.canonNumber] || 0, requireVerse: entry.requireVerse })
        tokens.push(entry.alias)
    })

    // longest names first so "1 john" wins over "john"
    tokens.sort((a, b) => b.length - a.length)
    const patterns = tokens.map((token) => escapeRegex(token).replace(/ /g, "\\s+"))

    // THE VERSE TAIL - what may follow a resolved book+chapter. Four branches, named groups:
    //   v1: the verse-word route: "verse 16", ": 16", "and the verse number 16", "starting from
    //       verse 16" - spoken fillers only ride along WITH the verse word, so a bare "15 and 3"
    //       never reads as chapter-and-verse. Only this route accepts the spoken range words
    //       ("verses 16 and 17", "16 till 18", "16 down to 20") for the same reason
    //   v2: the ordinal-first route: "chapter 3, the 16th verse" - the digit ordinal suffix is
    //       required, so "3, 16 verses later" can never bind
    //   v3/v4: whisper's punctuation/plain separators: "3:16" is v1 (colon), "3, 16"/"3. 16"/
    //       "3-16"/"3;16"/"3 16" land here with the conservative range set (-, to, through)
    const rangeWord = "(?:\\s*(?:-|–|(?:down\\s+|up\\s+)?to\\b|through\\b|thru\\b|till\\b|until\\b|and\\b)\\s*(?<e1>\\d{1,3})\\b)?"
    const rangePlain = (name: string) => "(?:\\s*(?:-|–|to\\b|through\\b)\\s*(?<" + name + ">\\d{1,3})\\b)?"
    // the trailing "and N" branch (v5) is only honored when a spoken imperative opened the
    // reference ("give me nehemiah 8 and 6"); narration ("he acts 15 and 3 others") never has one
    const verseTail =
        "(?:" +
        ("\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?:starting\\s+|beginning\\s+|reading\\s+)?(?:from\\s+|at\\s+)?(?::|" + VERSE_WORD + "\\b)(?:\\s+numbers?\\b)?\\s*(?<v1>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangeWord) +
        ("|\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?<v2>\\d{1,3})(?:st|nd|rd|th)\\s+" + VERSE_WORD + "\\b") +
        ("|\\s*[-–,.;/]\\s*(?<v3>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangePlain("e3")) +
        ("|\\s+(?<v4>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangePlain("e4")) +
        ("|\\s+and\\s+(?<v5>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")") +
        ")?"
    const bookAlt = patterns.join("|")

    // book first: "john 3...", "john chapter 3...", "john chapter number 3...", "john the 3rd chapter..."
    // (the bare "the N" intro requires the ordinal suffix AND the chapter word, so "give john the
    // 5 loaves" can never bind a chapter). A leading imperative ("give me nehemiah...") is captured
    // because it unlocks the bare "8 and 6" verse reading below
    // the imperative rides inside the LEAD group, so the reported quote still starts at the book
    const imperativeIntro = "(?:(?<imp>give\\s+me|turn\\s+(?:with\\s+me\\s+)?to|go\\s+to|open(?:\\s+(?:up\\s+)?(?:to|at))?|show\\s+me|read|take\\s+me\\s+to|let'?s\\s+(?:go\\s+to|read|open))\\s+(?:the\\s+)?(?:book\\s+of\\s+)?)?"
    const chapterIntro = "(?:chapter\\s+(?:number\\s+)?(?<cA>\\d{1,3})\\b|(?:the\\s+)?(?<cB>\\d{1,3})(?:st|nd|rd|th)\\s+chapter\\b|(?<cC>\\d{1,3})\\b)"
    const regex = patterns.length ? new RegExp("((?:^|[^a-z0-9])" + imperativeIntro + ")(?<book>" + bookAlt + ")[,.]?\\s+" + chapterIntro + verseTail, "g") : null

    // reversed spoken forms - each carries the word "chapter"/"verse"/"psalm" by construction,
    // so they always count as deliberate (cued) references downstream
    const ofBook = "\\s+of\\s+(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")\\b"
    // "the 8th chapter of (the book of) ezra ..." / "chapter (number) 8 of ezra ..."
    const chapterFirstRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter|chapter\\s+(?:number\\s+)?(?<cB>\\d{1,3}))" + ofBook + verseTail, "g") : null
    // "the 9th verse of (the 8th chapter of) ezra ((chapter) 8)" / "verse (number) 9 of ezra 8" -
    // with no chapter spoken anywhere, a single-chapter book (jude, philemon...) resolves to chapter 1
    const verseFirstRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:(?<vA>\\d{1,3})(?:st|nd|rd|th)?\\s+" + VERSE_WORD + "\\b|" + VERSE_WORD + "\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b)\\s+of\\s+(?:(?:the\\s+)?(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter\\s+of\\s+)?(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")\\b(?:[,.]?\\s+(?:chapter\\s+)?(?<cB>\\d{1,3})\\b)?", "g") : null
    // "the 23rd psalm (verse 1)" - the ordinal IS the chapter. Only the psalms idiom works this
    // way, so the form is built solely from the psalm book tokens (including the "palm" alias)
    const psalmTokens = tokens.filter((token) => /^psalms?$/.test(token) || byToken.get(token)?.number === 19)
    const psalmOrdinalRegex = psalmTokens.length ? new RegExp("(^|[^a-z0-9])the\\s+(?<cA>\\d{1,3})(?:st|nd|rd|th)\\s+(?<book>" + psalmTokens.map((token) => escapeRegex(token)).join("|") + ")\\b" + verseTail, "g") : null

    // "jude verse 3" / "the book of philemon verse six" - a one-chapter book is spoken without
    // its chapter. The regex matches any book; only chapterCount === 1 entries resolve (in
    // pushMatch), so "john verse 16" stays untouched for the anchored bare-verse path
    const singleChapterVerseRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")[,.]?\\s+" + VERSE_WORD + "\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b" + rangePlain("e4"), "g") : null

    // words long enough to recover from a mishearing ("corinians" -> "corinthians"); short names
    // ("john", "kings") stay exact-only, their skeletons collide with everyday words too easily
    const bookWords = new Set<string>()
    for (const token of tokens) for (const word of token.split(" ")) if (word.length >= FUZZY_MIN_LEN) bookWords.add(word)

    // every book word down to 4 chars, for the stutter collapse - a repeated name merged by the
    // decoder ("Ezra... Ezra" -> "ezrazra") is recoverable even for names too short to fuzzy-match
    const allBookWords = new Set<string>()
    for (const token of tokens) for (const word of token.split(" ")) if (word.length >= 4) allBookWords.add(word)

    return { regex, chapterFirstRegex, verseFirstRegex, psalmOrdinalRegex, singleChapterVerseRegex, byToken, bookPattern: patterns.join("|"), bookWords: Array.from(bookWords), allBookWords: Array.from(allBookWords) }
}

// BOOK-NAME MISHEARINGS
// whisper mangles long book names mid-word ("Corinthians" arrives as "Corinians", "Philippians"
// as "Philippines"), which breaks the exact-name regex above. A token close enough to exactly one
// book word is rewritten to it BEFORE the regex pass - the regex then demands the full reference
// shape (ordinal prefix, chapter number...) around it, so a rewrite alone never creates a match.

const FUZZY_MIN_LEN = 6

/** Edit distance when it is <= cap, otherwise null. Distance caps keep everyday words out. */
export function editDistanceWithin(a: string, b: string, cap: number): number | null {
    if (Math.abs(a.length - b.length) > cap) return null

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const current = [i]
        let rowMin = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            if (current[j] < rowMin) rowMin = current[j]
        }
        if (rowMin > cap) return null // no path back under the cap
        previous = current
    }
    return previous[b.length] <= cap ? previous[b.length] : null
}

/**
 * Collapse a book name merged with its own echo - fast repeated names glue in the decoder
 * ("Ezra... Ezra" arrives as "ezrazra"). Only a token that IS a book word followed by a tail
 * of that same word collapses, so everyday words pass through untouched.
 */
export function collapseStutteredBookNames(normalized: string, allBookWords: string[]): string {
    if (!allBookWords.length) return normalized

    return normalized.replace(/[a-z]{5,}/g, (token) => {
        for (const word of allBookWords) {
            if (token.length > word.length && token.startsWith(word) && word.endsWith(token.slice(word.length))) return word
        }
        return token
    })
}

/** Rewrite tokens that are unambiguously a misheard book word - everything else passes through. */
export function correctBookMishearings(normalized: string, bookWords: string[]): string {
    if (!bookWords.length) return normalized

    return normalized.replace(/[a-z]{6,}/g, (token) => {
        if (bookWords.includes(token)) return token // heard correctly

        const cap = token.length >= 9 ? 2 : 1
        let best: string | null = null
        let bestDistance = cap + 1
        let tied = false
        for (const word of bookWords) {
            const distance = editDistanceWithin(token, word, cap)
            if (distance === null) continue
            if (distance < bestDistance) {
                best = word
                bestDistance = distance
                tied = false
            } else if (distance === bestDistance) tied = true
        }

        // ambiguity between two different book words means the mishearing is not recoverable
        return best && !tied ? best : token
    })
}

interface ReferenceMatch {
    bookNumber: number
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    quote: string
}

// named groups shared by every reference regex: book, cA/cB/cC (chapter routes),
// vA/vB (reversed-form verse routes), v1..v4 (verse-tail routes), e1/e3/e4 (range ends)
interface ReferenceGroups {
    imp?: string
    book?: string
    cA?: string
    cB?: string
    cC?: string
    vA?: string
    vB?: string
    v1?: string
    v2?: string
    v3?: string
    v4?: string
    v5?: string
    e1?: string
    e3?: string
    e4?: string
}

function matchReferences(text: string, index: BookIndex): ReferenceMatch[] {
    if (!index.regex) return []

    const normalized = correctBookMishearings(collapseStutteredBookNames(normalizeSpokenNumbers(text), index.allBookWords), index.bookWords)
    const results: ReferenceMatch[] = []

    // the specific spoken forms scan first - their spans are excluded from the general book-first
    // scan, or "9th verse of ezra chapter 8" would also surface a chapter-only "ezra chapter 8" echo
    const claimedSpans: { from: number; to: number }[] = []

    const pushMatch = (match: RegExpExecArray, options: { claimSpan?: boolean; alwaysCued?: boolean; verseOverride?: string } = {}) => {
        const groups = (match.groups || {}) as ReferenceGroups
        const bookToken = (groups.book || "").replace(/\s+/g, " ")
        const book = index.byToken.get(bookToken)
        if (!book) return

        let chapter = parseInt(groups.cA ?? groups.cB ?? groups.cC ?? "", 10)
        // a verse-first form with no chapter anywhere still resolves for a single-chapter book
        if (!(chapter >= 1) && options.verseOverride !== undefined && book.chapterCount === 1) chapter = 1
        if (!(chapter >= 1)) return

        const verseRaw = options.verseOverride ?? groups.v1 ?? groups.v2 ?? groups.v3 ?? groups.v4 ?? (groups.imp !== undefined ? groups.v5 : undefined)
        const hasVerse = verseRaw !== undefined
        let verseStart = 1
        let verseEnd = 1
        let unglued = false
        if (hasVerse) {
            verseStart = parseNumberToken(verseRaw)
            if (!(verseStart >= 1)) return
            const endRaw = groups.e1 ?? groups.e3 ?? groups.e4
            verseEnd = endRaw !== undefined ? parseInt(endRaw, 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart
        } else if (groups.cC !== undefined) {
            // a plain "book N" with no separator - the single number may be chapter+verse run together
            const split = splitGluedReference(chapter, book.chapterCount)
            if (split) {
                chapter = split.chapter
                verseStart = split.verse
                verseEnd = split.verse
                unglued = true
            }
        }

        // an ordinary-English alias ("look", "dude") only counts inside a full reference
        if (book.requireVerse && !hasVerse && !unglued) return

        // verse bounds (from AlloDel's #3): a verse the chapter does not have is a misheard
        // number, not a reference - drop it rather than project the wrong text. A range that
        // overruns is clamped, because its start is real. Non-canon books (chapterCount 0)
        // skip the check entirely
        if ((hasVerse || unglued) && book.chapterCount > 0) {
            const chapterLength = maxVerseInChapter(book.number, chapter)
            if (chapterLength > 0) {
                if (verseStart > chapterLength) return
                if (verseEnd > chapterLength) verseEnd = chapterLength
            }
        }

        const quote = match[0].slice(match[1].length)

        // CUE RULE: "high" only with an explicit cue in the spoken text - the word "chapter"/"verse", an ordinal/numbered
        // book prefix ("first john"/"1 john") or a digit:digit shape ("3:16"). normalizeSpokenNumbers() never introduces any
        // of these words (its digit ordinals land only where the shape already carried the cue), so checking the
        // normalized snippet reflects the original text.
        const hasCue = options.alwaysCued || /\bchapter\b|\bverses?\b/.test(quote) || /\d:\d/.test(quote) || /^[1-3]\b/.test(bookToken)

        // book + chapter + verse ("matthew 12 4"), the same pair run together ("deuteronomy 818") or a cued
        // chapter ("turn to matthew chapter 5") is deliberate spoken intent - "high" so auto mode projects it.
        // only a bare "bookname 15" ("he acts 15 years old") stays "medium" and waits for confirmation
        const confidence: "high" | "medium" | "low" = hasVerse || unglued || hasCue ? "high" : "medium"

        results.push({ bookNumber: book.number, book: book.name, chapter, verseStart, verseEnd, confidence, quote })
        if (options.claimSpan) claimedSpans.push({ from: match.index, to: match.index + match[0].length })
    }

    const scan = (regex: RegExp | null, handle: (match: RegExpExecArray) => void) => {
        if (!regex) return
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(normalized)) !== null) handle(match)
    }

    scan(index.verseFirstRegex, (match) => {
        const groups = (match.groups || {}) as ReferenceGroups
        pushMatch(match, { claimSpan: true, alwaysCued: true, verseOverride: groups.vA ?? groups.vB })
    })
    scan(index.chapterFirstRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match, { claimSpan: true, alwaysCued: true })
    })
    scan(index.psalmOrdinalRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match, { claimSpan: true, alwaysCued: true })
    })
    scan(index.singleChapterVerseRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        const groups = (match.groups || {}) as ReferenceGroups
        // only chapterCount === 1 books resolve here (pushMatch fills chapter 1) - "john verse 16"
        // falls through untouched for the anchored bare-verse path
        pushMatch(match, { claimSpan: true, verseOverride: groups.vB })
    })
    scan(index.regex, (match) => {
        const bookAt = match.index + match[1].length
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match)
    })

    return results
}

export function detectExplicitReferences(text: string, books: AiScriptureBook[]): { bookNumber: number; book: string; chapter: number; verseStart: number; verseEnd: number; confidence: "high" | "medium" | "low" }[] {
    return matchReferences(text, buildBookIndex(books)).map((match) => ({ bookNumber: match.bookNumber, book: match.book, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence }))
}

// COORDINATOR

// the anchor passage: what is live on the output right now - bare "verse N" mentions resolve against it
export interface AiScriptureAnchor {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
}

// cue-gated: the word "verse(s)" with the number AFTER it is required, so "he has fifteen verses" never fires
// "verse 5", "verse number 5", "the 5th verse" - a range may follow ("verses 3 to 5", "3 and 4");
// "and" as a range word is safe here because the verse word is present by construction
const BARE_VERSE_REGEX = /(^|[^a-z0-9])((?:the\s+)?(?:verses?\s+(?:number\s+)?(?<n1>\d{1,3})\b|(?<n2>\d{1,3})(?:st|nd|rd|th)\s+verses?\b)(?:\s*(?:-|–|to\b|through\b|and\b|till\b|until\b)\s*(?<end>\d{1,3})\b)?)/g

interface TranscriptSegment {
    text: string
    startMs: number
    endMs: number
}

interface EmittedReference {
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    timestamp: number
}

interface DetectionCandidate {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    type: "explicit" | "quoted"
    quote?: string
}

interface DetectionCoordinatorOptions {
    books: AiScriptureBook[]
    llm: { provider: string; model: string } | null
    getApiKey: (providerId: string) => string
    onDetection: (ref: DetectedReference) => void
    onStatus: (state: AiScriptureState, extra?: { message?: string; keyless?: boolean }) => void
    cooldownSeconds?: number
}

const ROLLING_MAX_MS = 90000 // rolling transcript cap
const ROLLING_MAX_CHARS = 2000
const TIER1_WINDOW_MS = 15000 // tier 1 only rescans the most recent speech
const LLM_MIN_NEW_WORDS = 15 // don't call the LLM again until this much new speech arrived
const LLM_ALREADY_DETECTED_MS = 180000 // recently emitted refs sent to the LLM so it skips them
const DEFAULT_COOLDOWN_SECONDS = 90 // suppress re-emitting an intersecting reference within this window

export class DetectionCoordinator {
    private opts: DetectionCoordinatorOptions
    private bookIndex: BookIndex
    private cooldownMs: number

    // a single replaced anchor object - strictly bounded, never accumulates over a long sermon
    private anchor: AiScriptureAnchor | null = null
    private anchorBookPrefix: RegExp | null

    private segments: TranscriptSegment[] = []
    private emitted = new Map<string, EmittedReference[]>() // key: "bookNumber.chapter"
    private idCounter = 0
    private stopped = false

    // tier 2 state
    private totalWords = 0
    private wordsAtLastLlmCall = 0
    private llmController: AbortController | null = null
    private llmCallStartedAt = 0
    private llmRerunPending = false // new speech arrived while a call was in flight: re-run once it settles
    private llmStopped = false
    private llmPermanentFailures = 0 // consecutive permanent-class errors - two stop tier 2
    private llmCooldownUntil = 0

    constructor(opts: DetectionCoordinatorOptions) {
        this.opts = opts
        this.bookIndex = buildBookIndex(opts.books)
        this.anchorBookPrefix = this.bookIndex.bookPattern ? new RegExp("(?:^|[^a-z0-9])(?:" + this.bookIndex.bookPattern + ")[,.]?\\s+$") : null
        this.cooldownMs = (opts.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000
    }

    // replace the anchor passage (what is live on the output right now)
    /** The provider was (re)configured mid-session - arm tier 2 fresh, clearing any pause/backoff. */
    updateLlm(llm: DetectionCoordinatorOptions["llm"]): void {
        this.opts.llm = llm
        this.llmStopped = false
        this.llmPermanentFailures = 0
        this.llmCooldownUntil = 0
    }

    updateContext(ctx: AiScriptureAnchor): void {
        this.anchor = ctx
    }

    onTranscriptSegment(segment: { text: string; startMs: number; endMs: number }): void {
        if (this.stopped) return

        this.segments.push(segment)
        this.totalWords += countWords(segment.text)
        this.trimRollingTranscript()

        this.runTier1()
        this.maybeRunTier2()
    }

    stop(): void {
        this.stopped = true
        this.llmRerunPending = false
        if (this.llmController) {
            this.llmController.abort()
            this.llmController = null
        }
        this.segments = []
        this.emitted.clear()
    }

    // TIER 1

    private runTier1() {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        const windowText = this.segments
            .filter((segment) => segment.endMs >= newestEnd - TIER1_WINDOW_MS)
            .map((segment) => segment.text)
            .join(" ")

        matchReferences(windowText, this.bookIndex).forEach((match) => {
            this.tryEmit({ book: match.book, bookNumber: match.bookNumber, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence, type: "explicit", quote: match.quote }, "regex")
        })

        this.runAnchorTier1(windowText)
    }

    // bare "verse N" / "verses N to M" mentions (no book named) resolve against the anchor passage
    private runAnchorTier1(windowText: string) {
        const anchor = this.anchor
        if (!anchor) return

        const normalized = normalizeSpokenNumbers(windowText)

        // spans already matched as full references - the "verse 16" inside "john chapter 3 verse 16" is not anchor-relative
        const covered: [number, number][] = []
        if (this.bookIndex.regex) {
            this.bookIndex.regex.lastIndex = 0
            let full: RegExpExecArray | null
            while ((full = this.bookIndex.regex.exec(normalized)) !== null) covered.push([full.index, full.index + full[0].length])
        }

        BARE_VERSE_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = BARE_VERSE_REGEX.exec(normalized)) !== null) {
            const start = match.index + match[1].length
            if (covered.some(([from, to]) => start >= from && start < to)) continue
            // a book name directly before makes it a partial explicit reference ("john verse 7"), not an anchor-relative one
            if (this.anchorBookPrefix?.test(normalized.slice(0, start))) continue

            const groups = (match.groups || {}) as { n1?: string; n2?: string; end?: string }
            const verseStart = parseInt(groups.n1 ?? groups.n2 ?? "", 10)
            if (!(verseStart >= 1)) continue
            let verseEnd = groups.end !== undefined ? parseInt(groups.end, 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart

            // the anchor is the chapter live on screen, so a bare verse mention is context-certain
            this.tryEmit({ book: anchor.book, bookNumber: anchor.bookNumber, chapter: anchor.chapter, verseStart, verseEnd, confidence: "high", type: "explicit", quote: match[2] }, "regex")
        }
    }

    // TIER 2 - single flight, newest transcript wins once the in-flight call settles

    private maybeRunTier2() {
        const llm = this.opts.llm
        if (!llm || this.llmStopped) return

        // a call is in flight: never abort it just because new speech arrived (during continuous speech that would starve
        // tier 2 completely) - mark a re-run so the fresh transcript is analyzed as soon as the call settles.
        // only calls stuck past the request timeout are aborted & replaced right away
        if (this.llmController) {
            if (Date.now() - this.llmCallStartedAt <= LLM_API_TIMEOUT) {
                this.llmRerunPending = true
                return
            }
            this.llmController.abort()
            this.llmController = null
        }

        if (Date.now() < this.llmCooldownUntil) return
        if (this.totalWords - this.wordsAtLastLlmCall < LLM_MIN_NEW_WORDS) return

        const apiKey = this.opts.getApiKey(llm.provider)
        if (!apiKey) return

        this.wordsAtLastLlmCall = this.totalWords
        const controller = new AbortController()
        this.llmController = controller
        this.llmCallStartedAt = Date.now()

        const transcript = this.segments.map((segment) => segment.text).join(" ")
        const liveContext = this.anchor ? "Live on screen: " + this.anchor.book + " " + this.anchor.chapter + ":" + this.anchor.verseStart + "-" + this.anchor.verseEnd + ". Bare verse mentions likely refer to this passage." : undefined
        Promise.resolve()
            .then(() => getLLMScriptureProvider(llm.provider as any).detectScripture(apiKey, llm.model, { transcript, alreadyDetected: this.recentDetectionStrings(), liveContext }, controller.signal))
            .then(
                (result: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.llmPermanentFailures = 0 // a working provider clears the strike count
                    this.handleLlmReferences(Array.isArray(result?.references) ? result.references : [])
                    this.runPendingRerun()
                },
                (err: any) => {
                    if (this.llmController !== controller) return // aborted/superseded
                    this.llmController = null
                    this.handleLlmError(err)
                    this.runPendingRerun()
                }
            )
    }

    // speech arrived while the last call was in flight: immediately analyze the fresh transcript
    // (maybeRunTier2 re-checks the cooldown/new-words conditions & whether tier 2 was stopped meanwhile)
    private runPendingRerun() {
        if (!this.llmRerunPending) return
        this.llmRerunPending = false
        if (!this.stopped) this.maybeRunTier2()
    }

    private handleLlmReferences(references: any[]) {
        references.forEach((raw: any) => {
            const chapter = Math.floor(Number(raw?.chapter))
            const verseStart = Math.floor(Number(raw?.verseStart))
            if (!Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(verseStart) || verseStart < 1) return

            let verseEnd = Math.floor(Number(raw?.verseEnd))
            if (!Number.isFinite(verseEnd) || verseEnd < verseStart) verseEnd = verseStart

            // resolve the book against the active book table first, fall back to the canon book number
            const rawName = String(raw?.book || "").trim()
            const nameMatch = this.bookIndex.byToken.get(rawName.toLowerCase().replace(/\s+/g, " "))
            const bookNumber = nameMatch ? nameMatch.number : Math.floor(Number(raw?.bookNumber))
            if (!nameMatch && (!Number.isFinite(bookNumber) || bookNumber < 1 || bookNumber > 66)) return

            const confidence: "high" | "medium" | "low" = raw?.confidence === "high" || raw?.confidence === "low" ? raw.confidence : "medium"
            const type: "explicit" | "quoted" = raw?.type === "quoted" ? "quoted" : "explicit"
            const quote = typeof raw?.quote === "string" && raw.quote ? raw.quote : undefined

            this.tryEmit({ book: nameMatch ? nameMatch.name : rawName, bookNumber, chapter, verseStart, verseEnd, confidence, type, quote }, "llm")
        })
    }

    private handleLlmError(err: any) {
        const code = err?.code

        // permanent-class errors will not fix themselves - bad key, unknown model, malformed
        // request. But providers occasionally return one as a transient blip, and a single
        // misclassified error must not kill tier 2 for a whole service - it takes TWO in a row
        // (a genuinely broken setup repeats on the very next window anyway). Tier 1 keeps running
        if (code === "invalid_key" || code === "forbidden" || code === "model_not_found" || code === "invalid_request") {
            this.llmPermanentFailures++
            console.error(`[AiScripture] LLM ${String(code)}:`, err?.message || "")
            if (this.llmPermanentFailures >= 2) {
                this.llmStopped = true
                // name the provider & model - a bare code ("model_not_found") is undiagnosable
                const target = this.opts.llm ? ` (${this.opts.llm.provider}: ${this.opts.llm.model || "default model"})` : ""
                this.opts.onStatus("llm_paused", { message: (err?.message || String(code)) + target })
            }
            return
        }

        if (code === "rate_limited") {
            const retryAfter = typeof err?.retryAfter === "number" && Number.isFinite(err.retryAfter) && err.retryAfter > 0 ? err.retryAfter : 15
            this.llmCooldownUntil = Date.now() + Math.min(retryAfter, 60) * 1000
            return
        }

        // timeout/network/server_error/bad_response/refusal: just skip this window & keep going
    }

    // EMISSION

    private tryEmit(candidate: DetectionCandidate, source: "regex" | "llm") {
        const now = Date.now()
        const key = candidate.bookNumber + "." + candidate.chapter
        const keepMs = Math.max(this.cooldownMs, LLM_ALREADY_DETECTED_MS)
        const entries = (this.emitted.get(key) || []).filter((entry) => now - entry.timestamp < keepMs)

        // suppress when it intersects (same book+chapter and overlapping verse range) a reference emitted within the cooldown
        const suppressed = entries.some((entry) => now - entry.timestamp < this.cooldownMs && candidate.verseStart <= entry.verseEnd && candidate.verseEnd >= entry.verseStart)
        if (!suppressed) {
            entries.push({ book: candidate.book, chapter: candidate.chapter, verseStart: candidate.verseStart, verseEnd: candidate.verseEnd, timestamp: now })
            this.opts.onDetection({
                id: "ai-" + now.toString(36) + "-" + (this.idCounter++).toString(36),
                book: candidate.book,
                bookNumber: candidate.bookNumber,
                chapter: candidate.chapter,
                verseStart: candidate.verseStart,
                verseEnd: candidate.verseEnd,
                confidence: candidate.confidence,
                type: candidate.type,
                source,
                quote: candidate.quote,
                timestamp: now
            })
        }

        this.emitted.set(key, entries)
    }

    private recentDetectionStrings(): string[] {
        const now = Date.now()
        const recent: string[] = []
        this.emitted.forEach((entries) => {
            entries.forEach((entry) => {
                if (now - entry.timestamp < LLM_ALREADY_DETECTED_MS) recent.push(entry.book + " " + entry.chapter + ":" + entry.verseStart + "-" + entry.verseEnd)
            })
        })
        return recent
    }

    // ROLLING TRANSCRIPT

    private trimRollingTranscript() {
        const newestEnd = this.segments[this.segments.length - 1].endMs
        while (this.segments.length > 1 && this.segments[0].endMs < newestEnd - ROLLING_MAX_MS) this.segments.shift()

        let chars = this.segments.reduce((total, segment) => total + segment.text.length, 0)
        while (this.segments.length > 1 && chars > ROLLING_MAX_CHARS) {
            chars -= this.segments[0].text.length
            this.segments.shift()
        }
    }
}

function countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
}

// DATA

// chapters per book of the 66 book canon, keyed by canon book number. Fixed across translations, so it can be
// a table instead of 66 async book loads - used to tell a spoken chapter from a chapter+verse pair the speech
// engine ran together ("deuteronomy 8 18" transcribed as "deuteronomy 818" - 818 is not a chapter of a 34 chapter book)
const CANON_CHAPTER_COUNTS: { [canonNumber: number]: number } = {
    1: 50,
    2: 40,
    3: 27,
    4: 36,
    5: 34,
    6: 24,
    7: 21,
    8: 4,
    9: 31,
    10: 24,
    11: 22,
    12: 25,
    13: 29,
    14: 36,
    15: 10,
    16: 13,
    17: 10,
    18: 42,
    19: 150,
    20: 31,
    21: 12,
    22: 8,
    23: 66,
    24: 52,
    25: 5,
    26: 48,
    27: 12,
    28: 14,
    29: 3,
    30: 9,
    31: 1,
    32: 4,
    33: 7,
    34: 3,
    35: 3,
    36: 3,
    37: 2,
    38: 14,
    39: 4,
    40: 28,
    41: 16,
    42: 24,
    43: 21,
    44: 28,
    45: 16,
    46: 16,
    47: 13,
    48: 6,
    49: 6,
    50: 4,
    51: 4,
    52: 5,
    53: 3,
    54: 6,
    55: 4,
    56: 3,
    57: 1,
    58: 13,
    59: 5,
    60: 5,
    61: 3,
    62: 5,
    63: 1,
    64: 1,
    65: 1,
    66: 22
}

// the longest chapter in the bible (Psalm 119) - an upper bound on a plausible verse number
const MAX_VERSE_NUMBER = 176
