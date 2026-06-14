import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the show-building collaborators so the SongBeamer (.sng) PARSER can be tested.
// convertSongbeamerFiles runs synchronously (no setTimeout) and calls setTempShows.
vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/helpers/history", () => ({ history: () => {} }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n, getGlobalGroup: (g: string) => g }))
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))

const captured: any[] = []
vi.mock("./importHelpers", () => ({ createCategory: () => "cat", setTempShows: (shows: any[]) => captured.push(shows) }))

vi.mock("../classes/Show", () => ({
    ShowObj: class {
        name = ""
        origin = ""
        category: unknown
        meta: Record<string, any> = {}
        quickAccess: any
        slides: Record<string, any> = {}
        layouts: Record<string, any>
        constructor(_priv = false, category: unknown = null, layoutId = "L") {
            this.category = category
            this.layouts = { [layoutId]: { name: "", notes: "", slides: [] } }
        }
    }
}))

import { convertSongbeamerFiles } from "./songbeamer"
import { categories, globalTags } from "../stores"

const BOM8 = String.fromCodePoint(0xef, 0xbb, 0xbf)

function run(content: string, name = "File", category = "Songbeamer") {
    captured.length = 0
    convertSongbeamerFiles({ files: [{ name, content }], category })
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const slideText = (slide: any) => slide.items.flatMap((it: any) => (it.lines || []).map((l: any) => l.text[0].value))

describe("convertSongbeamerFiles", () => {
    beforeEach(() => {
        categories.set({} as any)
        globalTags.set({} as any)
    })

    it("parses #-prefixed metadata and uses the title as the name", () => {
        const show = run("#Title=Test Song\n#Author=Me\n#CCLI=12345 extra\n#LangCount=1\n---\nVerse 1\nLine one\nLine two")
        expect(show.name).toBe("Test Song")
        expect(show.meta).toMatchObject({ title: "Test Song", author: "Me", CCLI: "12345" })
    })

    it("builds grouped slides with their lyric lines", () => {
        const show = run("#Title=Two Section\n#LangCount=1\n---\nVerse 1\nLine one\nLine two\n---\nChorus\nChorus line")
        const s = slides(show)
        expect(s.length).toBe(2)
        expect(s[0].group).toBe("Verse")
        expect(s[0].globalGroup).toBe("verse")
        expect(slideText(s[0])).toEqual(["Line one", "Line two"])
        expect(s[1].group).toBe("Chorus")
        expect(slideText(s[1])).toEqual(["Chorus line"])
    })

    it("falls back to the file name when there is no #Title", () => {
        const show = run("#Author=X\n#LangCount=1\n---\nVerse\nHi", "MyFile")
        expect(show.name).toBe("MyFile")
    })

    it("strips a leading UTF-8 BOM", () => {
        const show = run(BOM8 + "#Title=BOM Song\n#LangCount=1\n---\nVerse\nHi")
        expect(show.name).toBe("BOM Song")
    })
})
