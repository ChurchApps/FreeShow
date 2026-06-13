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

import { convertSoftProjector } from "./softprojector"

const SONG = {
    title: "Amazing Grace",
    number: 42,
    words: "John Newton",
    music: "Composer",
    notes: "a note",
    tune: "G",
    song_text: "Verse\nVerse line one\nVerse line two\n\nChorus\nChorus line"
}

function run(content: any) {
    captured.length = 0
    vi.useFakeTimers()
    convertSoftProjector([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertSoftProjector", () => {
    it("reads metadata from the song object", () => {
        const show = run({ Songs: [SONG] })
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ number: 42, title: "Amazing Grace", author: "John Newton", composer: "Composer", note: "a note", key: "G" })
    })

    it("uses the first line of each block as the group and the rest as lyrics", () => {
        const s = slides(run({ Songs: [SONG] }))
        expect(s.length).toBe(2)
        expect(s[0].globalGroup).toBe("verse")
        expect(lineValues(s[0])).toEqual(["Verse line one", "Verse line two"])
        expect(s[1].globalGroup).toBe("chorus")
        expect(lineValues(s[1])).toEqual(["Chorus line"])
    })
})
