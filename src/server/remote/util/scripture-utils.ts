import { sanitizeVerseText } from "../../../common/scripture/sanitizeVerseText"

// Book abbreviation mappings
export const BOOK_ABBREVIATIONS: Record<string, string> = {
    jh: "john",
    jn: "john",
    jo: "john",
    gen: "genesis",
    ex: "exodus",
    exo: "exodus",
    lev: "leviticus",
    num: "numbers",
    deut: "deuteronomy",
    dt: "deuteronomy",
    josh: "joshua",
    judg: "judges",
    ru: "ruth",
    sam: "samuel",
    "1sam": "1samuel",
    "2sam": "2samuel",
    kg: "kings",
    kgs: "kings",
    "1kg": "1kings",
    "1kgs": "1kings",
    "2kg": "2kings",
    "2kgs": "2kings",
    chr: "chronicles",
    "1chr": "1chronicles",
    "2chr": "2chronicles",
    ezr: "ezra",
    neh: "nehemiah",
    est: "esther",
    ps: "psalms",
    psa: "psalms",
    prov: "proverbs",
    pr: "proverbs",
    ecc: "ecclesiastes",
    eccl: "ecclesiastes",
    song: "songofsongs",
    ss: "songofsongs",
    isa: "isaiah",
    is: "isaiah",
    jer: "jeremiah",
    lam: "lamentations",
    ezek: "ezekiel",
    ez: "ezekiel",
    dan: "daniel",
    hos: "hosea",
    joe: "joel",
    am: "amos",
    ob: "obadiah",
    jon: "jonah",
    mic: "micah",
    nah: "nahum",
    hab: "habakkuk",
    zeph: "zephaniah",
    zep: "zephaniah",
    hag: "haggai",
    zech: "zechariah",
    zec: "zechariah",
    mal: "malachi",
    mt: "matthew",
    matt: "matthew",
    mk: "mark",
    lk: "luke",
    luk: "luke",
    joh: "john",
    act: "acts",
    rom: "romans",
    cor: "corinthians",
    "1cor": "1corinthians",
    "2cor": "2corinthians",
    gal: "galatians",
    eph: "ephesians",
    phil: "philippians",
    php: "philippians",
    col: "colossians",
    thess: "thessalonians",
    thes: "thessalonians",
    "1thess": "1thessalonians",
    "1thes": "1thessalonians",
    "2thess": "2thessalonians",
    "2thes": "2thessalonians",
    tim: "timothy",
    "1tim": "1timothy",
    "2tim": "2timothy",
    tit: "titus",
    philem: "philemon",
    phlm: "philemon",
    heb: "hebrews",
    jas: "james",
    jam: "james",
    pet: "peter",
    pt: "peter",
    "1pet": "1peter",
    "1pt": "1peter",
    "2pet": "2peter",
    "2pt": "2peter",
    jude: "jude",
    rev: "revelation",
    rv: "revelation"
}

// Normalize book name for searching
export function formatBookSearch(search: string): string {
    return search
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/[áàâã]/g, "a")
        .replace(/[éèê]/g, "e")
        .replace(/[íìî]/g, "i")
        .replace(/[óòôõ]/g, "o")
        .replace(/[úùû]/g, "u")
        .replace(/ç/g, "c")
}

// Find a book by name or abbreviation
export function findBook(books: any[], value: string): any {
    const search = formatBookSearch(value)
    const exactMatch = books.find((book) => {
        const bookName = formatBookSearch(book.name)
        if (bookName === search) return true
        const expandedName = BOOK_ABBREVIATIONS[search]
        if (expandedName && bookName.includes(expandedName)) return true
        return false
    })
    return exactMatch || books.find((book) => formatBookSearch(book.name).startsWith(search))
}

// Find a chapter by number (1-indexed)
export function findChapter(book: any, value: string): any {
    const num = parseInt(value, 10)
    return !isNaN(num) && num >= 1 ? book.chapters?.[num - 1] || null : null
}

// Find a verse by number (1-indexed)
export function findVerse(chapter: any, value: string): any {
    const num = parseInt(value, 10)
    return !isNaN(num) && num >= 1 ? chapter.verses?.[num - 1] || null : null
}

export type SearchHit = {
    book: any
    chapter: any
    verse: any
    reference: string
    referenceFull: string
    verseText: string
}

// Parse combined query
export function parseCombinedQuery(query: string, books: any[]): { textTerm: string; book: any | null } {
    const words = query.trim().split(/\s+/)
    if (words.length < 2) return { textTerm: query.trim(), book: null }

    for (let i = 0; i < words.length; i++) {
        // Try 1, 2, 3 word combinations
        for (let len = 1; len <= 3 && i + len <= words.length; len++) {
            const bookName = words.slice(i, i + len).join(" ")
            const book = findBook(books, bookName)
            if (book) {
                const textTerm = words
                    .filter((_, idx) => idx < i || idx >= i + len)
                    .join(" ")
                    .trim()
                if (textTerm.length >= 2) return { textTerm, book }
            }
        }
    }
    return { textTerm: query.trim(), book: null }
}

