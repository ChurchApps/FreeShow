import { get } from "svelte/store"
import { ShowList } from "../../types/Show"
import { categories, drawerTabsData, textCache } from "../stores"
import { formatSearch, tokenize } from "./search"
import { sortObjectNumbers } from "../components/helpers/array"

// https://github.com/ChurchApps/FreeShow/pull/2790

// ==========================================
// INVERTED INDEX FOR O(1) WORD LOOKUPS
// ==========================================

interface IndexEntry {
    showId: string
    field: "name" | "content"
    frequency: number // How many times word appears
}

interface SearchIndex {
    wordIndex: Map<string, IndexEntry[]> // word -> [showId, field, freq]
    phraseIndex: Map<string, Set<string>> // 2-gram phrase -> Set<showId>
    showData: Map<string, { name: string; content: string }>
    lastBuildTime: number
}

interface BibleVerseRef {
    book: number
    chapter: number
    verse: number
    reference: string
    text: string
}

const BIBLE_INDEX_VERSION = 2 // Increment this to force index rebuild

interface BibleIndex {
    wordIndex: Map<string, BibleVerseRef[]>
    bibleId: string
    version: number
}

let searchIndex: SearchIndex | null = null
let bibleIndex: BibleIndex | null = null
let indexVersion = 0

/**
 * Build/rebuild the search index from shows and textCache
 * Call this when shows or textCache changes
 */
export function buildSearchIndex(shows: ShowList[]) {
    const wordIndex = new Map<string, IndexEntry[]>()
    const phraseIndex = new Map<string, Set<string>>()
    const showData = new Map<string, { name: string; content: string }>()
    const cache = get(textCache)

    for (const show of shows) {
        if (!show.id) continue

        const name = formatSearch(show.name || "", false)
        const content = formatSearch(cache[show.id] || "", false)
        showData.set(show.id, { name, content })

        // Index name words
        const nameWords = tokenize(name)
        indexWords(wordIndex, show.id, nameWords, "name")
        indexPhrases(phraseIndex, show.id, nameWords)

        // Index content words
        const contentWords = tokenize(content)
        indexWords(wordIndex, show.id, contentWords, "content")
        indexPhrases(phraseIndex, show.id, contentWords)
    }

    searchIndex = {
        wordIndex,
        phraseIndex,
        showData,
        lastBuildTime: Date.now()
    }
    indexVersion++

    return searchIndex
}

/**
 * Fast Bible search using inverted index
 */
export function fastBibleSearch(searchValue: string, MAX_RESULTS = 50): BibleVerseRef[] {
    if (!bibleIndex) return []

    const formattedQuery = formatSearch(searchValue)
    const queryWords = tokenize(formattedQuery)
    if (queryWords.length === 0) return []

    // Map: Verse Key (Book-Chapter-Verse) -> { ref, score }
    const resultsMap = new Map<string, { ref: BibleVerseRef; score: number }>()

    // Use word index to find candidates
    for (const word of queryWords) {
        if (word.length < 2) continue
        const matches = bibleIndex.wordIndex.get(word) || []
        for (const ref of matches) {
            const key = `${ref.book}-${ref.chapter}-${ref.verse}`
            if (!resultsMap.has(key)) {
                resultsMap.set(key, { ref, score: 0 })
            }
            resultsMap.get(key)!.score += 1
        }
    }

    // Generate subphrases for better scoring
    const searchTerms = generateSearchTerms(queryWords, 2)

    // Re-score based on phrases and exact matches
    const finalResults = Array.from(resultsMap.values())
        .filter((r) => r.score >= Math.min(queryWords.length, 2)) // Require at least 2 word matches if possible
        .map((r) => {
            let extraScore = 0
            const verseText = formatSearch(r.ref.text)

            for (const { term, weight, isPhrase } of searchTerms) {
                if (isPhrase && verseText.includes(term)) {
                    // Match found for this subphrase or full phrase
                    extraScore += weight * 20
                }
            }

            // Word frequency bonus (if multiple query words appear multiple times)
            // But score already counts matched unique query words.
            // Let's add the extraScore to the original score (which is word match count)
            return { ...r, finalScore: r.score + extraScore }
        })
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, MAX_RESULTS)
        .map((r) => r.ref)

    return finalResults
}

/**
 * Build search index for a Bible
 */
export async function buildBibleIndex(bibleId: string, bibleData: any) {
    if (bibleIndex?.bibleId === bibleId && bibleIndex?.version === BIBLE_INDEX_VERSION) return bibleIndex

    const wordIndex = new Map<string, BibleVerseRef[]>()

    // We expect bibleData to have books
    const books = bibleData.books || []

    for (const book of books) {
        const bookIndex = book.number
        const bookName = book.name
        const chapters = book.chapters || []

        for (const chapter of chapters) {
            const chapterIndex = chapter.number
            const verses = chapter.verses || []

            for (const verse of verses) {
                const verseIndex = verse.number
                const text = verse.text || ""
                const formattedText = formatSearch(text)
                const tokens = tokenize(formattedText)

                const ref: BibleVerseRef = {
                    book: bookIndex,
                    chapter: chapterIndex,
                    verse: verseIndex,
                    reference: `${bookName} ${chapterIndex}:${verseIndex}`,
                    text: text
                }

                // Index each unique word in the verse
                const uniqueTokens = new Set(tokens)
                for (const token of uniqueTokens) {
                    if (token.length < 2) continue
                    if (!wordIndex.has(token)) wordIndex.set(token, [])
                    wordIndex.get(token)!.push(ref)
                }
            }
        }
    }

    bibleIndex = {
        wordIndex,
        bibleId,
        version: BIBLE_INDEX_VERSION
    }

    return bibleIndex
}

