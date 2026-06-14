// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"

// XMLtoObject parses the song with a real DOMParser (provided by jsdom); the show-building
// collaborators are mocked so the OpenSong PARSER (metadata + lyrics/groups/chords) is tested.
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n, formatToFileName: (n: string) => n }))
vi.mock("../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("./bible", () => ({ setActiveScripture: () => {} }))

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
        media: Record<string, any> = {}
        layouts: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertOpenSong } from "./opensong"
import { groups } from "../stores"

function run(content: string) {
    captured.length = 0
    vi.useFakeTimers()
    convertOpenSong([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertOpenSong", () => {
    beforeEach(() => groups.set({ verse: { name: "Verse" } } as any))

    it("reads metadata from the XML via DOMParser", () => {
        const xml = "<song><title>Amazing Grace</title><author>John Newton</author><ccli>12345</ccli><lyrics>[V1]\n Line one</lyrics></song>"
        const show = run(xml)
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton", CCLI: "12345" })
    })

    it("builds slides and maps a [V] tag to the verse global group", () => {
        const xml = "<song><title>T</title><lyrics>[V1]\n Amazing grace how sweet\n That saved a wretch</lyrics></song>"
        const s = slides(run(xml))
        expect(s.length).toBe(1)
        expect(s[0].globalGroup).toBe("verse")
        expect(lineValues(s[0])).toEqual(["Amazing grace how sweet", "That saved a wretch"])
    })

    it("attaches a chord line (.) to the following lyric line", () => {
        const xml = "<song><title>T</title><lyrics>[V1]\n.G C\n Amazing grace</lyrics></song>"
        const line = slides(run(xml))[0].items[0].lines[0]
        expect(line.text[0].value).toBe("Amazing grace")
        expect(line.chords.map((c: any) => ({ pos: c.pos, key: c.key }))).toEqual([
            { pos: 0, key: "G" },
            { pos: 2, key: "C" }
        ])
    })

    it("collects ; comment lines as slide notes", () => {
        const xml = "<song><title>T</title><lyrics>[V1]\n;a note\n Lyric</lyrics></song>"
        expect(slides(run(xml))[0].notes).toBe("a note")
    })
})
