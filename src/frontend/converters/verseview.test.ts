// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"

vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n, initializeMetadata: (m: any) => m }))
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

import { convertVerseVIEW } from "./verseview"

// VerseVIEW stores lyrics in CDATA, with <slide> and <br> as separators
const SONG = `<songDB><song>
<name><![CDATA[Amazing Grace]]></name>
<author><![CDATA[John Newton]]></author>
<slide><![CDATA[Amazing grace<br>That saved<slide>How precious<br>did appear]]></slide>
</song></songDB>`

function run(content: string) {
    captured.length = 0
    vi.useFakeTimers()
    convertVerseVIEW([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertVerseVIEW", () => {
    it("reads CDATA metadata", () => {
        const show = run(SONG)
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton" })
    })

    it("splits CDATA lyrics on <slide> and <br>", () => {
        const s = slides(run(SONG))
        expect(s.length).toBe(2)
        expect(lineValues(s[0])).toEqual(["Amazing grace", "That saved"])
        expect(lineValues(s[1])).toEqual(["How precious", "did appear"])
    })
})
