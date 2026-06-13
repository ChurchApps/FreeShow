// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"

vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/show", () => ({
    checkName: (n: string) => n,
    getGlobalGroup: (g: string) => {
        const k = g.toLowerCase().replace(/[^a-z]/g, "")
        return ["verse", "chorus", "bridge", "tag", "intro", "outro"].includes(k) ? k : ""
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
        quickAccess: any
        slides: Record<string, any> = {}
        layouts: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertEasyslides } from "./easyslides"

// EasiSlides only imports when Item is an array, so include two items
const DATA = `<Easyslides>
<Item><Title1>Amazing Grace</Title1><SongNumber>42</SongNumber><Contents>Verse line one
Verse line two

[Chorus]
Chorus line</Contents></Item>
<Item><Title1>Second Song</Title1><Contents>Only line</Contents></Item>
</Easyslides>`

function run(content: string) {
    captured.length = 0
    vi.useFakeTimers()
    convertEasyslides([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0]
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertEasyslides", () => {
    it("creates a show per Item with its number metadata", () => {
        const shows = run(DATA)
        expect(shows).toHaveLength(2)
        expect(shows[0].show.name).toBe("Amazing Grace")
        expect(shows[0].show.meta).toEqual({ number: "42" })
    })

    it("splits Contents into slides and labels [Chorus]", () => {
        const show = run(DATA)[0].show
        const s = slides(show)
        expect(s.length).toBe(2)
        expect(lineValues(s[0])).toEqual(["Verse line one", "Verse line two"])
        expect(s[0].globalGroup).toBe("verse")
        expect(lineValues(s[1])).toEqual(["Chorus line"])
        expect(s[1].globalGroup).toBe("chorus")
    })
})
