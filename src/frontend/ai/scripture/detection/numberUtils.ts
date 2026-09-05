const UNIT_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEEN_WORDS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

const ORDINAL_UNIT_WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 }
const ORDINAL_TEEN_WORDS: Record<string, number> = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19 }
const ORDINAL_TENS_WORDS: Record<string, number> = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 }

export const ORDINAL_PREFIXES: Record<string, string> = { first: "1", second: "2", third: "3" }
export const CHAPTER_VERSE_PSALM_REGEX = /^(?:chapter|verses?|psalms?)$/

const NUMBER_HOMOPHONES: Record<string, number> = { for: 4, won: 1, tree: 3, ate: 8 }
export const HOMOPHONE_ALT = `(?:${Object.keys(NUMBER_HOMOPHONES).join("|")})(?=[\\s.,!?]*$)`

export function parseNumberToken(raw: string): number {
    return NUMBER_HOMOPHONES[raw] ?? parseInt(raw, 10)
}

interface SpokenToken {
    prefix: string
    core: string
    suffix: string
}

function toToken(raw: string): SpokenToken {
    const match = raw.match(/^([^a-z0-9]*)(.*?)([^a-z0-9]*)$/)
    return match ? { prefix: match[1], core: match[2], suffix: match[3] } : { prefix: "", core: raw, suffix: "" }
}

function readOrdinalWord(core: string): number | null {
    const val = ORDINAL_UNIT_WORDS[core] ?? ORDINAL_TEEN_WORDS[core] ?? ORDINAL_TENS_WORDS[core]
    if (val !== undefined) return val
    const [tens, units] = core.split("-")
    return TENS_WORDS[tens] !== undefined && ORDINAL_UNIT_WORDS[units] !== undefined ? TENS_WORDS[tens] + ORDINAL_UNIT_WORDS[units] : null
}

function ordinalSuffix(value: number): string {
    if (Math.floor(value / 10) % 10 === 1) return "th"
    const unit = value % 10
    return unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"
}

function readTens(tokens: SpokenToken[], i: number): { value: number; end: number } | null {
    const token = tokens[i]
    if (!token) return null

    const [tens, units] = token.core.split("-")
    if (TENS_WORDS[tens] !== undefined && UNIT_WORDS[units] !== undefined) {
        return { value: TENS_WORDS[tens] + UNIT_WORDS[units], end: i + 1 }
    }

    if (TENS_WORDS[token.core] !== undefined) {
        const next = tokens[i + 1]
        if (!token.suffix && next && !next.prefix && UNIT_WORDS[next.core] !== undefined) {
            return { value: TENS_WORDS[token.core] + UNIT_WORDS[next.core], end: i + 2 }
        }
        return { value: TENS_WORDS[token.core], end: i + 1 }
    }

    const simpleVal = TEEN_WORDS[token.core] ?? UNIT_WORDS[token.core]
    return simpleVal !== undefined ? { value: simpleVal, end: i + 1 } : null
}

function isCue(token?: SpokenToken): boolean {
    return !!token && CHAPTER_VERSE_PSALM_REGEX.test(token.core)
}

function shouldConvertBookPrefix(token: SpokenToken, next?: SpokenToken): boolean {
    return !token.suffix && !!next && !next.prefix && /^[a-z]/.test(next.core) && !isCue(next)
}

export function normalizeSpokenNumbers(text: string): string {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean).map(toToken)
    const out: string[] = []
    let i = 0

    while (i < tokens.length) {
        const token = tokens[i]
        const next = tokens[i + 1]
        const after = tokens[i + 2]

        // Spoken ordinals before "chapter"/"verse"/"psalm"
        if (!token.suffix && next && !next.prefix && isCue(next)) {
            const ordinal = readOrdinalWord(token.core)
            if (ordinal !== null) {
                out.push(`${token.prefix}${ordinal}${ordinalSuffix(ordinal)}`)
                i++
                continue
            }
        }

        // Spaced ordinal compounds ("twenty third psalm")
        if (!token.suffix && next && !next.prefix && !next.suffix && TENS_WORDS[token.core] !== undefined && ORDINAL_UNIT_WORDS[next.core] !== undefined && after && !after.prefix && isCue(after)) {
            const value = TENS_WORDS[token.core] + ORDINAL_UNIT_WORDS[next.core]
            out.push(`${token.prefix}${value}${ordinalSuffix(value)}`)
            i += 2
            continue
        }

        // Ordinal book prefixes ("first john" -> "1 john")
        const digitOrdinal = /^([1-3])(?:st|nd|rd)$/.exec(token.core)
        if ((digitOrdinal || ORDINAL_PREFIXES[token.core]) && shouldConvertBookPrefix(token, next)) {
            const digit = digitOrdinal ? digitOrdinal[1] : ORDINAL_PREFIXES[token.core]
            out.push(`${token.prefix}${digit}`)
            i++
            continue
        }

        const small = readTens(tokens, i)
        if (!small) {
            out.push(`${token.prefix}${token.core}${token.suffix}`)
            i++
            continue
        }

        let { value, end } = small

        // Hundreds parsing: "<unit> hundred [and <1-99>]"
        if (value >= 1 && value <= 9 && !tokens[end - 1].suffix && tokens[end] && !tokens[end].prefix && tokens[end].core === "hundred") {
            value *= 100
            end++
            let k = end
            if (!tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix && !tokens[k].suffix && tokens[k].core === "and" && tokens[k + 1] && !tokens[k + 1].prefix && readTens(tokens, k + 1)) {
                k++
            }
            const remainder = !tokens[k - 1].suffix && tokens[k] && !tokens[k].prefix ? readTens(tokens, k) : null
            if (remainder) {
                value += remainder.value
                end = remainder.end
            }
        }

        out.push(`${tokens[i].prefix}${value}${tokens[end - 1].suffix}`)
        i = end
    }

    return out.join(" ")
}
