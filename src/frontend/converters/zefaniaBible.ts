import { scriptures, scripturesCache } from "./../stores"
import type { Bible } from "../../types/Bible"
import { uid } from "uid"

export function convertZefaniaBible(data: any[]) {
  data.forEach((bible) => {
    let obj: Bible = XMLtoObject(bible.content)

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
  let parser = new DOMParser()
  // remove first line to ensure correct xml
  xml = xml.split("\n").slice(1, xml.split("\n").length).join("\n")
  let xmlDoc = parser.parseFromString(xml, "text/xml").children[0]

  let info = xmlDoc.querySelector("INFORMATION")
  console.log(info)
  let booksObj = getChildren(xmlDoc, "BIBLEBOOK")
  let books: any[] = []

  ;[...booksObj].forEach((book: any) => {
    let name = book.getAttribute("bname")
    let number = book.getAttribute("bnumber")
    let chapters: any[] = []
    ;[...getChildren(book, "CHAPTER")].forEach((chapter: any) => {
      let number = chapter.getAttribute("cnumber")
      let verses: any[] = []
      ;[...getChildren(chapter, "VERS")].forEach((verse: any) => {
        let value = verse.innerHTML.toString()
        verses.push({ number: verse.getAttribute("vnumber"), value })
      })
      chapters.push({ number, verses })
    })
    books.push({ name, number, chapters })
  })

  return { name: info?.querySelector("title")?.innerHTML || xmlDoc.getAttribute("biblename") || "", copyright: info?.querySelector("publisher")?.innerHTML || "", books }
}

const getChildren = (parent: any, name: string) => parent.getElementsByTagName(name)