// Search for text in bible verses
export function searchInBible(books: any[], searchTerm: string, filterBook: any | null = null, maxResults = 50): SearchHit[] {
    const results: SearchHit[] = []
    const searchLower = searchTerm.toLowerCase()
    const booksToSearch = filterBook ? [filterBook] : books

    for (const book of booksToSearch) {
        for (const chapter of book.chapters || []) {
            for (const verse of chapter.verses || []) {
                const verseContent = sanitizeVerseText(verse.text || "")
                if (verseContent.toLowerCase().includes(searchLower)) {
                    results.push({
                        book,
                        chapter,
                        verse,
                        reference: `${book.number}.${chapter.number}.${verse.number}`,
                        referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                        verseText: verseContent
                    })
                    if (results.length >= maxResults) return results
                }
            }
        }
    }
    return results
}

// Reference pattern: "John 3:16", "John 3 16", "John 3.16", "Gen 1:1-3"
export const REFERENCE_PATTERN = /^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-(\d+))?/

// Parse a scripture reference string
export function parseReference(searchVal: string, books: any[]): { book: any; chapter: number; verse: number | null } | null {
    const match = searchVal.match(REFERENCE_PATTERN)
    if (!match) return null

    const [, bookPart, chapterPart, versePart1, versePart2] = match
    const book = findBook(books, bookPart)
    if (!book) return null

    const chapter = parseInt(chapterPart, 10)
    const versePart = versePart1 || versePart2
    const verse = versePart ? parseInt(versePart, 10) : null

    return { book, chapter, verse }
}

// Sort scriptures by name
export function sortByName<T extends { name?: string; customName?: string }>(list: T[]): T[] {
    return list.slice().sort((a, b) => {
        const nameA = (a.customName || a.name || "").toLowerCase()
        const nameB = (b.customName || b.name || "").toLowerCase()
        return nameA.localeCompare(nameB)
    })
}

// Get icon for scripture type
export function iconForScripture(item: any): string {
    return item.api ? "scripture_alt" : item.collection ? "collection" : "scripture"
}

// Strict reference pattern (requires verse number, for parsing display references)
export const REFERENCE_PATTERN_STRICT = /^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-\d+)?$/

// Check if text looks like a scripture reference
export function looksLikeReference(text: string): boolean {
    return REFERENCE_PATTERN.test(text)
}

// Parse verse number from activeVerses array
export function parseVerseNumber(verseList: any): number {
    if (!Array.isArray(verseList) || verseList.length === 0) return 0
    const num = parseInt(String(verseList[verseList.length - 1]), 10)
    return Number.isFinite(num) && num > 0 ? num : 0
}

// Generate dynamic colors for Bible versions (for collection view)
export function getVersionColor(index: number): string {
    const goldenAngle = 137.508
    const baseHue = 330 // FreeShow's pink
    const hue = (baseHue + index * goldenAngle) % 360
    return `hsl(${hue}, 75%, 65%)`
}

export function getVersionBgColor(index: number): string {
    const goldenAngle = 137.508
    const baseHue = 330
    const hue = (baseHue + index * goldenAngle) % 360
    return `hsla(${hue}, 70%, 50%, 0.12)`
}

// Text formatting utilities
export function formatBibleText(text: string | undefined): string {
    if (!text) return ""
    text = text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>')
    return removeTags(stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", ""))
}

function removeTags(text: string): string {
    return text.replace(/(<([^>]+)>)/gi, "")
}

function stripMarkdown(input: string): string {
    input = input.replace(/#\s*(.*?)\s*#/g, "")
    input = input.replace(/\*\{(.*?)\}\*/g, "")
    input = input.replace(/!\{(.*?)\}!/g, "$1")
    input = input.replace(/(\*\*|__)(.*?)\1/g, "$2")
    input = input.replace(/(\*|_)(.*?)\1/g, "$2")
    input = input.replace(/\+\+(.*?)\+\+/g, "$1")
    input = input.replace(/~~(.*?)~~/g, "$1")
    input = input.replace(/"([^"]*?)"/g, "$1")
    input = input.replace(/\n/g, "")
    input = input.replace(/¶/g, "")
    return input
}

// Book color coding (for visual groupings)
const colorCodesFull = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
const colorCodesNT = [5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
const colors = ["", "#f17d46", "#ffd17c", "#8cdfff", "#8888ff", "#ff97f2", "#ffdce7", "#88ffa9", "#ffd3b6"]

export function getBookColor(books: any[], bookIndex: number): string {
    if (books.length === colorCodesFull.length) return colors[colorCodesFull[bookIndex]]
    else if (books.length === colorCodesNT.length) return colors[colorCodesNT[bookIndex]]
    return ""
}

// Short name generation for book display
export function getShortName(name: string, usedNames: string[]): string {
    let shortName = isNaN(parseInt(name[0])) ? name.slice(0, 3) : name.replace(" ", "").slice(0, 4)
    // Use four characters if same short name ("Jud"ges="Jud"e)
    if (usedNames.includes(shortName) && shortName.length === 3) shortName = name.slice(0, 4)
    return shortName
}
