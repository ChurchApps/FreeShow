import { describe, it, expect, vi, beforeEach } from "vitest"

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
        slides: Record<string, any> = {}
        layouts: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertVideopsalm } from "./videopsalm"
import { groups } from "../stores"

// VideoPsalm's native format uses unquoted keys; the converter repairs it into valid JSON.
// A single song runs synchronously (the multi-song path uses requestAnimationFrame).
function run(content: string) {
    captured.length = 0
    convertVideopsalm([{ content }])
    return captured[0][0].show
}

const slides = (show: any) => Object.values(show.slides) as any[]
const firstLine = (show: any) => (Object.values(show.slides)[0] as any).items[0].lines[0]

describe("convertVideopsalm", () => {
    beforeEach(() => groups.set({ verse: {} } as any))

    it("repairs the malformed JSON and reads song metadata", () => {
        const show = run(`{Songs:[{Text:"My Song",Author:"Me",Verses:[{Text:"Line A<br>Line B"}],Sequence:"V"}]}`)
        expect(show.name).toBe("My Song")
        expect(show.meta).toMatchObject({ title: "My Song", author: "Me" })
    })

    it("splits verse text on <br> into lines", () => {
        const show = run(`{Songs:[{Text:"My Song",Verses:[{Text:"Line A<br>Line B"}],Sequence:"V"}]}`)
        expect((slides(show)[0] as any).items[0].lines.map((l: any) => l.text[0].value)).toEqual(["Line A", "Line B"])
        expect((slides(show)[0] as any).globalGroup).toBe("verse")
    })

    it("extracts inline [chord] markers", () => {
        const show = run(`{Songs:[{Text:"My Song",Verses:[{Text:"Amazing [G]grace"}],Sequence:"V"}]}`)
        const line = firstLine(show)
        expect(line.text[0].value).toBe("Amazing grace")
        expect(line.chords.map((c: any) => ({ pos: c.pos, key: c.key }))).toEqual([{ pos: 8, key: "G" }])
    })
})
