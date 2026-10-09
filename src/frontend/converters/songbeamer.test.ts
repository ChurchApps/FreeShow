import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return {
            _set: (next: unknown) => (value = next),
            subscribe: (run: (value: unknown) => void) => {
                run(value)
                return () => {}
            }
        }
    }

    return {
        categories: makeStore({ songbeamer: { name: "Songbeamer" } }),
        globalTags: makeStore({}),
        capturedTempShows: [] as { id: string; show: any }[]
    }
})

vi.mock("../stores", () => ({
    categories: h.categories,
    globalTags: h.globalTags
}))

vi.mock("../classes/Show", () => ({
    ShowObj: class {
        name = ""
        origin = ""
        category: string | null
        settings: { activeLayout: string }
        quickAccess: Record<string, unknown> = {}
        meta: Record<string, unknown> = {}
        slides: Record<string, unknown> = {}
        layouts: Record<string, { name: string; notes: string; slides: any[] }>

        constructor(_isPrivate = false, category: string | null = null, layoutId: string) {
            this.category = category
            this.settings = { activeLayout: layoutId }
            this.layouts = { [layoutId]: { name: "", notes: "", slides: [] } }
        }
    }
}))

vi.mock("../components/helpers/show", () => ({
    checkName: (name: string) => name,
    getGlobalGroup: () => "verse"
}))

vi.mock("../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: any) => show }))

vi.mock("./importHelpers", () => ({
    createCategory: () => "songbeamer",
    setTempShows: (tempShows: { id: string; show: any }[]) => {
        h.capturedTempShows = tempShows
    }
}))

import { TranslationMethod } from "../../types/Songbeamer"
import { convertSongbeamerFiles } from "./songbeamer"

function layoutNotes(show: any): string {
    const layoutId = show.settings.activeLayout
    return show.layouts[layoutId]?.notes || ""
}

describe("convertSongbeamerFiles mixed metadata encoding", () => {
    it("decodes base64 comments with each file's own detected encoding", () => {
        h.capturedTempShows = []

        const utf8Song = "#Title=UTF8\n#Comments=w6Q=\n--\nVerse 1\nLine"
        const latin1Song = "#Title=Latin1\n#Comments=5A==\n--\nVerse 1\nLine"

        convertSongbeamerFiles({
            files: [
                { name: "utf8", content: utf8Song, encoding: "utf8" },
                { name: "latin1", content: latin1Song, encoding: "latin1" }
            ],
            category: "songbeamer",
            encoding: "utf8",
            translationMethod: TranslationMethod.MultiLine
        })

        expect(h.capturedTempShows).toHaveLength(2)

        const utf8Show = h.capturedTempShows.find(({ show }) => show.name === "UTF8")?.show
        const latin1Show = h.capturedTempShows.find(({ show }) => show.name === "Latin1")?.show

        expect(layoutNotes(utf8Show)).toBe("ä")
        expect(layoutNotes(latin1Show)).toBe("ä")
    })
})
