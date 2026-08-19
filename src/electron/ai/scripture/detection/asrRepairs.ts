// ASR BOOK NAME CONFUSIONS (from AlloDel's live-service observations)
// A streaming model finalizes a book name before it is finished, or hears a common word
// instead of it. An alias whose word is also ordinary English needs an explicit verse
// before it counts, so normal speech ("he acts his age", "look at this") cannot trigger.
// Aliases are only added for books the loaded bible actually has.
export const ASR_BOOK_ALIASES: { alias: string; canonNumber: number; requireVerse: boolean }[] = [
    // AlloDel's live-observed set
    { alias: "palm", canonNumber: 19, requireVerse: false }, // Psalms
    { alias: "palms", canonNumber: 19, requireVerse: false },
    { alias: "genes", canonNumber: 1, requireVerse: false }, // Genesis, cut off mid word
    { alias: "joan", canonNumber: 43, requireVerse: true }, // John
    { alias: "jon", canonNumber: 43, requireVerse: true },
    { alias: "axe", canonNumber: 44, requireVerse: true }, // Acts
    { alias: "ax", canonNumber: 44, requireVerse: true },
    { alias: "ask", canonNumber: 44, requireVerse: true },
    { alias: "look", canonNumber: 42, requireVerse: true }, // Luke
    { alias: "games", canonNumber: 59, requireVerse: true }, // James
    { alias: "roof", canonNumber: 8, requireVerse: true }, // Ruth
    { alias: "dude", canonNumber: 65, requireVerse: true }, // Jude
    { alias: "juice", canonNumber: 65, requireVerse: true },
    // extended: what a streaming model outputs is real English words/names, so each alias is
    // the actual word it substitutes. Anything that could be normal speech is verse-gated
    { alias: "genius", canonNumber: 1, requireVerse: true }, // Genesis
    { alias: "exit", canonNumber: 2, requireVerse: true }, // Exodus
    { alias: "josh", canonNumber: 6, requireVerse: true }, // Joshua
    { alias: "judge", canonNumber: 7, requireVerse: true }, // Judges
    { alias: "root", canonNumber: 8, requireVerse: true }, // Ruth
    { alias: "ester", canonNumber: 17, requireVerse: true }, // Esther
    { alias: "proverb", canonNumber: 20, requireVerse: true }, // Proverbs
    { alias: "jeremy", canonNumber: 24, requireVerse: true }, // Jeremiah
    { alias: "lamentation", canonNumber: 25, requireVerse: true }, // Lamentations
    { alias: "jose", canonNumber: 28, requireVerse: true }, // Hosea
    { alias: "hose", canonNumber: 28, requireVerse: true },
    { alias: "jewel", canonNumber: 29, requireVerse: true }, // Joel
    { alias: "mica", canonNumber: 33, requireVerse: true }, // Micah
    { alias: "matt", canonNumber: 40, requireVerse: true }, // Matthew
    { alias: "duke", canonNumber: 42, requireVerse: true }, // Luke
    { alias: "romance", canonNumber: 45, requireVerse: true }, // Romans
    { alias: "roman", canonNumber: 45, requireVerse: true },
    { alias: "corinthian", canonNumber: 46, requireVerse: true }, // 1 Corinthians (spoken bare)
    { alias: "galatian", canonNumber: 48, requireVerse: true }, // Galatians
    { alias: "ephesian", canonNumber: 49, requireVerse: true }, // Ephesians
    { alias: "colossian", canonNumber: 51, requireVerse: true }, // Colossians
    { alias: "collisions", canonNumber: 51, requireVerse: true },
    { alias: "hebrew", canonNumber: 58, requireVerse: true }, // Hebrews
    { alias: "revelations", canonNumber: 66, requireVerse: false }, // how the book is genuinely often said
    { alias: "revolution", canonNumber: 66, requireVerse: true }, // Revelation
    { alias: "revolutions", canonNumber: 66, requireVerse: true }
]

// BOOK-NAME MISHEARINGS
// whisper mangles long book names mid-word ("Corinthians" arrives as "Corinians", "Philippians"
// as "Philippines"), which breaks the exact-name regex above. A token close enough to exactly one
// book word is rewritten to it BEFORE the regex pass - the regex then demands the full reference
// shape (ordinal prefix, chapter number...) around it, so a rewrite alone never creates a match.

export const FUZZY_MIN_LEN = 6

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
