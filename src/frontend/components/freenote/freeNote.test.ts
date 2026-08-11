import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../types/Show"
import { buildAllSlides, buildBlockSlides, buildTempPayload, createClockItem, createMediaItem, createTimerItem, expandBibleShortcode, freeNoteFont, getFreeNoteTemplate } from "./freeNote"
import { extractFirstHeading, renderMarkdown, splitBlocks } from "./markdown"

vi.mock("dompurify", () => ({
    default: { sanitize: (html: string) => String(html) }
}))

// minimal writable stores so .set/.update/get() all behave like svelte/store
const h = vi.hoisted(() => {
    const makeWritable = <T>(initial: T) => {
        let value = initial
        const set = (v: T) => (value = v)
        const update = (fn: (a: T) => T) => (value = fn(value))
        const subscribe = (fn: (a: T) => void) => (fn(value), () => undefined)
        return { set, update, subscribe }
    }
    return {
        stores: {
            freeNoteSlides: makeWritable<any[]>([]),
            freeNoteNow: makeWritable(-1),
            freeNoteActive: makeWritable(false),
            freeNoteHistory: makeWritable<any[]>([]),
            freeNoteDrafts: makeWritable<any[]>([]),
            freeNoteVertical: makeWritable(""),
            freeNoteHorizontal: makeWritable(""),
            freeNoteFont: makeWritable(""),
            freeNoteMode: makeWritable<"markdown" | "rich">("markdown"),
            freeNoteProjection: makeWritable<string>(""),
            outputs: makeWritable<{ [key: string]: { enabled: boolean; name?: string } }>({}),
            saved: makeWritable(true),
            shows: makeWritable<any>({}),
            showsCache: makeWritable<any>({}),
            projects: makeWritable<any>({}),
            activeProject: makeWritable(""),
            activeShow: makeWritable(null)
        },
        sendFreeNote: vi.fn(),
        generateScriptureShowFromReference: vi.fn()
    }
})

vi.mock("../../stores", () => ({ ...h.stores }))
vi.mock("../../utils/request", () => ({ send: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: (text: string) => text }))
vi.mock("../helpers/output", () => ({ sendFreeNote: h.sendFreeNote }))
vi.mock("../helpers/media", () => ({ getFileName: (path: string) => path.split("/").pop() }))
vi.mock("../drawer/bible/scripture", () => ({ generateScriptureShowFromReference: h.generateScriptureShowFromReference }))
vi.mock("../../../types/Channels", () => ({ EXPORT: "EXPORT" }))
vi.mock("../../converters/txt", () => ({ convertText: vi.fn() }))
vi.mock("../helpers/history", () => ({ history: vi.fn() }))
vi.mock("../helpers/show", () => ({ checkName: (name: string) => name }))
vi.mock("../helpers/setShow", () => ({ loadShows: vi.fn() }))

beforeEach(() => {
    h.stores.freeNoteSlides.set([])
    h.stores.freeNoteNow.set(-1)
    h.stores.freeNoteActive.set(false)
    h.stores.freeNoteHistory.set([])
    h.stores.freeNoteDrafts.set([])
    h.stores.freeNoteMode.set("markdown")
    h.stores.freeNoteProjection.set("")
    h.stores.outputs.set({})
    h.stores.saved.set(true)
    h.stores.activeShow.set(null)
    h.sendFreeNote.mockClear()
    h.generateScriptureShowFromReference.mockReset()

    const memory: { [key: string]: string } = {}
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => memory[key] ?? null,
        setItem: (key: string, value: string) => (memory[key] = String(value)),
        removeItem: (key: string) => delete memory[key]
    })
})

describe("buildTempPayload", () => {
    it("returns the verified temp-slide shape", () => {
        const item: Item = { style: "top:0;", type: "text", textFit: "shrinkToFit", lines: [] }
        const payload = buildTempPayload([item], "out-1", { backgroundColor: "#c00000" })
        expect(payload).toEqual({
            id: "temp",
            categoryId: "",
            tempItems: [item],
            previousSlides: [],
            nextSlides: [],
            settings: { backgroundColor: "#c00000" },
            customDynamicValues: {}
        })
    })
})

describe("getFreeNoteTemplate", () => {
    it("finds a template by id", () => {
        expect(getFreeNoteTemplate("emergency_banner")?.name).toBe("Emergency Banner")
    })
    it("returns null for unknown ids", () => {
        expect(getFreeNoteTemplate("nope")).toBeNull()
    })
})

