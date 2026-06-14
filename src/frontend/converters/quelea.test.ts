// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"

vi.mock("../components/edit/scripts/chords", () => ({ isChordLine: () => false, parseChordLine: () => [] }))
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({
    checkName: (n: string) => n,
    getGlobalGroup: (g: string) => {
        const k = g.toLowerCase().replace(/[\s\d]/g, "")
        return k === "verse" || k === "chorus" ? k : ""
    }
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
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertQuelea } from "./quelea"

const SONG = `<song>
<title>Amazing Grace</title>
<author>John Newton</author>
<ccli>12345</ccli>
<lyrics>
<section title="Verse 1"><lyrics>Amazing grace how sweet
That saved a wretch</lyrics></section>
<section title="Chorus"><lyrics>How precious</lyrics></section>
</lyrics>
</song>`

function run(content: string) {
    captured.length = 0
    vi.useFakeTimers()
    convertQuelea([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertQuelea", () => {
    it("reads metadata", () => {
        const show = run(SONG)
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton", CCLI: "12345" })
    })

    it("builds a slide per section and maps the group names", () => {
        const s = slides(run(SONG))
        expect(s.length).toBe(2)
        expect(lineValues(s[0])).toEqual(["Amazing grace how sweet", "That saved a wretch"])
        expect(s[0].globalGroup).toBe("verse")
        expect(s[1].globalGroup).toBe("chorus")
    })
})
