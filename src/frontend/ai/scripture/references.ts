import type { BibleCacheData } from "./BibleCacheManager"
import { CHAPTER_PATTERN, JOINER_PATTERN, normalizeBookName, OF_PATTERN, ORDINAL_PREFIX_PATTERN, PSALM_NORMALIZATION_MAP, PSALM_PATTERN, RANGE_PATTERN, THE_PATTERN, VERSE_PATTERN } from "./referenceDictionary"

export function normalizeReferences(text: string, cacheData: BibleCacheData): string {
    let normalized = text

    // 1. Remove punctuation that breaks numbered books and normalize ordinal book prefixes (e.g., "1, john 4" or "first, john" -> "1 john")
    normalized = normalized.replace(new RegExp(`\\b([1-3]|${ORDINAL_PREFIX_PATTERN})\\s*[,.\\-_]\\s*([\\p{L}]+)`, "giu"), "$1 $2")
    normalized = normalized.replace(new RegExp(`\\b(${ORDINAL_PREFIX_PATTERN})\\s+([\\p{L}]+)`, "giu"), (match) => normalizeBookName(match))

    // 2. Normalize plural or localized book names (e.g., "Psalms" -> "Psalm")
    for (const [plural, singular] of Object.entries(PSALM_NORMALIZATION_MAP)) {
        normalized = normalized.replace(new RegExp(`\\b${plural}\\b`, "giu"), singular)
    }

    // 3. Inverted structure: "verse 16 of John chapter 3" or "16th verse of John chapter 3" -> "John 3:16"
    const invertedRegex = new RegExp(`\\b(?:(?:${THE_PATTERN})\\s+)?(?:${VERSE_PATTERN})?\\s*(\\d+)\\s+(?:(?:${VERSE_PATTERN})\\s+)?(?:${OF_PATTERN})\\s+([1-3]?\\s*[\\p{L}]+?)(?:\\s+(?:${CHAPTER_PATTERN}))?\\s+(\\d+)\\b`, "giu")
    normalized = normalized.replace(invertedRegex, (_, verse, book, chap) => {
        const cleanBook = book.trim().replace(new RegExp(`\\s+(?:${CHAPTER_PATTERN})$`, "iu"), "")
        return `${cleanBook} ${chap}:${verse}`
    })

    // 4. Trailing verse ordinal/word: "John chapter 3, the 16th verse" -> "John 3:16"
    const trailingVerseRegex = new RegExp(`\\b([1-3]?\\s*[\\p{L}]+?)(?:\\s+(?:${CHAPTER_PATTERN}))?\\s+(\\d+)[,\\s]+(?:(?:${THE_PATTERN})\\s+)?(\\d+)\\s+(?:${VERSE_PATTERN})\\b`, "giu")
    normalized = normalized.replace(trailingVerseRegex, (_, book, chap, verse) => {
        const cleanBook = book.trim().replace(new RegExp(`\\s+(?:${CHAPTER_PATTERN})$`, "iu"), "")
        return `${cleanBook} ${chap}:${verse}`
    })

    // 5. Ordinal chapter structure: "the 8th chapter of Romans" -> "Romans 8"
    const ordinalChapterRegex = new RegExp(`\\b(?:(?:${THE_PATTERN})\\s+)?(\\d+)\\s+(?:${CHAPTER_PATTERN}|${PSALM_PATTERN})\\s+(?:${OF_PATTERN})\\s+([1-3]?\\s*[\\p{L}]+)\\b`, "giu")
    normalized = normalized.replace(ordinalChapterRegex, "$2 $1")

    // 6. Ordinal psalm phrasing: "the 23rd psalm" -> "Psalm 23"
    const ordinalPsalmRegex = new RegExp(`\\b(?:(?:${THE_PATTERN})\\s+)?(\\d+)\\s+(${PSALM_PATTERN})\\b`, "giu")
    normalized = normalized.replace(ordinalPsalmRegex, "$2 $1")

    // 7. Single-chapter book handler: convert "Philemon verse 6" -> "Philemon 1:6"
    const singleChapterRegex = new RegExp(`\\b([1-3]?\\s*[\\p{L}]+)\\s+(?:${VERSE_PATTERN})?\\s*(\\d+)\\b(?![:\\d])`, "giu")
    normalized = normalized.replace(singleChapterRegex, (match, book, num) => {
        if (isSingleChapterBook(book, cacheData)) {
            return `${book} 1:${num}`
        }
        return match
    })

    // 8. Standard spoken reference conversion: "Mark chapter 8 and 22", "Mark 8 verse 22" or "Mark 8 and 22" -> "Mark 8:22"
    const standardRefRegex = new RegExp(`\\b([1-3]?\\s*[\\p{L}]+?)(?:\\s+(?:${CHAPTER_PATTERN}))?\\s+(\\d+)\\s+((?:${JOINER_PATTERN})|(?:${VERSE_PATTERN}))\\s+(\\d+)(?:\\s*(?:[-–—]|${RANGE_PATTERN})\\s*(\\d+))?\\b`, "giu")
    normalized = normalized.replace(standardRefRegex, (match, book, chap, joiner, vStart, vEnd) => {
        const cleanBook = book.trim().replace(new RegExp(`\\s+(?:${CHAPTER_PATTERN})$`, "iu"), "")
        const joinerStr = (joiner || "").toLowerCase()
        const isJoinerWord = new RegExp(`^(?:${JOINER_PATTERN})$`, "i").test(joinerStr)
        // "Genesis 1 and 2" is two chapters, not chapter 1 verse 2
        if (isJoinerWord && Number(vStart) === Number(chap) + 1) return match
        return vEnd ? `${cleanBook} ${chap}:${vStart}-${vEnd}` : `${cleanBook} ${chap}:${vStart}`
    })

    // 9. Safe dot/comma/space reference formatting: convert "John 3.16" or "John 4 7" -> "John 4:7"
    normalized = normalized.replace(/(?<![:\d])\b([1-3]?\s*[\p{L}]+)\s+(\d+)[.,\s]+(\d+)\b(?!\s*[1-3]?\s*[\p{L}]+)(?!:)/giu, (match, book, chap, verse) => {
        const refKey = `${book.trim().toLowerCase()} ${chap}`
        if (cacheData.referenceIndex.has(refKey)) {
            return `${book} ${chap}:${verse}`
        }
        return match
    })

    // 10. Split concatenated 3- and 4-digit reference numbers (e.g., "John 316" -> "John 3:16", "Psalms 4610" -> "Psalms 46:10")
    normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(\d{3,4})\b/giu, (match, book, digits) => {
        let chap = 0
        let verse = 0
        if (digits.length === 3) {
            chap = parseInt(digits.slice(0, 1), 10)
            verse = parseInt(digits.slice(1), 10)
        } else if (digits.length === 4) {
            chap = parseInt(digits.slice(0, 2), 10)
            verse = parseInt(digits.slice(2), 10)
        }

        const refKey = `${book.toLowerCase()} ${chap}`
        const chapterData = cacheData.referenceIndex.get(refKey)

        if (chapterData && verse >= 1 && verse <= chapterData.verseCount) {
            return `${book} ${chap}:${verse}`
        }

        return match
    })

    return normalized
}

