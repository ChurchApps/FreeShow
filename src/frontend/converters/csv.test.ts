import { describe, it, expect, vi, beforeEach } from "vitest"

// Same approach as chordpro.test.ts: mock the heavy show-building collaborators so the CSV
// PARSER (parseCSVLine: quoted / triple-quoted / unquoted fields) can be unit-tested.
vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: unknown) => show }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n || "" }))
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

import { convertCSV } from "./csv"
import { drawerTabsData } from "../stores"

function run(content: string, name = "Sheet") {
    captured.length = 0
    vi.useFakeTimers()
    convertCSV([{ name, content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const fields = (slide: any) => slide.items.map((it: any) => it.lines[0].text[0].value)

describe("convertCSV", () => {
    beforeEach(() => drawerTabsData.set({} as any))

    it("makes one slide per row and one item per field", () => {
        const s = slides(run("a,b,c"))
        expect(s.length).toBe(1)
        expect(fields(s[0])).toEqual(["a", "b", "c"])
    })

    it("keeps commas inside quoted fields", () => {
        expect(fields(slides(run('"a,b",c'))[0])).toEqual(["a,b", "c"])
    })

    it("collapses triple-quoted fields to a single quoted value", () => {
        expect(fields(slides(run('"""hello"""'))[0])).toEqual(['"hello"'])
    })

    it("creates a slide per line and drops empty lines", () => {
        const s = slides(run("a,b\n\nc,d"))
        expect(s.length).toBe(2)
        expect(fields(s[0])).toEqual(["a", "b"])
        expect(fields(s[1])).toEqual(["c", "d"])
    })

    it("normalizes CRLF line endings (no stray carriage return)", () => {
        expect(fields(slides(run("a,b\r\nc,d"))[1])).toEqual(["c", "d"])
    })

    it("uses the file name as the show name", () => {
        expect(run("a", "My Sheet").name).toBe("My Sheet")
    })
})
