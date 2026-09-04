export const ASR_BOOK_ALIASES: { alias: string; canonNumber: number }[] = [
    { alias: "palm", canonNumber: 19 },
    { alias: "palms", canonNumber: 19 },
    { alias: "genes", canonNumber: 1 },
    { alias: "joan", canonNumber: 43 },
    { alias: "jon", canonNumber: 43 },
    { alias: "axe", canonNumber: 44 },
    { alias: "ax", canonNumber: 44 },
    { alias: "ask", canonNumber: 44 },
    { alias: "look", canonNumber: 42 },
    { alias: "games", canonNumber: 59 },
    { alias: "roof", canonNumber: 8 },
    { alias: "dude", canonNumber: 65 },
    { alias: "juice", canonNumber: 65 },
    { alias: "genius", canonNumber: 1 },
    { alias: "exit", canonNumber: 2 },
    { alias: "josh", canonNumber: 6 },
    { alias: "judge", canonNumber: 7 },
    { alias: "root", canonNumber: 8 },
    { alias: "ester", canonNumber: 17 },
    { alias: "proverb", canonNumber: 20 },
    { alias: "jeremy", canonNumber: 24 },
    { alias: "lamentation", canonNumber: 25 },
    { alias: "jose", canonNumber: 28 },
    { alias: "hose", canonNumber: 28 },
    { alias: "jewel", canonNumber: 29 },
    { alias: "mica", canonNumber: 33 },
    { alias: "matt", canonNumber: 40 },
    { alias: "duke", canonNumber: 42 },
    { alias: "romance", canonNumber: 45 },
    { alias: "roman", canonNumber: 45 },
    { alias: "corinthian", canonNumber: 46 },
    { alias: "galatian", canonNumber: 48 },
    { alias: "ephesian", canonNumber: 49 },
    { alias: "colossian", canonNumber: 51 },
    { alias: "collisions", canonNumber: 51 },
    { alias: "hebrew", canonNumber: 58 },
    { alias: "revelations", canonNumber: 66 },
    { alias: "revolution", canonNumber: 66 },
    { alias: "revolutions", canonNumber: 66 }
]

export const FUZZY_MIN_LEN = 6

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
        if (rowMin > cap) return null
        previous = current
    }
    return previous[b.length] <= cap ? previous[b.length] : null
}

export function collapseStutteredBookNames(normalized: string, allBookWords: string[]): string {
    if (!allBookWords.length) return normalized

    return normalized.replace(/[a-z]{5,}/g, (token) => {
        for (const word of allBookWords) {
            if (token.length > word.length && token.startsWith(word) && word.endsWith(token.slice(word.length))) {
                return word
            }
        }
        return token
    })
}

export function correctBookMishearings(normalized: string, bookWords: string[]): string {
    if (!bookWords.length) return normalized

    return normalized.replace(/[a-z]{6,}/g, (token) => {
        if (bookWords.includes(token)) return token

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
            } else if (distance === bestDistance) {
                tied = true
            }
        }

        return best && !tied ? best : token
    })
}
