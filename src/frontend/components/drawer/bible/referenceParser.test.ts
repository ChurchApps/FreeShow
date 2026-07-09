import { describe, expect, it } from "vitest"
import { normalizeVerseSeparators, parseMultiBookReference, type BibleDataLike } from "./referenceParser"

// minimal stand-in for json-bible's bookSearch/getBook
const BOOKS = [
    { number: 1, name: "Genesis", chapters: { 1: 31, 2: 25 } as { [key: number]: number } },
    { number: 19, name: "Psalms", chapters: { 23: 6, 91: 16 } },
    { number: 43, name: "John", chapters: { 3: 36 } }
]

// expand "1-3+10" like json-bible does
function expandVerses(expression: string): number[] {
    const result: number[] = []
    expression.split("+").forEach((part) => {
        if (part.includes("-")) {
            let [start, end] = part.split("-").filter(Boolean).map(Number)
            if (Number.isNaN(end)) result.push(start)
            else for (let i = Math.min(start, end); i <= Math.max(start, end); i++) result.push(i)
        } else if (part) {
            const value = Number(part)
            if (!Number.isNaN(value)) result.push(value)
        }
    })
    return result
}

const fakeBible: BibleDataLike = {
    bookSearch(value: string) {
        const match = String(value).match(/^\s*([1-3]?\s?[A-Za-z]+\.?)\s*(.*)$/)
        if (!match) return { book: 0, chapter: 0, verses: [] }

        const name = match[1].trim().toLowerCase()
        const book = BOOKS.find((b) => b.name.toLowerCase().startsWith(name))
        if (!book) return { book: 0, chapter: 0, verses: [] }

        const rest = match[2].trim()
        const refMatch = rest.match(/^(\d+)(?:[:.](.*))?$/)
        const chapter = refMatch ? Number(refMatch[1]) : 0
        const verses = refMatch?.[2] ? expandVerses(refMatch[2]) : []

        return { book: book.number, chapter, verses }
    },
    getBook: (bookNumber) =>
        Promise.resolve({
            getChapter: (chapterNumber: number) => {
                const book = BOOKS.find((b) => Number(b.number) === Number(bookNumber))
                const verseCount = book?.chapters[chapterNumber] || 0
                return Promise.resolve({ data: { verses: Array.from({ length: verseCount }, (_, i) => ({ number: i + 1 })) } })
            }
        })
}

const parse = (value: string) => parseMultiBookReference(fakeBible, value, BOOKS)

describe("normalizeVerseSeparators", () => {
    it("converts commas between digits to the app's + separator", () => {
        expect(normalizeVerseSeparators("Psalm 91:1-3,10")).toBe("Psalm 91:1-3+10")
        expect(normalizeVerseSeparators("23:1, 2, 5-8")).toBe("23:1+2+5-8")
    })

    it("leaves trailing commas and text commas alone (typing in progress)", () => {
        expect(normalizeVerseSeparators("Psalm 91:1-3,")).toBe("Psalm 91:1-3,")
        expect(normalizeVerseSeparators("Psalm,")).toBe("Psalm,")
    })
})

describe("parseMultiBookReference", () => {
    it("parses multiple books with comma verse lists (the requested example)", async () => {
        const result = await parse("Psalm 91:1-3,10;Psalm 23:1-5,8-10")

        expect(result).not.toBeNull()
        expect(result!.books).toEqual([19, 19])
        expect(result!.chapters).toEqual([91, 23])
        expect(result!.verses).toEqual([
            [1, 2, 3, 10],
            [1, 2, 3, 4, 5, 8, 9, 10]
        ])
        expect(result!.referenceLabel).toBe("Psalms 91:1-3+10 ; 23:1-5+8-10")
    })

    it("switches books between segments", async () => {
        const result = await parse("Psalm 23:1-2;John 3:16")

        expect(result!.books).toEqual([19, 43])
        expect(result!.chapters).toEqual([23, 3])
        expect(result!.verses).toEqual([[1, 2], [16]])
        expect(result!.referenceLabel).toBe("Psalms 23:1-2 ; John 3:16")
    })

    it("labels a book again when returning to it after a different book", async () => {
        const result = await parse("Psalm 91:1;John 3:16;Psalm 23:1")

        expect(result!.books).toEqual([19, 43, 19])
        expect(result!.referenceLabel).toBe("Psalms 91:1 ; John 3:16 ; Psalms 23:1")
    })

    it("keeps the previous book for segments without one (existing behavior)", async () => {
        const result = await parse("Genesis 1:1-12;2:1-10")

        expect(result!.books).toEqual([1, 1])
        expect(result!.chapters).toEqual([1, 2])
        expect(result!.referenceLabel).toBe("Genesis 1:1-12 ; 2:1-10")
    })

    it("selects the whole chapter when a segment has no verses", async () => {
        const result = await parse("Psalm 23:1;John 3")

        expect(result!.books).toEqual([19, 43])
        expect(result!.verses[1]).toHaveLength(36)
    })

    it("expands cross-chapter spans within a book", async () => {
        const result = await parse("Genesis 1:30-2:2")

        expect(result!.books).toEqual([1, 1])
        expect(result!.chapters).toEqual([1, 2])
        expect(result!.verses).toEqual([
            [30, 31],
            [1, 2]
        ])
    })

    it("returns null for a single plain reference (handled by the regular search)", async () => {
        expect(await parse("Psalm 91:1-3,10")).toBeNull()
        expect(await parse("Psalm 91:1-5")).toBeNull()
    })

    it("returns null while a trailing segment is incomplete (typing in progress)", async () => {
        expect(await parse("Psalm 91:1-3;Psalm")).toBeNull()
        expect(await parse("Psalm 91:1-3;")).toBeNull()
    })

    it("returns null for unknown books", async () => {
        expect(await parse("Nowhere 1:1;2:2")).toBeNull()
    })
})
