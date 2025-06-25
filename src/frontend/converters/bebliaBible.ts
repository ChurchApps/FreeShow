import { scriptures, scripturesCache } from "./../stores"
import type { Bible } from "../../types/Bible"
import { uid } from "uid"
import { xml2json } from "./xml"
import { formatToFileName } from "../components/helpers/show"
import { setActiveScripture } from "./bible"
import { translate } from "../utils/language"

export function convertBebliaBible(data: any[]) {
    data.forEach((bible) => {
        const obj: Bible = convertToBible(xml2json(bible.content))
        if (!obj.name) obj.name = bible.name
        obj.name = formatToFileName(obj.name)

        const id = uid()
        // create folder & file
        scripturesCache.update((a) => {
            a[id] = obj
            return a
        })

        scriptures.update((a) => {
            a[id] = { name: obj.name, id }
            return a
        })

        setActiveScripture(id)
    })
}

function convertToBible(content: any): Bible {
    const bible: Bible = {
        name: content.bible["@name"] || content.bible["@translation"] || "",
        metadata: { copyright: content.bible["@info"] || "" },
        books: []
    }

    let testaments = content.bible.testament
    // some files might be missing <testament>
    if (testaments === undefined) testaments = [{ book: content.bible.book }]
    else if (!Array.isArray(testaments)) testaments = [testaments]
    const books: any[] = []

    testaments.forEach((a) => {
        books.push(...getBooks(a.book))
    })
    bible.books = books

    return bible
}

function getBooks(oldBooks: any[]) {
    const books: any[] = []
    if (!Array.isArray(oldBooks)) oldBooks = [oldBooks]
    
    oldBooks.forEach((book) => {
        const currentBook = {
            number: book["@number"],
            name: book["@name"] ?? translate(`biblebooknames.${book["@number"]}`),
            chapters: getChapters(book.chapter)
        }

        books.push(currentBook)
    })

    return books
}

function getChapters(oldChapters: any[]) {
    const chapters: any[] = []

    if (!Array.isArray(oldChapters)) oldChapters = [oldChapters]
    // console.log("Chapters:", oldChapters)
    oldChapters.forEach((chapter) => {
        const currentChapter = {
            number: chapter["@number"],
            verses: getVerses(chapter.verse || [])
        }

        chapters.push(currentChapter)
    })

    return chapters
}

function getVerses(oldVerses: any[]) {
    const verses: any[] = []

    if (!Array.isArray(oldVerses)) oldVerses = [oldVerses]
    // console.log("Verses:", oldVerses)
    oldVerses.forEach((verse) => {
        const currentVerse = {
            number: verse["@number"],
            text: verse["#text"]
        }

        verses.push(currentVerse)
    })

    return verses
}

export const defaultBibleBookNames: any = {
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
    66: "Revelation"
}