// Resolves single-chapter books dynamically using reference index metadata.
function isSingleChapterBook(bookName: string, cacheData: BibleCacheData): boolean {
    const lowerBook = bookName.toLowerCase().trim()
    const chap1Key = `${lowerBook} 1`
    const chap2Key = `${lowerBook} 2`
    return cacheData.referenceIndex.has(chap1Key) && !cacheData.referenceIndex.has(chap2Key)
}

/////

// Parses a scripture reference string
function parseReference(ref: string) {
    // [Book Name] [Chapter]:[StartVerse](-[EndVerse])?
    const regex = /^((?:\d\s+)?[\p{L}\s]+)\s+(\d+):(\d+)(?:-(\d+))?$/u
    const match = ref.trim().match(regex)
    if (!match) return null

    const [, book, rawChapter, rawStart, rawEnd] = match

    const chapter = parseInt(rawChapter, 10)
    const startVerse = parseInt(rawStart, 10)
    const endVerse = rawEnd ? parseInt(rawEnd, 10) : startVerse

    if (chapter <= 0 || startVerse <= 0 || endVerse < startVerse) return null

    return { book: book.trim(), chapter, startVerse, endVerse }
}

// checks if containerRef is or has targetRef
// isReferenceWithin("Matthew 7:1-2", "Matthew 7:1-6") = true
// isReferenceWithin("Matthew 7:1-8", "Matthew 7:1-6") = false
export function isReferenceWithin(containerRef: string, targetRef: string): boolean {
    const target = parseReference(targetRef)
    const container = parseReference(containerRef)
    if (!target || !container) return false

    if (target.book.toLowerCase() !== container.book.toLowerCase() || target.chapter !== container.chapter) return false
    if (target.startVerse < container.startVerse) return false
    if (target.endVerse > container.endVerse) return false

    return true
}
