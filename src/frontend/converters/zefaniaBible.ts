import { uid } from "uid"
import type { Bible } from "../../types/Bible"
import { formatToFileName } from "../components/helpers/show"
import { scriptures, scripturesCache } from "./../stores"
import { setActiveScripture } from "./bible"
import { xml2json } from "./xml"

export function convertZefaniaBible(data: any[]) {
    data.forEach((bible) => {
        const obj: Bible = XMLtoObject(bible.content)
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

function XMLtoObject(xml: string): Bible {
    const bible = xml2json(xml, true)?.XMLBIBLE || {}
    const books: any[] = []

    bible.BIBLEBOOK.forEach((book: any) => {
        const name = book["@bname"]
        const bookNumber = book["@bnumber"]
        const chapters: any[] = []

        if (!Array.isArray(book.CHAPTER)) book.CHAPTER = [book.CHAPTER]
        book.CHAPTER.forEach((chapter: any) => {
            const chapterNumber = chapter["@cnumber"]
            const verses: any[] = []

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
                text += styledVerses.map((a) => a?.["#text"] || "").join(" ")

                // remove extra styling
                text = text.replaceAll("\n", "").replaceAll('<BR art="x-p"/>', "")

                verses.push({ number: verse["@vnumber"], text })
            })

            chapters.push({ number: chapterNumber, verses })
        })

        books.push({ name, number: bookNumber, chapters })
    })

    // INFORMATION: contributors, coverage, creator, date, description, format, identifier, language, publisher, rights, source, subject, title, type
    const info = bible.INFORMATION || {}

    return { name: info.title || bible["@biblename"] || "", metadata: { ...info, copyright: info.publisher || "" }, books }
}
