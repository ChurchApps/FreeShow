import { scriptures, scripturesCache } from "./../stores"
import type { Bible } from "../../types/Bible"
import { uid } from "uid"
import { xml2json } from "./xml"
import { formatToFileName } from "../components/helpers/show"

export function convertBebliaBible(data: any[]) {
    data.forEach((bible) => {
        let obj: Bible = convertToBible(xml2json(bible.content))
        if (!obj.name) obj.name = bible.name
        obj.name = formatToFileName(obj.name)

        let id = uid()
        // create folder & file
        scripturesCache.update((a) => {
            a[id] = obj
            return a
        })

        scriptures.update((a) => {
            a[id] = { name: obj.name, id }
            return a
        })
    })
}

function convertToBible(content: any): Bible {
    let bible: Bible = {
        name: content.bible["@name"] || content.bible["@translation"] || "",
        copyright: content.bible["@info"] || "",
        books: [],
    }

    let testaments = content.bible.testament
    if (!Array.isArray(testaments)) testaments = [testaments]
    let books: any[] = []
    testaments.forEach((a) => {
        books.push(...getBooks(a.book))
    })
    bible.books = books

    return bible
}

function getBooks(oldBooks: any[]) {
    let books: any[] = []

    oldBooks.forEach((book) => {
        let currentBook = {
            number: book["@number"],
            name: book["@name"] || defaultNames[book["@number"]],
            chapters: getChapters(book.chapter),
        }

        books.push(currentBook)
    })

    return books
}

function getChapters(oldChapters: any[]) {
    let chapters: any[] = []

    if (!Array.isArray(oldChapters)) oldChapters = [oldChapters]
    oldChapters.forEach((chapter) => {
        let currentChapter = {
            number: chapter["@number"],
            verses: getVerses(chapter.verse),
        }

        chapters.push(currentChapter)
    })

    return chapters
}

function getVerses(oldVerses: any[]) {
    let verses: any[] = []

    oldVerses.forEach((verse) => {
        let currentVerse = {
            number: verse["@number"],
            value: verse["#text"],
        }

        verses.push(currentVerse)
    })

    return verses
}

const defaultNames: any = {
    1: "Genesis",
    2: "Exodus",
    3: "Leviticus",
    4: "Numbers",
    5: "Deuteronomy",
    6: "Joshua",
    7: "Judges",
    8: "Ruth",
    9: "1 Samuel",
    10: "2 Samuel",
    11: "1 Kings",
    12: "2 Kings",
    13: "1 Chronicles",
    14: "2 Chronicles",
    15: "Ezra",
    16: "Nehemiah",
    17: "Esther",
    18: "Job",
    19: "Psalm",
    20: "Proverbs",
    21: "Ecclesiastes",
    22: "Song of Solomon",
    23: "Isaiah",
    24: "Jeremiah",
    25: "Lamentations",
    26: "Ezekiel",
    27: "Daniel",
    28: "Hosea",
    29: "Joel",
    30: "Amos",
    31: "Obadiah",
    32: "Jonah",
    33: "Micah",
    34: "Nahum",
    35: "Habakkuk",
    36: "Zephaniah",
    37: "Haggai",
    38: "Zechariah",
    39: "Malachi",

    40: "Matthew",
    41: "Mark",
    42: "Luke",
    43: "John",
    44: "Acts",
    45: "Romans",
    46: "1 Corinthians",
    47: "2 Corinthians",
    48: "Galatians",
    49: "Ephesians",
    50: "Philippians",
    51: "Colossians",
    52: "1 Thessalonians",
    53: "2 Thessalonians",
    54: "1 Timothy",
    55: "2 Timothy",
    56: "Titus",
    57: "Philemon",
    58: "Hebrews",
    59: "James",
    60: "1 Peter",
    61: "2 Peter",
    62: "1 John",
    63: "2 John",
    64: "3 John",
    65: "Jude",
    66: "Revelation",
}
