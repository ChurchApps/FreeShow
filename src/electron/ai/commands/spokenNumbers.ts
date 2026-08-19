// SPOKEN NUMBERS
// lowercasing & digit-normalization of spoken numbers ("three sixteen" -> "3 16") and the
// number homophones streaming ASR substitutes for them - shared by scripture reference
// detection and the voice-command matchers, and generic enough for any future voice feature

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

// spoken verse numbers arrive as their homophones ("Matthew 4 four" -> "Matthew 4 for").
// These are everyday function words, so they only count in the verse slot AND when the utterance
// ends right there - "matthew 4 for" is a reference, "matthew 4 for our reading today" keeps talking
export const NUMBER_HOMOPHONES: { [word: string]: number } = { for: 4, won: 1, tree: 3, ate: 8 }
export const HOMOPHONE_ALT = "(?:" + Object.keys(NUMBER_HOMOPHONES).join("|") + ")(?=[\\s.,!?]*$)"

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
