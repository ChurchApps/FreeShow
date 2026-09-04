import type { AiScriptureBook } from "../../../../types/ai/AiScripture"
import { HOMOPHONE_ALT, normalizeSpokenNumbers, parseNumberToken } from "./numberUtils"
import { maxVerseInChapter } from "../chapterVerseCounts"
import { VERSE_WORD } from "../vocabulary"
import { ASR_BOOK_ALIASES, collapseStutteredBookNames, correctBookMishearings, FUZZY_MIN_LEN } from "./asrRepairs"
import { CANON_CHAPTER_COUNTS, MAX_VERSE_NUMBER } from "./canonChapters"

// TIER 1 (local regex)

export interface BookIndex {
    regex: RegExp | null
    chapterFirstRegex: RegExp | null // "the 8th chapter of (the book of) ezra (and the verse number 10)"
    verseFirstRegex: RegExp | null // "the 9th verse of (the 8th chapter of) ezra ((chapter) 8)"
    psalmOrdinalRegex: RegExp | null // "the 23rd psalm (verse 1)" - the ordinal-as-chapter idiom
    singleChapterVerseRegex: RegExp | null // "jude verse 3" - one-chapter books are spoken without their chapter
    byToken: Map<string, { name: string; number: number; chapterCount: number; requireVerse?: boolean }>
    bookPattern: string // alternation of all book name patterns ("" when no books)
    bookWords: string[] // distinct book-name words long enough for mishearing recovery
    allBookWords: string[] // distinct book-name words >= 4 chars, for the stutter collapse
}

