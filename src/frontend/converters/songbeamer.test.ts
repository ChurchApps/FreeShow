import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return {
            set: (next: unknown) => {
                value = next
            },
            update: (updater: (current: unknown) => unknown) => {
                value = updater(value)
            },
            _set: (next: unknown) => (value = next),
            subscribe: (run: (value: unknown) => void) => {
                run(value)
                return () => {}
            }
        }
    }

    return {
        activePopup: makeStore(null),
        alertMessage: makeStore(""),
        categories: makeStore({ songbeamer: { name: "Songbeamer" } }),
        drawerTabsData: makeStore({ shows: { activeSubTab: "songbeamer" } }),
        globalTags: makeStore({}),
        capturedTempShows: [] as { id: string; show: any }[]
    }
})

vi.mock("../stores", () => {
    return {
        activePopup: h.activePopup,
        alertMessage: h.alertMessage,
        categories: h.categories,
        drawerTabsData: h.drawerTabsData,
        globalTags: h.globalTags
    }
})

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

vi.mock("../components/helpers/array", () => ({
    clone: <T>(value: T) => {
        try {
            return structuredClone(value)
        } catch {
            return JSON.parse(JSON.stringify(value)) as T
        }
    }
}))

vi.mock("../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../components/helpers/setShow", () => ({ setQuickAccessMetadata: (show: any) => show }))
vi.mock("../utils/language", () => ({ translateText: (value: string) => value }))

vi.mock("../components/edit/scripts/itemHelpers", () => ({
    DEFAULT_ITEM_STYLE: "top:0;left:0;height:100px;width:100px;"
}))

vi.mock("./importHelpers", () => ({
    createCategory: () => "songbeamer",
    setTempShows: (tempShows: { id: string; show: any }[]) => {
        h.capturedTempShows = tempShows
    }
}))

import { convertSongbeamerFiles } from "./songbeamer"

async function runImport(files: any[]) {
    h.capturedTempShows = []
    convertSongbeamerFiles(files)
    await new Promise((resolve) => setTimeout(resolve, 20))
    return h.capturedTempShows
}

function layoutNotes(show: any): string {
    const layoutId = show.settings.activeLayout
    return show.layouts[layoutId]?.notes || ""
}

function findShowByName(name: string): any {
    return h.capturedTempShows.find(({ show }) => show.name === name)?.show
}

function slideText(show: any): string {
    const slides = Object.values(show?.slides || {}) as any[]
    return slides
        .flatMap((slide) => slide?.items || [])
        .flatMap((item) => item?.lines || [])
        .flatMap((line) => line?.text || [])
        .map((segment) => segment?.value || "")
        .join("\n")
}

describe("convertSongbeamerFiles mixed metadata encoding", () => {
    it("decodes base64 comments with each file's own detected encoding", async () => {
        const utf8Song = "#Title=UTF8\n#Comments=w6Q=\n--\nVerse 1\nfür"
        const latin1Song = "#Title=Latin1\n#Comments=5A==\n--\nVerse 1\nfür"

        await runImport([
            { name: "utf8", content: utf8Song, encoding: "utf8" },
            { name: "latin1", content: latin1Song, encoding: "latin1" }
        ])

        expect(h.capturedTempShows).toHaveLength(2)

        const utf8Show = findShowByName("UTF8")
        const latin1Show = findShowByName("Latin1")

        expect(layoutNotes(utf8Show)).toBe("ä")
        expect(layoutNotes(latin1Show).replaceAll("\u0000", "")).toBe("ä")
        expect(slideText(utf8Show)).toContain("für")
        expect(slideText(latin1Show)).toContain("für")
    })

    it("defaults to utf8 for missing or unknown encoding and strips BOM", async () => {
        const bom8 = String.fromCodePoint(0xef, 0xbb, 0xbf)
        const bom16 = String.fromCodePoint(0xfeff)
        const utf8Song = `${bom8}#Title=NoEncoding\n#Comments=w6Q=\n--\nVerse 1\nfür`
        const unknownSong = `${bom16}#Title=UnknownEncoding\n#Comments=w6Q=\n--\nVerse 1\nfür`

        await runImport([
            { name: "no-encoding", content: utf8Song },
            { name: "unknown", content: unknownSong, encoding: "unknown" as any }
        ])

        const noEncodingShow = findShowByName("NoEncoding")
        const unknownEncodingShow = findShowByName("UnknownEncoding")

        expect(layoutNotes(noEncodingShow)).toBe("ä")
        expect(layoutNotes(unknownEncodingShow)).toBe("ä")
        expect(slideText(noEncodingShow)).toContain("für")
        expect(slideText(unknownEncodingShow)).toContain("für")
    })

    it("falls back to latin1 when utf8 metadata decoding fails", async () => {
        const fallbackSong = "#Title=Utf8Fallback\n#Comments=5A==\n--\nVerse 1"

        await runImport([{ name: "fallback", content: fallbackSong, encoding: "utf8" }])

        const fallbackShow = findShowByName("Utf8Fallback")
        expect(layoutNotes(fallbackShow)).toBe("ä")
    })

    it("keeps invalid base64 metadata unchanged", async () => {
        const invalidBase64Song = "#Title=InvalidBase64\n#Comments=not_base64!\n--\nVerse 1"

        await runImport([{ name: "invalid", content: invalidBase64Song, encoding: "utf8" }])

        const invalidShow = findShowByName("InvalidBase64")
        expect(layoutNotes(invalidShow)).toBe("not_base64!")
    })

    it("skips malformed entries and parses chords metadata", async () => {
        const chords = Buffer.from("1,1,C\r3,1,D", "latin1").toString("base64")
        const chordsSong = `#Title=Chords\n#Chords=${chords}\n--\nVerse 1\nLine`

        await runImport([
            { name: "chords", content: chordsSong, encoding: "utf8" },
            { name: "invalid-number", content: 1 as any, encoding: "utf8" },
            { name: "empty", content: "", encoding: "utf8" }
        ])

        expect(h.capturedTempShows).toHaveLength(1)

        const chordShow = findShowByName("Chords")
        const firstSlide = Object.values(chordShow?.slides || {})[0] as any
        const firstLineChords = firstSlide?.items?.[0]?.lines?.[0]?.chords || []

        expect(firstLineChords).toHaveLength(2)
        expect(firstLineChords.map((chord: any) => chord.key)).toEqual(["C", "D"])
    })
})
