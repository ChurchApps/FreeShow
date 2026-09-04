import type { AiScriptureBook } from "../../../../types/ai/AiScripture"
import { ASR_BOOK_ALIASES, collapseStutteredBookNames, correctBookMishearings, FUZZY_MIN_LEN } from "./asrRepairs"
import { HOMOPHONE_ALT, normalizeSpokenNumbers, parseNumberToken } from "./numberUtils"

export interface BookIndex {
    regex: RegExp | null
    chapterFirstRegex: RegExp | null
    verseFirstRegex: RegExp | null
    psalmOrdinalRegex: RegExp | null
    singleChapterVerseRegex: RegExp | null
    byToken: Map<string, { name: string; number: number; }>
    bookPattern: string
    bookWords: string[]
    allBookWords: string[]
}

export interface ReferenceMatch {
    bookNumber: number
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: number
    quote: string
}

interface ReferenceGroups {
    imp?: string
    book?: string
    cA?: string
    cB?: string
    cC?: string
    vA?: string
    vB?: string
    v1?: string
    v2?: string
    v3?: string
    v4?: string
    v5?: string
    e1?: string
    e3?: string
    e4?: string
}

function splitGluedReference(value: number): { chapter: number; verse: number } | null {
    if (value <= 1) return null

    const digits = String(value)
    const candidates: { chapter: number; verse: number }[] = []
    for (let cut = 1; cut < digits.length; cut++) {
        const versePart = digits.slice(cut)
        if (versePart.startsWith("0")) continue

        const chapter = parseInt(digits.slice(0, cut), 10)
        const verse = parseInt(versePart, 10)
        const absoluteMaxChapterLength = 200
        if (chapter >= 1 && verse >= 1 && verse <= absoluteMaxChapterLength) {
            candidates.push({ chapter, verse })
        }
    }

    return candidates.length === 1 ? candidates[0] : null
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const VERSE_WORD = "(?:verses?|best|this|vers|versus|worse)"
const rangePlain = (name: string) => `(?:\\s*(?:-|–|to\\b|through\\b)\\s*(?<${name}>\\d{1,3})\\b)?`

export function buildBookIndex(books: AiScriptureBook[]): BookIndex {
    const byToken = new Map<string, { name: string; number: number; }>()
    const tokens: string[] = []
    const canonNames = new Map<number, string>()

    books.forEach((book) => {
        book.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (!token || byToken.has(token)) return
            byToken.set(token, { name: name.trim(), number: book.canonNumber ?? book.number })
            tokens.push(token)
        })
        if (book.canonNumber && !canonNames.has(book.canonNumber)) {
            canonNames.set(book.canonNumber, book.names[0]?.trim() || "")
        }
    })

    ASR_BOOK_ALIASES.forEach(({ alias, canonNumber }) => {
        if (byToken.has(alias)) return
        const name = canonNames.get(canonNumber)
        if (!name) return
        byToken.set(alias, { name, number: canonNumber })
        tokens.push(alias)
    })

    tokens.sort((a, b) => b.length - a.length)
    const patterns = tokens.map((token) => escapeRegex(token).replace(/ /g, "\\s+"))
    const bookAlt = patterns.join("|")

    const rangeWord = `(?:\\s*(?:-|–|(?:down\\s+|up\\s+)?to\\b|through\\b|thru\\b|till\\b|until\\b|and\\b)\\s*(?<e1>\\d{1,3})\\b)?`
    const verseTail = `(?:\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?:starting\\s+|beginning\\s+|reading\\s+)?(?:from\\s+|at\\s+)?(?::|${VERSE_WORD}\\b)(?:\\s+numbers?\\b)?\\s*(?<v1>\\d{1,3}\\b|${HOMOPHONE_ALT})${rangeWord}|\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?<v2>\\d{1,3})(?:st|nd|rd|th)\\s+${VERSE_WORD}\\b|\\s*[-–,.;/]\\s*(?<v3>\\d{1,3}\\b|${HOMOPHONE_ALT})${rangePlain("e3")}|\\s+(?<v4>\\d{1,3}\\b|${HOMOPHONE_ALT})${rangePlain("e4")}|\\s+and\\s+(?<v5>\\d{1,3}\\b|${HOMOPHONE_ALT}))?`

    const imperativeIntro = "(?:(?<imp>give\\s+me|turn\\s+(?:with\\s+me\\s+)?to|go\\s+to|open(?:\\s+(?:up\\s+)?(?:to|at))?|show\\s+me|read|take\\s+me\\s+to|let'?s\\s+(?:go\\s+to|read|open))\\s+(?:the\\s+)?(?:book\\s+of\\s+)?)?"
    const chapterIntro = "(?:chapter\\s+(?:number\\s+)?(?<cA>\\d{1,3})\\b|(?:the\\s+)?(?<cB>\\d{1,3})(?:st|nd|rd|th)\\s+chapter\\b|(?<cC>\\d{1,3})\\b)"
    const ofBook = `\\s+of\\s+(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>${bookAlt})\\b`

    const regex = patterns.length ? new RegExp(`((?:^|[^a-z0-9])${imperativeIntro})(?<book>${bookAlt})[,.]?\\s+${chapterIntro}${verseTail}`, "g") : null
    const chapterFirstRegex = patterns.length ? new RegExp(`(^|[^a-z0-9])(?:the\\s+)?(?:(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter|chapter\\s+(?:number\\s+)?(?<cB>\\d{1,3}))${ofBook}${verseTail}`, "g") : null
    const verseFirstRegex = patterns.length ? new RegExp(`(^|[^a-z0-9])(?:the\\s+)?(?:(?<vA>\\d{1,3})(?:st|nd|rd|th)?\\s+${VERSE_WORD}\\b|${VERSE_WORD}\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b)\\s+of\\s+(?:(?:the\\s+)?(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter\\s+of\\s+)?(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>${bookAlt})\\b(?:[,.]?\\s+(?:chapter\\s+)?(?<cB>\\d{1,3})\\b)?`, "g") : null

    const psalmTokens = tokens.filter((token) => /^psalms?$/.test(token) || byToken.get(token)?.number === 19)
    const psalmOrdinalRegex = psalmTokens.length ? new RegExp(`(^|[^a-z0-9])the\\s+(?<cA>\\d{1,3})(?:st|nd|rd|th)\\s+(?<book>${psalmTokens.map(escapeRegex).join("|")})\\b${verseTail}`, "g") : null
    const singleChapterVerseRegex = patterns.length ? new RegExp(`(^|[^a-z0-9])(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>${bookAlt})[,.]?\\s+${VERSE_WORD}\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b${rangePlain("e4")}`, "g") : null

    const bookWords = new Set<string>()
    const allBookWords = new Set<string>()
    tokens.forEach((token) =>
        token.split(" ").forEach((word) => {
            if (word.length >= FUZZY_MIN_LEN) bookWords.add(word)
            if (word.length >= 4) allBookWords.add(word)
        })
    )

    return {
        regex,
        chapterFirstRegex,
        verseFirstRegex,
        psalmOrdinalRegex,
        singleChapterVerseRegex,
        byToken,
        bookPattern: patterns.join("|"),
        bookWords: Array.from(bookWords),
        allBookWords: Array.from(allBookWords)
    }
}

