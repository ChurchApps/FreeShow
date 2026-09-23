import { COMPOUND_CONNECTORS, HUNDREDS_WORDS, MULTILINGUAL_RANGE_WORDS, ORDINAL_UNIT_WORDS, REVERSE_COMPOUND_CONNECTORS, REVERSE_COMPOUND_TENS, REVERSE_COMPOUND_UNITS, SPECIAL_COMPLEX_NUMBERS, TEEN_WORDS, TENS_WORDS, UNIT_WORDS } from "./numberDictionary"

// Combined maps for single word replacements
export const ALL_NUMBER_WORDS: Record<string, number> = {
    ...UNIT_WORDS,
    ...TEEN_WORDS,
    ...TENS_WORDS,
    ...ORDINAL_UNIT_WORDS,
    ...HUNDREDS_WORDS,
    ...SPECIAL_COMPLEX_NUMBERS
}

const TENS_KEYS = Object.keys(TENS_WORDS)
    .sort((a, b) => b.length - a.length)
    .join("|")
const UNITS_KEYS = [...new Set([...Object.keys(UNIT_WORDS), ...Object.keys(ORDINAL_UNIT_WORDS)])].sort((a, b) => b.length - a.length).join("|")
const CONNECTOR_PATTERN = COMPOUND_CONNECTORS.join("|")

const RANGE_WORD_PATTERN = MULTILINGUAL_RANGE_WORDS.sort((a, b) => b.length - a.length).join("|")
const RANGE_REGEX = new RegExp(`\\b(\\d+)\\s*[,:]?\\s*(?:${RANGE_WORD_PATTERN})\\s*(\\d+)\\b`, "giu")

const COMPOUND_REGEX = new RegExp(`\\b(${TENS_KEYS})(?:[\\s-]+(?:${CONNECTOR_PATTERN})[\\s-]+|[\\s-]*)(${UNITS_KEYS})\\b`, "giu")

// German / Dutch / Norwegian reverse compounds like "einundzwanzig" (21), "eenentwintig" (21), "enogtjue" (21)
const REVERSE_UNITS_KEYS = REVERSE_COMPOUND_UNITS.join("|")
const REVERSE_TENS_KEYS = REVERSE_COMPOUND_TENS.join("|")
const REVERSE_CONNECTORS = REVERSE_COMPOUND_CONNECTORS.join("|")
const REVERSE_COMPOUND_REGEX = new RegExp(`\\b(${REVERSE_UNITS_KEYS})(?:${REVERSE_CONNECTORS})(${REVERSE_TENS_KEYS})\\b`, "giu")

// Special complex multi-word numbers sorted by length descending
const SPECIAL_KEYS = Object.keys(SPECIAL_COMPLEX_NUMBERS).sort((a, b) => b.length - a.length)
const SPECIAL_COMPLEX_REGEX = new RegExp(`\\b(${SPECIAL_KEYS.join("|")})\\b`, "giu")

// Sorted all numbers regex for single word replacement
const SORTED_NUMBER_WORDS = Object.keys(ALL_NUMBER_WORDS).sort((a, b) => b.length - a.length)
const SINGLE_NUMBER_REGEX = new RegExp(`\\b(${SORTED_NUMBER_WORDS.join("|")})\\b`, "giu")

const HUNDRED_WORD_KEYS = Object.keys(HUNDREDS_WORDS)
    .sort((a, b) => b.length - a.length)
    .join("|")
const MULTIPLIER_WORDS = [...Object.keys(UNIT_WORDS), ...Object.keys(ORDINAL_UNIT_WORDS)].sort((a, b) => b.length - a.length).join("|")

// Hundred regex: matches "2 cent 16", "deux cents seize", "to hundre og seksten", "one hundred and nineteen", etc.
const HUNDRED_PATTERN = new RegExp(`\\b(?:(\\d+|${MULTIPLIER_WORDS})\\s*)?(${HUNDRED_WORD_KEYS})\\s*(?:(?:${CONNECTOR_PATTERN})\\s*)?(\\d+|${SORTED_NUMBER_WORDS.join("|")})?\\b`, "giu")

export function normalizeNumbers(text: string): string {
    let normalized = text.toLowerCase()

    // 1. Normalize "hundred" numbers (e.g., "deux cent seize" -> "216", "one hundred and nineteen" -> "119")
    normalized = normalized.replace(HUNDRED_PATTERN, (_match, hundredMultiplier, hundredWord, remainder) => {
        const baseHundredVal = HUNDREDS_WORDS[hundredWord.toLowerCase()] || 100
        let mult = 1
        if (hundredMultiplier) {
            mult = ALL_NUMBER_WORDS[hundredMultiplier.toLowerCase()] || parseInt(hundredMultiplier, 10) || 1
        }

        let rem = 0
        if (remainder) {
            rem = ALL_NUMBER_WORDS[remainder.toLowerCase()] || parseInt(remainder, 10) || 0
        }

        // If baseHundredVal already includes multiplier (e.g. doscientos = 200), don't multiply again
        const hundredTotal = baseHundredVal >= 200 ? baseHundredVal : mult * baseHundredVal
        return (hundredTotal + rem).toString()
    })

    // 2. Normalize special complex numbers (e.g. French "soixante-seize" -> 76, "quatre-vingt-dix-neuf" -> 99)
    normalized = normalized.replace(SPECIAL_COMPLEX_REGEX, (match) => {
        const val = SPECIAL_COMPLEX_NUMBERS[match.toLowerCase()]
        return val !== undefined ? val.toString() : match
    })

    // 3. Normalize German / Dutch / Norwegian reverse compounds (e.g. "einundzwanzig" -> "21", "eenentwintig" -> "21", "enogtjue" -> "21")
    normalized = normalized.replace(REVERSE_COMPOUND_REGEX, (_, unit, tens) => {
        const unitVal = UNIT_WORDS[unit.toLowerCase()] || 0
        const tensVal = TENS_WORDS[tens.toLowerCase()] || 0
        return (tensVal + unitVal).toString()
    })

    // 4. Normalize standard compound tens + units (e.g., "twenty five" -> "25", "vingt-trois" -> "23", "treinta y cinco" -> "35")
    normalized = normalized.replace(COMPOUND_REGEX, (_, tens, units) => {
        const tensVal = TENS_WORDS[tens.toLowerCase()] || 0
        const unitsVal = UNIT_WORDS[units.toLowerCase()] || ORDINAL_UNIT_WORDS[units.toLowerCase()] || 0
        return (tensVal + unitsVal).toString()
    })

    // 5. Convert single-word cardinal and ordinal numbers ("trois" -> "3", "seize" -> "16", "eighth" -> "8")
    normalized = normalized.replace(SINGLE_NUMBER_REGEX, (match) => {
        const val = ALL_NUMBER_WORDS[match.toLowerCase()]
        return val !== undefined ? val.toString() : match
    })

    // 6. Normalize range keyword patterns (e.g., "1 through 6" -> "1-6", "1 à 6" -> "1-6", "1 bis 6" -> "1-6")
    normalized = normalized.replace(RANGE_REGEX, "$1-$2")

    return normalized
}
