// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { get } from "svelte/store"

// xml2json stays real (jsdom DOMParser); the store-writing collaborators are mocked/observed.
vi.mock("../components/helpers/show", () => ({ formatToFileName: (n: string) => n }))
vi.mock("./bible", () => ({ setActiveScripture: () => {} }))

import { convertZefaniaBible } from "./zefaniaBible"
import { scriptures, scripturesCache } from "../stores"

const SAMPLE = `<XMLBIBLE biblename="Test Bible">
<BIBLEBOOK bnumber="1" bname="Genesis" babbr="Gen">
<CHAPTER cnumber="1">
<VERS vnumber="1">In the beginning God created</VERS>
<VERS vnumber="2">And the earth was without form</VERS>
</CHAPTER>
</BIBLEBOOK>
</XMLBIBLE>`

function run(content: string, name = "File") {
    scripturesCache.set({} as any)
    scriptures.set({} as any)
    convertZefaniaBible([{ name, content }])
    return Object.values(get(scripturesCache))[0] as any
}

describe("convertZefaniaBible", () => {
    it("parses books, chapters and verses", () => {
        const bible = run(SAMPLE)
        expect(bible.name).toBe("Test Bible")
        expect(bible.books).toHaveLength(1)
        const book = bible.books[0]
        expect(book.name).toBe("Genesis")
        expect(book.abbreviation).toBe("Gen")
        expect(book.chapters[0].number).toBe("1")
        expect(book.chapters[0].verses).toEqual([
            { number: 1, text: "In the beginning God created" },
            { number: 2, text: "And the earth was without form" }
        ])
    })

    it("registers the scripture in the scriptures store", () => {
        run(SAMPLE)
        const entry = Object.values(get(scriptures))[0] as any
        expect(entry.name).toBe("Test Bible")
    })

    it("falls back to the file name when there is no biblename", () => {
        const bible = run('<XMLBIBLE><BIBLEBOOK bnumber="1" bname="Genesis"><CHAPTER cnumber="1"><VERS vnumber="1">Word</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>', "MyBible")
        expect(bible.name).toBe("MyBible")
    })
})
