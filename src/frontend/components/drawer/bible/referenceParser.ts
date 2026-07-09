// Parse scripture reference searches with multiple verse ranges and books, like:
// "Psalm 91:1-3,10;Psalm 23:1-5,8-10" or "Genesis 1:1-12;2:1-10" (semicolon segments without a book keep the previous book)

export type MultiReference = {
    bookNumber: number // first segment's book (primary)
    books: number[] // book per chapter selection
    referenceLabel: string
    chapters: (number | string)[]
    verses: (number | string)[][]
}

type BookLike = { number: number | string; name: string }

// minimal surface of the json-bible Bible class used here (kept injectable for tests)
export type BibleDataLike = {
    bookSearch: (value: string) => { book: number | string; chapter: number | string; verses: (number | string)[]; autocompleted?: string } | null | undefined
    getBook: (book: number | string) => Promise<{ getChapter: (chapter: number) => Promise<any> }>
}

// json-bible expands "1-3+5" but not commas - convert "1-3,5" to "1-3+5" (only between digits, so typing is unaffected)
export function normalizeVerseSeparators(value: string) {
    if (!value) return value
    return value.replace(/(\d)\s*,\s*(?=\d)/g, "$1+")
}

export async function parseMultiBookReference(bibleData: BibleDataLike, value: string, books: BookLike[]): Promise<MultiReference | null> {
    if (!bibleData) return null

    const sanitizedValue = normalizeVerseSeparators(value?.replace(/\s+/g, " ").trim() || "")
    if (!sanitizedValue) return null

    const rawSegments = sanitizedValue
        .split(";")
        .map((segment) => segment.trim())
        .filter(Boolean)
    const segmentsToProcess = rawSegments.length ? rawSegments : [sanitizedValue]

    const firstSegment = segmentsToProcess[0]
    let baseResult = bibleData.bookSearch(firstSegment)
    if (!baseResult?.book && firstSegment.includes("-")) {
        const fallbackTarget = firstSegment.split("-")[0]?.trim()
        if (fallbackTarget) baseResult = bibleData.bookSearch(fallbackTarget)
    }
    if (!baseResult?.book) return null

    const firstBookNumber = Number(baseResult.book)

    // each segment can name its own book - segments without one keep the previous segment's book
    let currentBookNumber = firstBookNumber
    let currentBookName = getCanonicalBookName(books, firstBookNumber) || firstSegment

    const resolvedSegments: { text: string; book: number }[] = []
    for (let i = 0; i < segmentsToProcess.length; i++) {
        const rawSegment = segmentsToProcess[i]

        const segmentBook = i === 0 ? firstBookNumber : getSegmentBookNumber(bibleData, rawSegment)
        if (segmentBook && segmentBook !== currentBookNumber) {
            currentBookNumber = segmentBook
            currentBookName = getCanonicalBookName(books, segmentBook) || currentBookName
        }

        const normalizedSegment = normalizeSegment(bibleData, rawSegment, currentBookName, currentBookNumber)
        const expandedSegments = await expandCrossChapterSegment(bibleData, normalizedSegment, currentBookName, currentBookNumber)
        expandedSegments.forEach((text) => resolvedSegments.push({ text, book: currentBookNumber }))
    }

    const hasExplicitSplit = rawSegments.length > 1
    if (!hasExplicitSplit && resolvedSegments.length <= 1) return null

    const bookNumbers: number[] = []
    const chapters: (number | string)[] = []
    const verses: (number | string)[][] = []
    for (const segment of resolvedSegments) {
        const parsed = bibleData.bookSearch(segment.text)
        if (!parsed?.chapter) return null

        const chapterNumber = Number(parsed.chapter)
        const verseList = parsed.verses?.length ? parsed.verses : await getEntireChapterVerses(bibleData, segment.book, chapterNumber)
        if (!verseList?.length) return null

        bookNumbers.push(segment.book)
        chapters.push(chapterNumber)
        verses.push(verseList)
    }

    return {
        bookNumber: firstBookNumber,
        books: bookNumbers,
        referenceLabel: buildSelectionLabel(books, bookNumbers, chapters, verses),
        chapters,
        verses
    }
}

function getCanonicalBookName(books: BookLike[], bookNumber: number) {
    return books?.find((book) => Number(book.number) === bookNumber)?.name || ""
}

