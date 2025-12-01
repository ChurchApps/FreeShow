import type { Bible, Book, Chapter, Verse } from "json-bible/lib/Bible"
import { uid } from "uid"
import { formatToFileName } from "../components/helpers/show"
import { scriptures, scripturesCache } from "./../stores"
import { setActiveScripture } from "./bible"
import { xml2json } from "./xml"

export function convertZefaniaBible(data: any[]) {
    data.forEach(bible => {
        const obj = XMLtoObject(bible.content)
        if (!obj.name) obj.name = bible.name
        obj.name = formatToFileName(obj.name)

        const id = uid()
        // create folder & file
        scripturesCache.update(a => {
            a[id] = obj
            return a
        })

        scriptures.update(a => {
            a[id] = { name: obj.name, id }
            return a
        })

        setActiveScripture(id)
    })
}

function XMLtoObject(xml: string) {
    const bible = xml2json(xml, true)?.XMLBIBLE || {}
    const books: Book[] = []

    if (!bible.BIBLEBOOK) return { name: "", books } as Bible

    if (!Array.isArray(bible.BIBLEBOOK)) bible.BIBLEBOOK = [bible.BIBLEBOOK]
    bible.BIBLEBOOK.forEach((book: any) => {
        if (!book) return
        const name = book["@bname"]
        const abbreviation = book["@babbr"]
        const bookNumber = book["@bnumber"]
        const chapters: Chapter[] = []

        if (!Array.isArray(book.CHAPTER)) book.CHAPTER = [book.CHAPTER]
        book.CHAPTER.forEach((chapter: any) => {
            if (!chapter) return
            const chapterNumber = chapter["@cnumber"]
            const verses: Verse[] = []

            if (!Array.isArray(chapter.VERS)) chapter.VERS = [chapter.VERS]
            chapter.VERS.forEach((verse: { ["@vnumber"]: string; ["#text"]?: string; STYLE?: string[] }) => {
                if (!verse) return
                let text = verse["#text"] || ""

                // remove <NOTE></NOTE>
                while (text.indexOf("<NOTE") > -1) {
                    text = text.slice(0, text.indexOf("<NOTE")) + text.slice(text.indexOf("</NOTE") + 7)
                }

                // add styled verses
                let styledVerses = verse.STYLE || []
                if (!Array.isArray(styledVerses)) styledVerses = [styledVerses]
                text += styledVerses.map(a => a?.["#text"] || "").join(" ")

                // remove extra styling
                text = text.replaceAll("\n", " ").replaceAll('<BR art="x-p"/>', "")

                verses.push({ number: Number(verse["@vnumber"]), text })
            })

            chapters.push({ number: chapterNumber, verses })
        })

        const bookData = { name, abbreviation, number: bookNumber, chapters }
        if (abbreviation) bookData.abbreviation = abbreviation
        books.push(bookData)
    })

    // INFORMATION: contributors, coverage, creator, date, description, format, identifier, language, publisher, rights, source, subject, title, type
    const info = bible.INFORMATION || {}

    return { name: info.title || bible["@biblename"] || "", metadata: { ...info, copyright: info.publisher || "" }, books } as Bible
}
