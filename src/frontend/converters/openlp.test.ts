// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"

// OpenLP parses OpenLyrics XML through xml2json (kept real, backed by jsdom's DOMParser).
// The show-building collaborators are mocked so the parser is what's under test.
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n }))
vi.mock("../utils/language", () => ({ translateText: (id: string) => id }))

const captured: any[] = []
vi.mock("./importHelpers", () => ({ createCategory: () => "cat", setTempShows: (shows: any[]) => captured.push(shows) }))

vi.mock("../classes/Show", () => ({
    ShowObj: class {
        name = ""
        origin = ""
        category: unknown
        meta: Record<string, any> = {}
        quickAccess: any
        timestamps: any
        slides: Record<string, any> = {}
        layouts: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertOpenLP } from "./openlp"
import { groups } from "../stores"

const SONG = `<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8" modifiedDate="2012-04-10T22:00:00">
<properties>
<titles><title>Amazing Grace</title></titles>
<authors><author type="words">John Newton</author></authors>
<copyright>Public Domain</copyright>
<ccliNo>12345</ccliNo>
<verseOrder>v1 c1</verseOrder>
</properties>
<lyrics>
<verse name="v1"><lines>Amazing grace how sweet<br/>That saved a wretch</lines></verse>
<verse name="c1"><lines>How precious did that grace</lines></verse>
</lyrics>
</song>`

function run(content: string) {
    captured.length = 0
    vi.useFakeTimers()
    convertOpenLP([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const layout = (show: any) => (Object.values(show.layouts)[0] as any).slides
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertOpenLP", () => {
    beforeEach(() => groups.set({ verse: {}, chorus: {} } as any))

    it("reads OpenLyrics metadata", () => {
        const show = run(SONG)
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton", CCLI: "12345", copyright: "Public Domain" })
    })

    it("builds verses, splitting on <br/> and mapping group names", () => {
        const s = slides(run(SONG))
        expect(s.length).toBe(2)
        expect(lineValues(s[0])).toEqual(["Amazing grace how sweet", "That saved a wretch"])
        expect(s[0].globalGroup).toBe("verse")
        expect(s[1].globalGroup).toBe("chorus")
    })

    it("orders the layout by verseOrder", () => {
        const show = run(SONG)
        const l = layout(show)
        expect(l.length).toBe(2)
        // first layout entry should resolve to the verse slide
        const firstSlide = show.slides[l[0].id]
        expect(lineValues(firstSlide)).toEqual(["Amazing grace how sweet", "That saved a wretch"])
    })

    it("extracts inline [chord] markers with positions", () => {
        const xml = '<song xmlns="http://openlyrics.info/namespace/2009/song" modifiedDate="2012-01-01"><properties><titles><title>T</title></titles></properties><lyrics><verse name="v1"><lines>Amazing [G]grace</lines></verse></lyrics></song>'
        const line = slides(run(xml))[0].items[0].lines[0]
        expect(line.text[0].value).toBe("Amazing grace")
        expect(line.chords.map((c: any) => ({ pos: c.pos, key: c.key }))).toEqual([{ pos: 8, key: "G" }])
    })
})