// a spoken "8 18" often reaches us as "818". Recover the pair when the number cannot be a chapter of this book,
// and only when exactly one split works - an ambiguous number keeps its literal reading and waits for confirmation.
export function splitGluedReference(value: number, chapterCount: number): { chapter: number; verse: number } | null {
    if (!chapterCount || value <= chapterCount) return null

    const digits = String(value)
    const candidates: { chapter: number; verse: number }[] = []
    for (let cut = 1; cut < digits.length; cut++) {
        const versePart = digits.slice(cut)
        if (versePart.startsWith("0")) continue // "805" is not "8" + "05"

        const chapter = parseInt(digits.slice(0, cut), 10)
        const verse = parseInt(versePart, 10)
        if (chapter >= 1 && chapter <= chapterCount && verse >= 1 && verse <= MAX_VERSE_NUMBER) candidates.push({ chapter, verse })
    }

    return candidates.length === 1 ? candidates[0] : null
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function buildBookIndex(books: AiScriptureBook[]): BookIndex {
    const byToken = new Map<string, { name: string; number: number; chapterCount: number; requireVerse?: boolean }>()
    const tokens: string[] = []

    const canonNames = new Map<number, string>()
    books.forEach((book) => {
        // only a canon book has a known chapter count - without one a glued chapter+verse cannot be told apart from a chapter
        const chapterCount = book.canonNumber ? CANON_CHAPTER_COUNTS[book.canonNumber] || 0 : 0
        book.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (!token || byToken.has(token)) return
            // prefer the 66 book canon number so tier 1 & tier 2 (which always reports canon numbers) share one numbering domain
            byToken.set(token, { name: name.trim(), number: book.canonNumber ?? book.number, chapterCount })
            tokens.push(token)
        })
        if (book.canonNumber && !canonNames.has(book.canonNumber)) canonNames.set(book.canonNumber, book.names[0]?.trim() || "")
    })

    // the misheard forms, but only for books this bible actually has
    ASR_BOOK_ALIASES.forEach((entry) => {
        if (byToken.has(entry.alias)) return
        const name = canonNames.get(entry.canonNumber)
        if (!name) return
        byToken.set(entry.alias, { name, number: entry.canonNumber, chapterCount: CANON_CHAPTER_COUNTS[entry.canonNumber] || 0, requireVerse: entry.requireVerse })
        tokens.push(entry.alias)
    })

    // longest names first so "1 john" wins over "john"
    tokens.sort((a, b) => b.length - a.length)
    const patterns = tokens.map((token) => escapeRegex(token).replace(/ /g, "\\s+"))

    // THE VERSE TAIL - what may follow a resolved book+chapter. Four branches, named groups:
    //   v1: the verse-word route: "verse 16", ": 16", "and the verse number 16", "starting from
    //       verse 16" - spoken fillers only ride along WITH the verse word, so a bare "15 and 3"
    //       never reads as chapter-and-verse. Only this route accepts the spoken range words
    //       ("verses 16 and 17", "16 till 18", "16 down to 20") for the same reason
    //   v2: the ordinal-first route: "chapter 3, the 16th verse" - the digit ordinal suffix is
    //       required, so "3, 16 verses later" can never bind
    //   v3/v4: whisper's punctuation/plain separators: "3:16" is v1 (colon), "3, 16"/"3. 16"/
    //       "3-16"/"3;16"/"3 16" land here with the conservative range set (-, to, through)
    const rangeWord = "(?:\\s*(?:-|–|(?:down\\s+|up\\s+)?to\\b|through\\b|thru\\b|till\\b|until\\b|and\\b)\\s*(?<e1>\\d{1,3})\\b)?"
    const rangePlain = (name: string) => "(?:\\s*(?:-|–|to\\b|through\\b)\\s*(?<" + name + ">\\d{1,3})\\b)?"
    // the trailing "and N" branch (v5) is only honored when a spoken imperative opened the
    // reference ("give me nehemiah 8 and 6"); narration ("he acts 15 and 3 others") never has one
    const verseTail =
        "(?:" +
        ("\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?:starting\\s+|beginning\\s+|reading\\s+)?(?:from\\s+|at\\s+)?(?::|" + VERSE_WORD + "\\b)(?:\\s+numbers?\\b)?\\s*(?<v1>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangeWord) +
        ("|\\s*[,.]?\\s*(?:and\\s+)?(?:the\\s+)?(?<v2>\\d{1,3})(?:st|nd|rd|th)\\s+" + VERSE_WORD + "\\b") +
        ("|\\s*[-–,.;/]\\s*(?<v3>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangePlain("e3")) +
        ("|\\s+(?<v4>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")" + rangePlain("e4")) +
        ("|\\s+and\\s+(?<v5>\\d{1,3}\\b|" + HOMOPHONE_ALT + ")") +
        ")?"
    const bookAlt = patterns.join("|")

    // book first: "john 3...", "john chapter 3...", "john chapter number 3...", "john the 3rd chapter..."
    // (the bare "the N" intro requires the ordinal suffix AND the chapter word, so "give john the
    // 5 loaves" can never bind a chapter). A leading imperative ("give me nehemiah...") is captured
    // because it unlocks the bare "8 and 6" verse reading below
    // the imperative rides inside the LEAD group, so the reported quote still starts at the book
    const imperativeIntro = "(?:(?<imp>give\\s+me|turn\\s+(?:with\\s+me\\s+)?to|go\\s+to|open(?:\\s+(?:up\\s+)?(?:to|at))?|show\\s+me|read|take\\s+me\\s+to|let'?s\\s+(?:go\\s+to|read|open))\\s+(?:the\\s+)?(?:book\\s+of\\s+)?)?"
    const chapterIntro = "(?:chapter\\s+(?:number\\s+)?(?<cA>\\d{1,3})\\b|(?:the\\s+)?(?<cB>\\d{1,3})(?:st|nd|rd|th)\\s+chapter\\b|(?<cC>\\d{1,3})\\b)"
    const regex = patterns.length ? new RegExp("((?:^|[^a-z0-9])" + imperativeIntro + ")(?<book>" + bookAlt + ")[,.]?\\s+" + chapterIntro + verseTail, "g") : null

    // reversed spoken forms - each carries the word "chapter"/"verse"/"psalm" by construction,
    // so they always count as deliberate (cued) references downstream
    const ofBook = "\\s+of\\s+(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")\\b"
    // "the 8th chapter of (the book of) ezra ..." / "chapter (number) 8 of ezra ..."
    const chapterFirstRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter|chapter\\s+(?:number\\s+)?(?<cB>\\d{1,3}))" + ofBook + verseTail, "g") : null
    // "the 9th verse of (the 8th chapter of) ezra ((chapter) 8)" / "verse (number) 9 of ezra 8" -
    // with no chapter spoken anywhere, a single-chapter book (jude, philemon...) resolves to chapter 1
    const verseFirstRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:(?<vA>\\d{1,3})(?:st|nd|rd|th)?\\s+" + VERSE_WORD + "\\b|" + VERSE_WORD + "\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b)\\s+of\\s+(?:(?:the\\s+)?(?<cA>\\d{1,3})(?:st|nd|rd|th)?\\s+chapter\\s+of\\s+)?(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")\\b(?:[,.]?\\s+(?:chapter\\s+)?(?<cB>\\d{1,3})\\b)?", "g") : null
    // "the 23rd psalm (verse 1)" - the ordinal IS the chapter. Only the psalms idiom works this
    // way, so the form is built solely from the psalm book tokens (including the "palm" alias)
    const psalmTokens = tokens.filter((token) => /^psalms?$/.test(token) || byToken.get(token)?.number === 19)
    const psalmOrdinalRegex = psalmTokens.length ? new RegExp("(^|[^a-z0-9])the\\s+(?<cA>\\d{1,3})(?:st|nd|rd|th)\\s+(?<book>" + psalmTokens.map((token) => escapeRegex(token)).join("|") + ")\\b" + verseTail, "g") : null

    // "jude verse 3" / "the book of philemon verse six" - a one-chapter book is spoken without
    // its chapter. The regex matches any book; only chapterCount === 1 entries resolve (in
    // pushMatch), so "john verse 16" stays untouched for the anchored bare-verse path
    const singleChapterVerseRegex = patterns.length ? new RegExp("(^|[^a-z0-9])(?:the\\s+)?(?:book\\s+of\\s+)?(?<book>" + bookAlt + ")[,.]?\\s+" + VERSE_WORD + "\\s+(?:number\\s+)?(?<vB>\\d{1,3})\\b" + rangePlain("e4"), "g") : null

    // words long enough to recover from a mishearing ("corinians" -> "corinthians"); short names
    // ("john", "kings") stay exact-only, their skeletons collide with everyday words too easily
    const bookWords = new Set<string>()
    for (const token of tokens) for (const word of token.split(" ")) if (word.length >= FUZZY_MIN_LEN) bookWords.add(word)

    // every book word down to 4 chars, for the stutter collapse - a repeated name merged by the
    // decoder ("Ezra... Ezra" -> "ezrazra") is recoverable even for names too short to fuzzy-match
    const allBookWords = new Set<string>()
    for (const token of tokens) for (const word of token.split(" ")) if (word.length >= 4) allBookWords.add(word)

    return { regex, chapterFirstRegex, verseFirstRegex, psalmOrdinalRegex, singleChapterVerseRegex, byToken, bookPattern: patterns.join("|"), bookWords: Array.from(bookWords), allBookWords: Array.from(allBookWords) }
}

