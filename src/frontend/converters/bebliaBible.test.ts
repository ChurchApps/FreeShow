// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { get } from "svelte/store"

vi.mock("../components/helpers/show", () => ({ formatToFileName: (n: string) => n }))
vi.mock("./bible", () => ({ setActiveScripture: () => {} }))
vi.mock("../utils/popup", () => ({ confirmCustom: async () => false, promptCustom: async () => "" }))

import { convertBebliaBible } from "./bebliaBible"
import { scriptures, scripturesCache } from "../stores"

const SAMPLE = `<bible name="Test Beblia" info="(c) Someone">
<testament>
<book number="1" name="Genesis">
<chapter number="1">
<verse number="1">In the beginning</verse>
<verse number="2">And the earth</verse>
</chapter>
</book>
</testament>
</bible>`

async function run(content: string, name = "File") {
    scripturesCache.set({} as any)
    scriptures.set({} as any)
    await convertBebliaBible([{ name, content }])
    return Object.values(get(scripturesCache))[0] as any
}

describe("convertBebliaBible", () => {
    it("parses the Beblia structure into books/chapters/verses", async () => {
        const bible = await run(SAMPLE)
        expect(bible.name).toBe("Test Beblia")
        expect(bible.metadata.copyright).toBe("(c) Someone")
        expect(bible.books).toHaveLength(1)
        expect(bible.books[0]).toMatchObject({ number: "1", name: "Genesis" })
        expect(bible.books[0].chapters[0].number).toBe("1")
        expect(bible.books[0].chapters[0].verses).toEqual([
            { number: "1", text: "In the beginning" },
            { number: "2", text: "And the earth" }
        ])
    })

    it("registers the scripture in the store", async () => {
        await run(SAMPLE)
        expect((Object.values(get(scriptures))[0] as any).name).toBe("Test Beblia")
    })
})
