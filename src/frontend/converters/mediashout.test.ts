// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"

vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/show", () => ({
    checkName: (n: string) => n,
    initializeMetadata: (m: any) => m,
    newSlide: (s: any) => ({ group: s.group ?? null, globalGroup: s.globalGroup, color: null, settings: {}, notes: s.notes || "", items: s.items || [] })
}))
vi.mock("../utils/language", () => ({ translateText: (id: string) => id }))

const captured: any[] = []
vi.mock("./importHelpers", () => ({ createCategory: () => "cat", setTempShows: (shows: any[]) => captured.push(shows) }))

vi.mock("../classes/Show", () => ({
    ShowObj: class {
        name = ""
        origin = ""
        category: unknown
        meta: Record<string, any> = {}
        slides: Record<string, any> = {}
        layouts: Record<string, any> = {}
        media: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertMediaShout } from "./mediashout"

const SONG = `<MediaShout5_Document><Cues><SongCue><Title>Amazing Grace</Title><SongID>s1</SongID><Author>John Newton</Author><CCLI>12345</CCLI><Content><Element><Number>1</Number><Type>1</Type><Text>Amazing grace
That saved</Text></Element><Element><Number>2</Number><Type>1</Type><Text>How precious</Text></Element></Content></SongCue></Cues></MediaShout5_Document>`

function run(content: string, name = "file") {
    captured.length = 0
    convertMediaShout([{ content, name }])
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertMediaShout", () => {
    it("reads metadata from the song cue", () => {
        const show = run(SONG)
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton", CCLI: "12345" })
    })

    it("makes a slide per Content Element, splitting Text on newlines", () => {
        const s = slides(run(SONG))
        expect(s.length).toBe(2)
        expect(lineValues(s[0])).toEqual(["Amazing grace", "That saved"])
        expect(s[0].globalGroup).toBe("verse")
        expect(lineValues(s[1])).toEqual(["How precious"])
    })
})