function indexWords(index: Map<string, IndexEntry[]>, showId: string, words: string[], field: "name" | "content") {
    const wordFreq = new Map<string, number>()
    for (const word of words) {
        if (word.length < 2) continue // Skip very short words
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    for (const [word, freq] of wordFreq) {
        if (!index.has(word)) {
            index.set(word, [])
        }
        index.get(word)!.push({ showId, field, frequency: freq })
    }
}

function indexPhrases(index: Map<string, Set<string>>, showId: string, words: string[]) {
    // Index n-grams (2 to 5 words) for phrase matching
    for (let i = 0; i < words.length - 1; i++) {
        let phrase = words[i]
        for (let size = 2; size <= 5; size++) {
            if (i + size - 1 < words.length) {
                phrase += " " + words[i + size - 1]
                if (!index.has(phrase)) index.set(phrase, new Set())
                index.get(phrase)!.add(showId)
            } else {
                break
            }
        }
    }
}

/**
 * Fast search using the inverted index
 * Generates subphrases and individual words from the query
 */
export function fastSearch(searchValue: string, shows: ShowList[]): ShowList[] {
    // Ensure index is built
    if (!searchIndex || searchIndex.showData.size !== shows.length) {
        buildSearchIndex(shows)
    }

    const formattedQuery = formatSearch(searchValue, false)
    const queryWords = tokenize(formattedQuery)

    if (queryWords.length === 0) return []

    // Score accumulator: showId -> score
    const scores = new Map<string, number>()

    // Generate all subphrases and words to search for
    const searchTerms = generateSearchTerms(queryWords)

    // O(1) lookup for each term
    for (const { term, weight, isPhrase } of searchTerms) {
        if (isPhrase) {
            // Phrase lookup
            const matchingShows = searchIndex!.phraseIndex.get(term)
            if (matchingShows) {
                for (const showId of matchingShows) {
                    scores.set(showId, (scores.get(showId) || 0) + weight * 20)
                }
            }
        } else {
            // Word lookup
            const entries = searchIndex!.wordIndex.get(term)
            if (entries) {
                for (const entry of entries) {
                    const fieldBonus = entry.field === "name" ? 3 : 1
                    const freqBonus = Math.min(entry.frequency, 5) * 0.5
                    scores.set(entry.showId, (scores.get(entry.showId) || 0) + weight * fieldBonus + freqBonus)
                }
            }

            // Prefix matching for partial words
            if (term.length >= 3) {
                for (const [indexedWord, entries] of searchIndex!.wordIndex) {
                    if (indexedWord.startsWith(term) && indexedWord !== term) {
                        for (const entry of entries) {
                            const fieldBonus = entry.field === "name" ? 2 : 0.5
                            scores.set(entry.showId, (scores.get(entry.showId) || 0) + weight * 0.3 * fieldBonus)
                        }
                    }
                }
            }
        }
    }

    // Convert scores to results
    const showMap = new Map(shows.map((s) => [s.id, s]))
    let results: ShowList[] = []

    for (const [showId, score] of scores) {
        const show = showMap.get(showId)
        if (show && score > 0) {
            // Don't include archived unless viewing archive
            const isArchived = get(categories)[show.category || ""]?.isArchive
            if (isArchived && get(drawerTabsData).shows?.activeSubTab !== show.category) continue

            results.push({ ...show, match: score })
        }
    }

    // Sort by score descending
    results = sortObjectNumbers(results, "match", true)

    // Normalize scores to 0-100
    const maxScore = results[0]?.match || 1
    results = results.map((r) => ({ ...r, originalMatch: r.match, match: ((r.match || 0) / maxScore) * 100 }))

    return results
}

/**
 * Generate all search terms from query words
 * For "valley of dry bones" generates:
 * - Full phrase: "valley of dry bones" (weight: 1.0)
 * - Subphrases: "valley of dry", "of dry bones", "valley of", "dry bones" (weight: 0.8)
 * - Individual words: "valley", "dry", "bones" (weight: 0.5), skip "of" (too short)
 */
function generateSearchTerms(words: string[], minWordLength = 3): { term: string; weight: number; isPhrase: boolean }[] {
    const terms: { term: string; weight: number; isPhrase: boolean }[] = []
    const n = words.length

    if (n === 0) return terms

    // Full phrase (highest weight)
    if (n >= 2) {
        terms.push({ term: words.join(" "), weight: 1.0, isPhrase: true })
    }

    // Contiguous subphrases (sliding window)
    for (let windowSize = Math.min(n - 1, 5); windowSize >= 2; windowSize--) {
        for (let i = 0; i <= n - windowSize; i++) {
            const subphrase = words.slice(i, i + windowSize).join(" ")
            // Weight decreases as subphrase gets shorter
            const weight = 0.6 + (windowSize / n) * 0.2
            terms.push({ term: subphrase, weight, isPhrase: true })
        }
    }

    // Individual words (filter out very short ones)
    for (const word of words) {
        if (word.length >= minWordLength) {
            terms.push({ term: word, weight: 0.5, isPhrase: false })
        }
    }

    return terms
}

// invalidate search index when text cache changes
export function invalidateSearchIndex() {
    searchIndex = null
}