interface ReferenceMatch {
    bookNumber: number
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    quote: string
}

// named groups shared by every reference regex: book, cA/cB/cC (chapter routes),
// vA/vB (reversed-form verse routes), v1..v4 (verse-tail routes), e1/e3/e4 (range ends)
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

export function matchReferences(text: string, index: BookIndex): ReferenceMatch[] {
    if (!index.regex) return []

    const normalized = correctBookMishearings(collapseStutteredBookNames(normalizeSpokenNumbers(text), index.allBookWords), index.bookWords)
    const results: ReferenceMatch[] = []

    // the specific spoken forms scan first - their spans are excluded from the general book-first
    // scan, or "9th verse of ezra chapter 8" would also surface a chapter-only "ezra chapter 8" echo
    const claimedSpans: { from: number; to: number }[] = []

    const pushMatch = (match: RegExpExecArray, options: { claimSpan?: boolean; alwaysCued?: boolean; verseOverride?: string } = {}) => {
        const groups = (match.groups || {}) as ReferenceGroups
        const bookToken = (groups.book || "").replace(/\s+/g, " ")
        const book = index.byToken.get(bookToken)
        if (!book) return

        let chapter = parseInt(groups.cA ?? groups.cB ?? groups.cC ?? "", 10)
        // a verse-first form with no chapter anywhere still resolves for a single-chapter book
        if (!(chapter >= 1) && options.verseOverride !== undefined && book.chapterCount === 1) chapter = 1
        if (!(chapter >= 1)) return

        const verseRaw = options.verseOverride ?? groups.v1 ?? groups.v2 ?? groups.v3 ?? groups.v4 ?? (groups.imp !== undefined ? groups.v5 : undefined)
        const hasVerse = verseRaw !== undefined
        let verseStart = 1
        let verseEnd = 1
        let unglued = false
        if (hasVerse) {
            verseStart = parseNumberToken(verseRaw)
            if (!(verseStart >= 1)) return
            const endRaw = groups.e1 ?? groups.e3 ?? groups.e4
            verseEnd = endRaw !== undefined ? parseInt(endRaw, 10) : verseStart
            if (verseEnd < verseStart) verseEnd = verseStart
        } else if (groups.cC !== undefined) {
            // a plain "book N" with no separator - the single number may be chapter+verse run together
            const split = splitGluedReference(chapter, book.chapterCount)
            if (split) {
                chapter = split.chapter
                verseStart = split.verse
                verseEnd = split.verse
                unglued = true
            }
        }

        // an ordinary-English alias ("look", "dude") only counts inside a full reference
        if (book.requireVerse && !hasVerse && !unglued) return

        // verse bounds (from AlloDel's #3): a verse the chapter does not have is a misheard
        // number, not a reference - drop it rather than project the wrong text. A range that
        // overruns is clamped, because its start is real. Non-canon books (chapterCount 0)
        // skip the check entirely
        if ((hasVerse || unglued) && book.chapterCount > 0) {
            const chapterLength = maxVerseInChapter(book.number, chapter)
            if (chapterLength > 0) {
                if (verseStart > chapterLength) return
                if (verseEnd > chapterLength) verseEnd = chapterLength
            }
        }

        const quote = match[0].slice(match[1].length)

        // CUE RULE: "high" only with an explicit cue in the spoken text - the word "chapter"/"verse", an ordinal/numbered
        // book prefix ("first john"/"1 john") or a digit:digit shape ("3:16"). normalizeSpokenNumbers() never introduces any
        // of these words (its digit ordinals land only where the shape already carried the cue), so checking the
        // normalized snippet reflects the original text.
        const hasCue = options.alwaysCued || /\bchapter\b|\bverses?\b/.test(quote) || /\d:\d/.test(quote) || /^[1-3]\b/.test(bookToken)

        // book + chapter + verse ("matthew 12 4"), the same pair run together ("deuteronomy 818") or a cued
        // chapter ("turn to matthew chapter 5") is deliberate spoken intent - "high" so auto mode projects it.
        // only a bare "bookname 15" ("he acts 15 years old") stays "medium" and waits for confirmation
        const confidence: "high" | "medium" | "low" = hasVerse || unglued || hasCue ? "high" : "medium"

        results.push({ bookNumber: book.number, book: book.name, chapter, verseStart, verseEnd, confidence, quote })
        if (options.claimSpan) claimedSpans.push({ from: match.index, to: match.index + match[0].length })
    }

    const scan = (regex: RegExp | null, handle: (match: RegExpExecArray) => void) => {
        if (!regex) return
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(normalized)) !== null) handle(match)
    }

    scan(index.verseFirstRegex, (match) => {
        const groups = (match.groups || {}) as ReferenceGroups
        pushMatch(match, { claimSpan: true, alwaysCued: true, verseOverride: groups.vA ?? groups.vB })
    })
    scan(index.chapterFirstRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match, { claimSpan: true, alwaysCued: true })
    })
    scan(index.psalmOrdinalRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match, { claimSpan: true, alwaysCued: true })
    })
    scan(index.singleChapterVerseRegex, (match) => {
        const bookAt = match.index
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        const groups = (match.groups || {}) as ReferenceGroups
        // only chapterCount === 1 books resolve here (pushMatch fills chapter 1) - "john verse 16"
        // falls through untouched for the anchored bare-verse path
        pushMatch(match, { claimSpan: true, verseOverride: groups.vB })
    })
    scan(index.regex, (match) => {
        const bookAt = match.index + match[1].length
        if (claimedSpans.some((span) => bookAt >= span.from && bookAt < span.to)) return
        pushMatch(match)
    })

    return results
}

export function detectExplicitReferences(text: string, books: AiScriptureBook[]): { bookNumber: number; book: string; chapter: number; verseStart: number; verseEnd: number; confidence: "high" | "medium" | "low" }[] {
    return matchReferences(text, buildBookIndex(books)).map((match) => ({ bookNumber: match.bookNumber, book: match.book, chapter: match.chapter, verseStart: match.verseStart, verseEnd: match.verseEnd, confidence: match.confidence }))
}
