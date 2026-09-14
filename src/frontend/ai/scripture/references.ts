import type { BibleCacheData } from "./BibleCacheManager"

export function normalizeReferences(text: string, cacheData: BibleCacheData): string {
    let normalized = text

    // 1. Remove punctuation that breaks numbered books (e.g., "1, john 4" or "first, john" -> "1 john")
    normalized = normalized.replace(/\b([1-3]|first|second|third)\s*[,.\-_]\s*([\p{L}]+)/giu, "$1 $2")

    // 2. Normalize plural or localized book names (e.g., "Psalms" -> "Psalm")
    normalized = normalized.replace(/\bpsalms\b/gi, "Psalm")

    // 3. Inverted structure: "verse 16 of John chapter 3" or "16th verse of John chapter 3" -> "John 3:16"
    normalized = normalized.replace(/\b(?:the\s+)?(?:verse|v|verses)?\s*(\d+)(?:st|nd|rd|th)?\s+(?:verse\s+)?of\s+([1-3]?\s*[\p{L}]+)\s+(?:chapter\s*)?(\d+)\b/giu, "$2 $3:$1")

    // 4. Trailing verse ordinal/word: "John chapter 3, the 16th verse" -> "John 3:16"
    normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(?:chapter\s*)?(\d+)[,\s]+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+(?:verse|v|verses)\b/giu, "$1 $2:$3")

    // 5. Ordinal chapter structure: "the 8th chapter of Romans" -> "Romans 8"
    normalized = normalized.replace(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+(?:chapter|psalm)\s+of\s+([1-3]?\s*[\p{L}]+)\b/giu, "$2 $1")

    // 6. Ordinal psalm phrasing: "the 23rd psalm" -> "Psalm 23"
    normalized = normalized.replace(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+psalms?\b/giu, "Psalm $1")

    // 7. Single-chapter book handler: convert "Philemon verse 6" -> "Philemon 1:6"
    normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(?:verse|v|verses)?\s*(\d+)\b/giu, (match, book, num) => {
        if (isSingleChapterBook(book, cacheData)) {
            return `${book} 1:${num}`
        }
        return match
    })

    // 8. Standard spoken reference conversion: "Mark chapter 8 and 22", "Mark 8 verse 22" or "Mark 8 and 22" -> "Mark 8:22"
    normalized = normalized.replace(/\b([1-3]?\s*[\p{L}]+)\s+(chapter\s+)?(\d+)\s+(and|verses|verse|v)\s+(\d+)(?:\s*(?:[-–—]|through|to)\s*(\d+))?\b/giu, (match, book, chapterWord, chap, joiner, vStart, vEnd) => {
        // "Genesis 1 and 2" is two chapters
        if (!chapterWord && joiner.toLowerCase() === "and" && Number(vStart) === Number(chap) + 1) return match
        return vEnd ? `${book} ${chap}:${vStart}-${vEnd}` : `${book} ${chap}:${vStart}`
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
    const regex = /^((?:\d\s+)?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/
    const match = ref.trim().match(regex)
    if (!match) return null

    const [, book, rawChapter, rawStart, rawEnd] = match

    const chapter = parseInt(rawChapter, 10)
    const startVerse = parseInt(rawStart, 10)
    const endVerse = rawEnd ? parseInt(rawEnd, 10) : startVerse

    if (chapter <= 0 || startVerse <= 0 || endVerse < startVerse) return null

    return { book, chapter, startVerse, endVerse }
}

// checks if containerRef is or has targetRef
// isReferenceWithin("Matthew 7:1-2", "Matthew 7:1-6") = true
// isReferenceWithin("Matthew 7:1-8", "Matthew 7:1-6") = false
export function isReferenceWithin(containerRef: string, targetRef: string): boolean {
    const target = parseReference(targetRef)
    const container = parseReference(containerRef)
    if (!target || !container) return false

    if (target.book !== container.book || target.chapter !== container.chapter) return false
    if (target.startVerse < container.startVerse) return false
    if (target.endVerse > container.endVerse) return false

    return true
}