// resolve a segment's own book if it names one (e.g. "Psalm 23:1-5"), bare "23:1-5" segments resolve nothing
function getSegmentBookNumber(bibleData: BibleDataLike, segment: string): number {
    const trimmed = segment?.trim()
    if (!trimmed || !/^\d?\s*[a-zA-Z]/.test(trimmed)) return 0

    let attempt = bibleData.bookSearch(trimmed)
    if (!attempt?.book && trimmed.includes("-")) {
        const fallbackTarget = trimmed.split("-")[0]?.trim()
        if (fallbackTarget) attempt = bibleData.bookSearch(fallbackTarget)
    }

    return Number(attempt?.book) || 0
}

// Ensure a reference chunk includes the book name so bookSearch can resolve it reliably.
function normalizeSegment(bibleData: BibleDataLike, segment: string, bookName: string, bookNumber: number) {
    const trimmed = segment?.trim()
    if (!trimmed) return bookName

    const attempt = bibleData.bookSearch(trimmed)
    if (Number(attempt?.book) === bookNumber && attempt?.chapter) return trimmed

    return `${bookName} ${trimmed}`.replace(/\s+/g, " ").trim()
}

// Break a cross-chapter span (e.g. "1:1-2:10") into per-chapter segments.
async function expandCrossChapterSegment(bibleData: BibleDataLike, segment: string, bookName: string, bookNumber: number) {
    const escapedBook = escapeRegExp(bookName)
    const remainder = segment.replace(new RegExp(`^${escapedBook}\\s*`, "i"), "").trim()
    const multiChapterMatch = remainder.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
    if (!multiChapterMatch) return [segment]

    const [_, startChapterStr, startVerseStr, endChapterStr, endVerseStr] = multiChapterMatch
    const startChapter = Number(startChapterStr)
    const startVerse = Number(startVerseStr)
    const endChapter = Number(endChapterStr)
    const endVerse = Number(endVerseStr)
    if (!startChapter || !endChapter || startChapter === endChapter) return [segment]

    const expanded: string[] = []
    for (let chapter = startChapter; chapter <= endChapter; chapter++) {
        const chapterStart = chapter === startChapter ? startVerse : 1
        const chapterEnd = chapter === endChapter ? endVerse : await getChapterLastVerse(bibleData, bookNumber, chapter)
        if (!chapterEnd) return [segment]
        expanded.push(`${bookName} ${chapter}:${chapterStart}-${chapterEnd}`)
    }

    return expanded
}

// Get the final verse number for a chapter so we can include the whole section when needed.
async function getChapterLastVerse(bibleData: BibleDataLike, bookNumber: number, chapterNumber: number) {
    try {
        const bookData = await bibleData.getBook(bookNumber)
        const chapterData = await bookData.getChapter(chapterNumber)
        const verseEntries = chapterData?.data?.verses || []
        return Number(verseEntries[verseEntries.length - 1]?.number || verseEntries.length || 0)
    } catch (err) {
        console.error(err)
        return 0
    }
}

// Return every verse index for a chapter when no explicit range was provided.
async function getEntireChapterVerses(bibleData: BibleDataLike, bookNumber: number, chapterNumber: number) {
    try {
        const bookData = await bibleData.getBook(bookNumber)
        const chapterData = await bookData.getChapter(chapterNumber)
        return (chapterData?.data?.verses || []).map((verse) => Number(verse.number)).filter(Boolean)
    } catch (err) {
        console.error(err)
        return []
    }
}

// Format the combined reference like "Psalms 91:1-3+10 ; 23:1-5 ; John 3:16" (book name shown when it changes).
function buildSelectionLabel(books: BookLike[], bookNumbers: number[], chapters: (number | string)[], verses: (number | string)[][]) {
    const labels: string[] = []
    let previousBook = 0

    chapters.forEach((chapter, index) => {
        const book = bookNumbers[index]
        const segment = `${chapter}:${compactVerseList(verses[index] || [])}`

        const includeBook = index === 0 || book !== previousBook
        const bookName = getCanonicalBookName(books, book)
        labels.push(includeBook && bookName ? `${bookName} ${segment}` : segment)
        previousBook = book
    })

    return labels.join(" ; ").trim()
}

// [1, 2, 3, 10] -> "1-3+10" (matching the app's verse list separator)
function compactVerseList(verses: (number | string)[]) {
    const numbers = [...new Set(verses.map(Number).filter((n) => !Number.isNaN(n)))].sort((a, b) => a - b)
    if (!numbers.length) return ""

    const ranges: string[] = []
    let start = numbers[0]
    let end = numbers[0]
    for (let i = 1; i <= numbers.length; i++) {
        if (numbers[i] === end + 1) {
            end = numbers[i]
            continue
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`)
        start = numbers[i]
        end = numbers[i]
    }

    return ranges.join("+")
}

// Escape user-facing book names before building regular expressions.
function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
