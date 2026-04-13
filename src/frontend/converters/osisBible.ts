import type { Bible, Book, Chapter, Verse } from "json-bible/lib/Bible"
import { uid } from "uid"
import { formatToFileName } from "../components/helpers/show"
import { scriptures, scripturesCache } from "../stores"
import { setActiveScripture } from "./bible"
import { xml2json } from "./xml"
import { confirmCustom, promptCustom } from "../utils/popup"

export async function convertOSISBible(data: any[]) {
    for (const bible of data) {
        const obj = await XMLtoObject(bible.content)
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
    }
}

async function XMLtoObject(xml: string) {
    const bible = xml2json(xml, true)?.osis?.osisText || {}
    let books: Book[] = []

    bible.div?.forEach((book, bookIndex) => {
        if (!book) return

        const bookId = book["@osisID"]
        const name = book["@name"]
        const abbreviation = book["@abbr"]
        const bookNumber = (Object.keys(defaultNames).findIndex((a) => a === bookId) ?? bookIndex) + 1
        const chapters: Chapter[] = []

        if (!Array.isArray(book.chapter)) book.chapter = [book.chapter]
        book.chapter.forEach((chapter: any, chapterIndex: number) => {
            if (!chapter) return

            const chapterNumber = chapter["@osisID"].split(".")?.[1] ?? chapterIndex + 1
            const verses: Verse[] = []

            if (!Array.isArray(chapter.verse)) chapter.verse = [chapter.verse]
            chapter.verse.forEach((verse: any, verseIndex: number) => {
                if (!verse) return

                let text = verse["#text"] || ""
                if (!text.trim()) return

                text = text.replace(/<q(?:\s+xmlns="[^"]*")?\s+who="Jesus"\s+marker="">(.*?)<\/q>/g, '<span class="wj">$1</span>')

                const verseNumber = verse["@osisID"].split(".")?.[2] ?? verseIndex + 1

                verses.push({ number: verseNumber, text })
            })

            chapters.push({ number: chapterNumber, verses })
        })

        const bookData = { id: bookId, name, abbreviation, number: bookNumber, chapters }
        if (abbreviation) bookData.abbreviation = abbreviation
        books.push(bookData)
    })

    // header.work: title, contributor, creator, subject, date, description, publisher, type, identifier, source, language, relation, coverage, rights, scope, refSystem
    const info = bible.header?.work || {}

    // request manual translate
    // WIP duplicate of bebliaBible.ts
    const booksWithNoName = books.filter((a) => !a.name)
    if (booksWithNoName.length > 0) {
        if (await confirmCustom("Books are missing names, and are defaulting to English.<br>Would you like to translate them?")) {
            let newBooks: Book[] = []

            // prompt each book with no name
            for (const book of booksWithNoName) {
                if (book.name) {
                    newBooks.push(book)
                    continue
                }

                const defaultName = defaultNames[book.id || ""] || ""
                const newName = await promptCustom(`Name book ${book.number} (${defaultName}):`)
                newBooks.push({ ...book, name: newName || defaultName })
            }

            books = newBooks
        } else {
            books = books.map((a) => ({ ...a, name: a.name || defaultNames[a.id || ""] || "" }))
        }
    }
    books = books.map((a) => {
        delete a.id
        return a
    })

    return { name: info.title || info.description || "", metadata: { ...info, copyright: info.rights || "" }, books } as Bible
}

const defaultNames: any = {
    Gen: "Genesis",
    Exod: "Exodus",
    Lev: "Leviticus",
    Num: "Numbers",
    Deut: "Deuteronomy",
    Josh: "Joshua",
    Judg: "Judges",
    Ruth: "Ruth",
    "1Sam": "1 Samuel",
    "2Sam": "2 Samuel",
    "1Kgs": "1 Kings",
    "2Kgs": "2 Kings",
    "1Chr": "1 Chronicles",
    "2Chr": "2 Chronicles",
    Ezra: "Ezra",
    Neh: "Nehemiah",
    Esth: "Esther",
    Job: "Job",
    Ps: "Psalm",
    Prov: "Proverbs",
    Eccl: "Ecclesiastes",
    Song: "Song of Solomon",
    Isa: "Isaiah",
    Jer: "Jeremiah",
    Lam: "Lamentations",
    Ezek: "Ezekiel",
    Dan: "Daniel",
    Hos: "Hosea",
    Joel: "Joel",
    Amos: "Amos",
    Obad: "Obadiah",
    Jonah: "Jonah",
    Mic: "Micah",
    Nah: "Nahum",
    Hab: "Habakkuk",
    Zeph: "Zephaniah",
    Hag: "Haggai",
    Zech: "Zechariah",
    Mal: "Malachi",

    Matt: "Matthew",
    Mark: "Mark",
    Luke: "Luke",
    John: "John",
    Acts: "Acts",
    Rom: "Romans",
    "1Cor": "1 Corinthians",
    "2Cor": "2 Corinthians",
    Gal: "Galatians",
    Eph: "Ephesians",
    Phil: "Philippians",
    Col: "Colossians",
    "1Thess": "1 Thessalonians",
    "2Thess": "2 Thessalonians",
    "1Tim": "1 Timothy",
    "2Tim": "2 Timothy",
    Titus: "Titus",
    Phlm: "Philemon",
    Heb: "Hebrews",
    Jas: "James",
    "1Pet": "1 Peter",
    "2Pet": "2 Peter",
    "1John": "1 John",
    "2John": "2 John",
    "3John": "3 John",
    Jude: "Jude",
    Rev: "Revelation"
}