export function matchReferences(text: string, index: BookIndex): ReferenceMatch[] {
    if (!index.regex) return []

    const normalized = correctBookMishearings(collapseStutteredBookNames(normalizeSpokenNumbers(text), index.allBookWords), index.bookWords)
    const results: ReferenceMatch[] = []
    const claimedSpans: { from: number; to: number }[] = []
    const isClaimed = (pos: number) => claimedSpans.some((s) => pos >= s.from && pos < s.to)

    const pushMatch = (match: RegExpExecArray, options: { claimSpan?: boolean; alwaysCued?: boolean; verseOverride?: string } = {}) => {
        const groups = (match.groups || {}) as ReferenceGroups
        const bookToken = (groups.book || "").replace(/\s+/g, " ")
        const book = index.byToken.get(bookToken)
        if (!book) return

        let chapter = parseInt(groups.cA ?? groups.cB ?? groups.cC ?? "", 10)
        if (!(chapter >= 1) && options.verseOverride !== undefined) chapter = 1
        if (!(chapter >= 1)) return

        const verseRaw = options.verseOverride ?? groups.v1 ?? groups.v2 ?? groups.v3 ?? groups.v4 ?? (groups.imp !== undefined ? groups.v5 : undefined)
        const hasVerse = verseRaw !== undefined
        let verseStart = 1,
            verseEnd = 1,
            unglued = false

        if (hasVerse) {
            verseStart = parseNumberToken(verseRaw)
            if (!(verseStart >= 1)) return
            const endRaw = groups.e1 ?? groups.e3 ?? groups.e4
            verseEnd = endRaw !== undefined ? Math.max(verseStart, parseInt(endRaw, 10)) : verseStart
        } else if (groups.cC !== undefined) {
            const split = splitGluedReference(chapter)
            if (split) {
                ;({ chapter, verse: verseStart } = split)
                verseEnd = verseStart
                unglued = true
            }
        }

        if ((hasVerse || unglued)) {
            const absoluteMaxChapterLength = 200
            if (verseStart > absoluteMaxChapterLength) return
            if (verseEnd > absoluteMaxChapterLength) verseEnd = absoluteMaxChapterLength
        }

        const quote = match[0].slice(match[1].length)
        const hasCue = options.alwaysCued || /\bchapter\b|\bverses?\b/.test(quote) || /\d:\d/.test(quote) || /^[1-3]\b/.test(bookToken)
        const confidence = hasVerse || unglued || hasCue ? 90 : 55

        results.push({ bookNumber: book.number, book: book.name, chapter, verseStart, verseEnd, confidence, quote })
        if (options.claimSpan) claimedSpans.push({ from: match.index, to: match.index + match[0].length })
    }

    const scan = (regex: RegExp | null, handle: (m: RegExpExecArray) => void) => {
        if (!regex) return
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(normalized)) !== null) handle(match)
    }

    scan(index.verseFirstRegex, (m) => pushMatch(m, { claimSpan: true, alwaysCued: true, verseOverride: (m.groups as ReferenceGroups)?.vA ?? (m.groups as ReferenceGroups)?.vB }))
    scan(index.chapterFirstRegex, (m) => !isClaimed(m.index) && pushMatch(m, { claimSpan: true, alwaysCued: true }))
    scan(index.psalmOrdinalRegex, (m) => !isClaimed(m.index) && pushMatch(m, { claimSpan: true, alwaysCued: true }))
    scan(index.singleChapterVerseRegex, (m) => !isClaimed(m.index) && pushMatch(m, { claimSpan: true, verseOverride: (m.groups as ReferenceGroups)?.vB }))
    scan(index.regex, (m) => !isClaimed(m.index + m[1].length) && pushMatch(m))

    return results
}