describe("splitBlocks", () => {
    it("splits on --- separators", () => {
        expect(splitBlocks("Hello\n---\nWorld\n---\nAgain")).toEqual(["Hello", "World", "Again"])
    })
})

describe("extractFirstHeading", () => {
    it("extracts the first # heading", () => {
        expect(extractFirstHeading("# Announcements\n\nSome notes")).toBe("Announcements")
    })
    it("returns an empty string when no heading exists", () => {
        expect(extractFirstHeading("Just text")).toBe("")
    })
})

describe("renderMarkdown", () => {
    it("renders a heading and paragraph", () => {
        const html = renderMarkdown("# Title\n\nHello world")
        expect(html).toContain("<h1>")
        expect(html).toContain("Hello world")
    })
})

describe("buildBlockSlides", () => {
    it("falls back to a markdown slide for plain text", async () => {
        const slides = await buildBlockSlides("Plain text", 0, getFreeNoteTemplate("full_announcement"))
        expect(slides).toHaveLength(1)
        expect(slides[0].items[0].type).toBe("text")
    })

    it("expands b: scripture shortcodes via the native pipeline", async () => {
        const scriptureItem: Item = { style: "top:0;", type: "text", textFit: "shrinkToFit", lines: [] }
        h.generateScriptureShowFromReference.mockResolvedValue({ slides: [[scriptureItem]] })
        const slides = await buildBlockSlides("b:John 3:16", 0, getFreeNoteTemplate("full_announcement"))
        expect(h.generateScriptureShowFromReference).toHaveBeenCalledWith("John 3:16")
        expect(slides).toHaveLength(1)
        expect(slides[0].items).toEqual([scriptureItem])
    })

    it("falls back to markdown when the bible reference fails", async () => {
        h.generateScriptureShowFromReference.mockResolvedValue(null)
        const slides = await buildBlockSlides("b:Not A Real Reference", 0, null)
        expect(slides).toHaveLength(1)
        expect(slides[0].items[0].type).toBe("text")
    })

    it("falls back to markdown for h: hymn shortcodes", async () => {
        const slides = await buildBlockSlides("h:Amazing Grace", 0, null)
        expect(slides).toHaveLength(1)
        expect(slides[0].name).toContain("Amazing Grace")
    })

    it("applies the default font to built slides", async () => {
        freeNoteFont.set("'Georgia'")
        const slides = await buildBlockSlides("Hello", 0, getFreeNoteTemplate("full_announcement"))
        expect(slides[0].items[0].lines[0].text[0].style).toContain("font-family:'Georgia';")
        freeNoteFont.set("")
    })
})

describe("buildAllSlides", () => {
    it("builds one slide per block", async () => {
        const slides = await buildAllSlides("Hello\n---\nWorld", getFreeNoteTemplate("full_announcement"))
        expect(slides).toHaveLength(2)
        expect(slides[0].name).toContain("Hello")
        expect(slides[1].name).toContain("World")
    })

    it("returns an empty list for empty source", async () => {
        expect(await buildAllSlides("", null)).toEqual([])
    })
})

describe("expandBibleShortcode", () => {
    it("returns null when no slides are generated", async () => {
        h.generateScriptureShowFromReference.mockResolvedValue(null)
        expect(await expandBibleShortcode("John 3:16")).toBeNull()
    })

    it("returns slides from the native pipeline", async () => {
        h.generateScriptureShowFromReference.mockResolvedValue({ slides: [[{ type: "text" }]] })
        const result = await expandBibleShortcode("Psalm 23")
        expect(result).toHaveLength(1)
    })
})

describe("media items", () => {
    it("builds a full-screen media item", () => {
        const item = createMediaItem("/path/to/image.png")
        expect(item.type).toBe("media")
        expect(item.src).toBe("/path/to/image.png")
        expect(item.fit).toBe("contain")
        expect(item.style).toContain("height:1080px;")
    })

    it("builds a timer item", () => {
        const item = createTimerItem()
        expect(item.type).toBe("timer")
        expect(item.timer?.type).toBe("counter")
    })

    it("builds a clock item", () => {
        const item = createClockItem()
        expect(item.type).toBe("clock")
        expect(item.clock?.showTime).toBe(true)
    })
})
