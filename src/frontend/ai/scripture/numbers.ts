const UNIT_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEEN_WORDS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

const ORDINAL_UNIT_WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 }
const ORDINAL_TEEN_WORDS: Record<string, number> = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19 }
const ORDINAL_TENS_WORDS: Record<string, number> = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 }

const TENS_KEYS = [...Object.keys(TENS_WORDS), ...Object.keys(ORDINAL_TENS_WORDS)].join("|")
const UNITS_KEYS = [...Object.keys(UNIT_WORDS), ...Object.keys(ORDINAL_UNIT_WORDS)].join("|")

const RANGE_REGEX = /\b(\d+)\s*[,:]?\s*(?:through|to|till|until)\s*(\d+)\b/gi
const COMPOUND_REGEX = new RegExp(`\\b(${TENS_KEYS})[\\s-](${UNITS_KEYS})\\b`, "gi")

const ALL_NUMBER_WORDS: Record<string, number> = {
    ...UNIT_WORDS,
    ...TEEN_WORDS,
    ...TENS_WORDS,
    ...ORDINAL_UNIT_WORDS,
    ...ORDINAL_TEEN_WORDS,
    ...ORDINAL_TENS_WORDS
}

const SORTED_NUMBER_WORDS = Object.keys(ALL_NUMBER_WORDS).sort((a, b) => b.length - a.length)
const SINGLE_NUMBER_REGEX = new RegExp(`\\b(${SORTED_NUMBER_WORDS.join("|")})\\b`, "gi")

export function normalizeNumbers(text: string): string {
    let normalized = text.toLowerCase()

    // 1. Normalize "hundred" numbers (e.g., "1 hundred and 19" or "one hundred and nineteen" -> "119")
    normalized = normalized.replace(/\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine)\s+)?hundreds?\s*(?:and\s*)?(\d+|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|one|two|three|four|five|six|seven|eight|nine)?\b/gi, (_match, hundredMultiplier, remainder) => {
        let mult = 1
        if (hundredMultiplier) {
            mult = ALL_NUMBER_WORDS[hundredMultiplier.toLowerCase()] || parseInt(hundredMultiplier, 10) || 1
        }

        let rem = 0
        if (remainder) {
            rem = ALL_NUMBER_WORDS[remainder.toLowerCase()] || parseInt(remainder, 10) || 0
        }

        return (mult * 100 + rem).toString()
    })

    // 2. Normalize range keyword patterns (e.g., "1 through 6" -> "1-6")
    normalized = normalized.replace(RANGE_REGEX, "$1-$2")

    // 3. Convert compound tens + units ("twenty five" or "twentieth fifth" -> "25")
    normalized = normalized.replace(COMPOUND_REGEX, (_, tens, units) => {
        const tensVal = TENS_WORDS[tens] || ORDINAL_TENS_WORDS[tens]
        const unitsVal = UNIT_WORDS[units] || ORDINAL_UNIT_WORDS[units]
        return (tensVal + unitsVal).toString()
    })

    // 4. Convert single-word cardinal and ordinal numbers ("eighth" -> "8", "seven" -> "7")
    normalized = normalized.replace(SINGLE_NUMBER_REGEX, (match) => {
        return ALL_NUMBER_WORDS[match.toLowerCase()].toString()
    })

    return normalized
}
