import { uid } from "uid"
import type { Bible } from "../../types/Bible"
import { formatToFileName } from "../components/helpers/show"
import { scriptures, scripturesCache } from "../stores"
import { xml2json } from "./xml"
import { setActiveScripture } from "./bible"

export function convertOSISBible(data: any[]) {
    data.forEach((bible) => {
        let obj: Bible = XMLtoObject(bible.content)
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

        setActiveScripture(id)
    })
}

function XMLtoObject(xml: string): Bible {
    let bible = xml2json(xml, true)?.osis?.osisText || {}
    let books: any[] = []

    bible.div?.forEach((book, i) => {
        let bookId = book["@osisID"]
        let name = defaultNames[bookId] || book["@name"]
        let number = (Object.keys(defaultNames).findIndex((a) => a === bookId) ?? i) + 1
        let chapters: any[] = []

        if (!Array.isArray(book.chapter)) book.chapter = [book.chapter]
        book.chapter.forEach((chapter: any, i: number) => {
            let number = chapter["@osisID"].split(".")?.[1] ?? i + 1
            let verses: any[] = []

            if (!Array.isArray(chapter.verse)) chapter.verse = [chapter.verse]
            chapter.verse.forEach((verse: any, i: number) => {
                let text = verse["#text"] || ""
                let number = verse["@osisID"].split(".")?.[2] ?? i + 1

                verses.push({ number, text })
            })

            chapters.push({ number, verses })
        })

        books.push({ name, number, chapters })
    })

    // header.work: title, contributor, creator, subject, date, description, publisher, type, identifier, source, language, relation, coverage, rights, scope, refSystem
    let info = bible.header?.work || {}

    return { name: info.title || info.description || "", metadata: { ...info, copyright: info.rights || "" }, books }
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
    Rev: "Revelation",
}
