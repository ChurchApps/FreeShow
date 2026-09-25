// Spoken reference keyword dictionaries for primary Nemotron languages:
// English, French, Spanish, German, Portuguese, Italian, Dutch, Norwegian

export const CHAPTER_KEYWORDS = ["chapter", "chapitre", "capítulo", "capitulo", "kapitel", "capitolo", "hoofdstuk", "kapittel"]

export const VERSE_KEYWORDS = ["verses", "verse", "versets", "verset", "versículos", "versículo", "versiculos", "versiculo", "versetti", "versetto", "versen", "vers"]

export const JOINER_KEYWORDS = ["and", "et", "y", "und", "e", "en", "og"]

export const RANGE_KEYWORDS = ["through", "to", "jusqu'à", "hasta", "bis", "tot", "til", "à"]

// Spoken ordinal prefixes for numbered books (e.g., "Premier Jean", "Første Johannes", "First Corinthians")
export const BOOK_ORDINAL_PREFIX_MAP: Record<string, number> = {
    // 1st
    first: 1,
    premier: 1,
    première: 1,
    primer: 1,
    primero: 1,
    primera: 1,
    primeiro: 1,
    primeira: 1,
    erste: 1,
    erster: 1,
    eerste: 1,
    første: 1,
    forste: 1,
    primo: 1,
    prima: 1,

    // 2nd
    second: 2,
    seconde: 2,
    deuxième: 2,
    segundo: 2,
    segunda: 2,
    zweite: 2,
    zweiter: 2,
    tweede: 2,
    andre: 2,
    annen: 2,

    // 3rd
    third: 3,
    troisième: 3,
    tercer: 3,
    tercero: 3,
    tercera: 3,
    terceiro: 3,
    terceira: 3,
    dritte: 3,
    dritter: 3,
    derde: 3,
    tredje: 3,
    terzo: 3,
    terza: 3
}

export const ORDINAL_BOOK_PREFIXES = Object.keys(BOOK_ORDINAL_PREFIX_MAP)

export function normalizeBookName(rawBookName: string): string {
    const trimmed = rawBookName.trim()
    const sortedPrefixes = Object.keys(BOOK_ORDINAL_PREFIX_MAP).sort((a, b) => b.length - a.length)
    const prefixRegex = new RegExp(`^(?:${sortedPrefixes.join("|")})\\b[\\s,.-]*`, "iu")

    return trimmed.replace(prefixRegex, (match) => {
        const key = match
            .trim()
            .replace(/[,.-]$/, "")
            .toLowerCase()
        const digit = BOOK_ORDINAL_PREFIX_MAP[key]
        return digit !== undefined ? `${digit} ` : match
    })
}

export const PREPOSITIONS_OF = ["of", "de", "du", "del", "von", "van", "av", "di"]

export const ARTICLES_THE = ["the", "le", "la", "les", "el", "der", "die", "das", "den", "det", "il", "de", "het"]

export const PSALM_NORMALIZATION_MAP: Record<string, string> = {
    psalms: "Psalm",
    psaumes: "Psaume",
    salmos: "Salmo",
    psalmen: "Psalm",
    salmer: "Salme",
    salmi: "Salmo"
}

// Regex pattern fragments
export const PSALM_PATTERN = "psalm|psaume|salmo|salme"
export const CHAPTER_PATTERN = CHAPTER_KEYWORDS.join("|")
export const VERSE_PATTERN = VERSE_KEYWORDS.join("|")
export const JOINER_PATTERN = JOINER_KEYWORDS.join("|")
export const RANGE_PATTERN = RANGE_KEYWORDS.join("|")
export const ORDINAL_PREFIX_PATTERN = ORDINAL_BOOK_PREFIXES.join("|")
export const OF_PATTERN = PREPOSITIONS_OF.join("|")
export const THE_PATTERN = ARTICLES_THE.join("|")
