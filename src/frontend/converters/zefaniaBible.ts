import { uid } from "uid"
import type { Bible } from "../../types/Bible"
import { formatToFileName } from "../components/helpers/show"
import { scriptures, scripturesCache } from "./../stores"
import { xml2json } from "./xml"

export function convertZefaniaBible(data: any[]) {
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
    })
}

function XMLtoObject(xml: string): Bible {
    let bible = xml2json(xml, true)?.XMLBIBLE || {}
    let books: any[] = []

    bible.BIBLEBOOK.forEach((book: any) => {
        let name = book["@bname"]
        let number = book["@bnumber"]
        let chapters: any[] = []

        if (!Array.isArray(book.CHAPTER)) book.CHAPTER = [book.CHAPTER]
        book.CHAPTER.forEach((chapter: any, i) => {
            let number = chapter["@cnumber"]
            let verses: any[] = []

            if (!Array.isArray(chapter.VERS)) chapter.VERS = [chapter.VERS]
            chapter.VERS.forEach((verse: any, j) => {
                if (i === 9 && j < 3) console.log(verse)

                let value = verse["#text"] || ""

                // remove NOTE (WIP multiple notes in one verse?)
                let noteStart = value.indexOf("<NOTE")
                if (noteStart > -1) value = value.slice(0, noteStart) + value.slice(value.indexOf("</NOTE") + 7)

                // add styles verses (WIP multiple styles)
                value += verse.STYLE?.["#text"] || ""

                // remove extra styling
                value = value.replaceAll("\n", "").replaceAll('<BR art="x-p"/>', "")

                verses.push({ number: verse["@vnumber"], value })
            })

            chapters.push({ number, verses })
        })

        books.push({ name, number, chapters })
    })

    // INFORMATION: contributors, coverage, creator, date, description, format, identifier, language, publisher, rights, source, subject, title, type
    let info = bible.INFORMATION || {}

    return { name: info.title || bible["@biblename"] || "", copyright: info.publisher || "", books }
}
