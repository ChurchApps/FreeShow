import { describe, it, expect, vi, beforeEach } from "vitest"

// convertChordPro transitively imports the whole app (ShowObj -> _show/language,
// show/setShow/itemHelpers -> stores/audio/pdfjs). Mock the heavy collaborators so we can
// unit-test the ChordPro PARSER itself. The real parsing (chords, metadata, sections) runs.
vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n || "", getGlobalGroup: (g: string) => g }))
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))

const captured: any[] = []
vi.mock("./importHelpers", () => ({ setTempShows: (shows: any[]) => captured.push(shows) }))

vi.mock("../classes/Show", () => ({
    ShowObj: class {
        name = ""
        category: unknown
        meta: Record<string, unknown> = {}
        slides: Record<string, unknown> = {}
        layouts: Record<string, { name: string; notes: string; slides: unknown[] }>
        constructor(_priv = false, category: unknown = null, layoutId = "L") {
            this.category = category
            this.layouts = { [layoutId]: { name: "", notes: "", slides: [] } }
        }
    }
}))

import { convertChordPro } from "./chordpro"
import { dictionary, drawerTabsData, groups } from "../stores"

function run(content: string, name = "Song") {
    captured.length = 0
    vi.useFakeTimers()
    convertChordPro([{ name, content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show // first show
}

const firstSlide = (show: any) => Object.values(show.slides)[0] as any
const layout = (show: any) => Object.values(show.layouts)[0] as any

describe("convertChordPro", () => {
    beforeEach(() => {
        drawerTabsData.set({} as any)
        groups.set({} as any)
        dictionary.set({} as any)
    })

    it("parses metadata directives and uses the title as the show name", () => {
        const show = run("{title: Amazing Grace}\n{artist: John Newton}\nAmazing grace")
        expect(show.name).toBe("Amazing Grace")
        expect(show.meta).toMatchObject({ title: "Amazing Grace", artist: "John Newton" })
    })

    it("maps metadata aliases (t -> title, ccli -> CCLI, f -> copyright, su -> publisher)", () => {
        const show = run("{t: My Song}\n{ccli: 12345}\n{f: Public Domain}\n{su: Hymnal}\nla la")
        expect(show.meta).toMatchObject({ title: "My Song", CCLI: "12345", copyright: "Public Domain", publisher: "Hymnal" })
    })

    it("extracts inline chords with their character positions", () => {
        const show = run("Amazing [G]grace how [C]sweet")
        const line = firstSlide(show).items[0].lines[0]
        expect(line.text[0].value).toBe("Amazing grace how sweet")
        expect(line.chords.map((c: any) => ({ pos: c.pos, key: c.key }))).toEqual([
            { pos: 8, key: "G" },
            { pos: 18, key: "C" }
        ])
    })

    it("puts # comment lines into the layout notes", () => {
        const show = run("# a helpful note\nLyric line")
        expect(layout(show).notes).toContain("a helpful note")
    })

    it("splits sections, carrying the chorus group across an explicit marker", () => {
        const show = run("{start_of_verse}\nVerse line\n{start_of_chorus}\nChorus line")
        const slides = Object.values(show.slides) as any[]
        expect(slides.length).toBe(2)
        expect(slides[1].group).toBe("chorus")
    })
})
