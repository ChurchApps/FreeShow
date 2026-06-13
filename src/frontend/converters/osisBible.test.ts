// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { get } from "svelte/store"

vi.mock("../components/helpers/show", () => ({ formatToFileName: (n: string) => n }))
vi.mock("./bible", () => ({ setActiveScripture: () => {} }))
vi.mock("../utils/popup", () => ({ confirmCustom: async () => false, promptCustom: async () => "" }))

import { convertOSISBible } from "./osisBible"
import { scriptures, scripturesCache } from "../stores"

// two <div> books so xml2json yields an array (the converter expects div.forEach)
const SAMPLE = `<osis><osisText>
<header><work><title>Test OSIS</title></work></header>
<div osisID="Gen" name="Genesis" abbr="Gen"><chapter osisID="Gen.1"><verse osisID="Gen.1.1">In the beginning</verse><verse osisID="Gen.1.2">And the earth</verse></chapter></div>
<div osisID="Exod" name="Exodus" abbr="Exo"><chapter osisID="Exod.1"><verse osisID="Exod.1.1">Now these are the names</verse></chapter></div>
</osisText></osis>`

async function run(content: string, name = "File") {
    scripturesCache.set({} as any)
    scriptures.set({} as any)
    await convertOSISBible([{ name, content }])
    return Object.values(get(scripturesCache))[0] as any
}

describe("convertOSISBible", () => {
    it("parses the OSIS structure into books/chapters/verses", async () => {
        const bible = await run(SAMPLE)
        expect(bible.name).toBe("Test OSIS")
        expect(bible.books).toHaveLength(2)
        expect(bible.books[0].name).toBe("Genesis")
        expect(bible.books[0].abbreviation).toBe("Gen")
        expect(bible.books[0].number).toBe(1)
        expect(bible.books[0].chapters[0].number).toBe("1")
        expect(bible.books[0].chapters[0].verses).toEqual([
            { number: "1", text: "In the beginning" },
            { number: "2", text: "And the earth" }
        ])
        expect(bible.books[1].name).toBe("Exodus")
        expect(bible.books[1].number).toBe(2)
    })

    it("registers the scripture in the store", async () => {
        await run(SAMPLE)
        expect((Object.values(get(scriptures))[0] as any).name).toBe("Test OSIS")
    })
})
