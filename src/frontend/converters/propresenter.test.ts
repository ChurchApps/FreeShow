// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"

// Covers both ProPresenter import shapes: the plain JSON paths (convertJSONToSlides /
// convertJSONBundleToSlides) and the XML path that base64-decodes RTF/PlainText
// (convertToSlides -> getSlideItems -> decodeBase64 -> RTFToText/decodeHex). xml2json stays
// real (jsdom DOMParser); the show-building collaborators are mocked.
vi.mock("../components/helpers/historyHelpers", () => ({ _updaters: {} }))
vi.mock("../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "STYLE" }))
vi.mock("../components/helpers/media", () => ({ getExtension: (p: string) => p, getFileName: (p: string) => p, getMediaType: () => "image" }))
vi.mock("../components/helpers/show", () => ({
    checkName: (n: string) => n,
    getGlobalGroup: (g: string) => g,
    initializeMetadata: (m: any) => m,
    newSlide: (s: any) => ({ group: null, color: null, settings: {}, notes: s.notes || "", items: s.items || [] })
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
        slides: Record<string, any> = {}
        layouts: Record<string, any> = {}
        media: Record<string, any> = {}
        constructor(_priv = false, category: unknown = null) {
            this.category = category
        }
    }
}))

import { convertProPresenter } from "./propresenter"
import { groups, shows } from "../stores"

// matches decodeBase64's per-byte (latin1) decoding; strip padding it can't handle
const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64").replace(/=/g, "")

function run(content: string, extension: string, name = "file") {
    captured.length = 0
    vi.useFakeTimers()
    convertProPresenter([{ content, name, extension }])
    vi.runAllTimers()
    vi.useRealTimers()
    return captured[0][0].show
}

const runJSON = (song: any, extension = "json") => run(JSON.stringify(song), extension)
const slides = (show: any) => Object.values(show.slides) as any[]
const layout = (show: any) => (Object.values(show.layouts)[0] as any).slides
const lineValues = (slide: any) => slide.items[0].lines.map((l: any) => l.text[0].value)

describe("convertProPresenter", () => {
    beforeEach(() => {
        groups.set({ verse: {}, chorus: {} } as any)
        shows.set({} as any)
    })

    describe("verses JSON", () => {
        const song = {
            name: "Amazing Grace",
            author: "John Newton",
            ccli: { songNumber: "12345" },
            verses: [
                ["Amazing grace how sweet\nThat saved a wretch", "v1"],
                ["How precious did that grace", "c1"]
            ],
            verse_order_list: ["v1", "c1"]
        }

        it("reads metadata", () => {
            const show = runJSON(song)
            expect(show.name).toBe("Amazing Grace")
            expect(show.meta).toMatchObject({ author: "John Newton", CCLI: "12345" })
        })

        it("turns verses into slides (one line per \\n) and maps groups", () => {
            const s = slides(runJSON(song))
            expect(s.length).toBe(2)
            expect(lineValues(s[0])).toEqual(["Amazing grace how sweet", "That saved a wretch"])
            expect(s[0].globalGroup).toBe("verse")
            expect(s[1].globalGroup).toBe("chorus")
        })

        it("orders the layout by verse_order_list", () => {
            const show = runJSON(song)
            const l = layout(show)
            expect(l.length).toBe(2)
            expect(lineValues(show.slides[l[0].id])).toEqual(["Amazing grace how sweet", "That saved a wretch"])
        })
    })

    describe("JSON bundle (data[].lyrics)", () => {
        it("splits <p>/<br> lyrics into lines", () => {
            const show = runJSON({ data: [{ lyrics: [{ lyrics: "<p>Line one<br>Line two</p>" }] }] })
            const s = slides(show)
            expect(s.length).toBe(1)
            expect(lineValues(s[0])).toEqual(["Line one", "Line two"])
        })
    })

    describe("XML path (base64 RTF / PlainText)", () => {
        const pro4 = (nsString: string) => `<RVPresentationDocument name="ignored" CCLISongTitle="Amazing Grace" CCLIAuthor="John Newton" CCLISongNumber="12345"><slides><RVDisplaySlide enabled="true" notes=""><displayElements><RVTextElement>${nsString}</RVTextElement></displayElements></RVDisplaySlide></slides></RVPresentationDocument>`
        const rtfData = (rtf: string) => `<NSString rvXMLIvarName="RTFData">${b64(rtf)}</NSString>`
        const plainText = (text: string) => `<NSString rvXMLIvarName="PlainText">${b64(text)}</NSString>`

        it("decodes base64 RTF into a slide line", () => {
            const show = run(pro4(rtfData("{\\rtf1\\ansi\\f0\\fs24 Hello World}")), "pro4")
            expect(lineValues(slides(show)[0])).toEqual(["Hello World"])
        })

        it("reads CCLI metadata from the document attributes (and name from the file)", () => {
            const show = run(pro4(rtfData("{\\rtf1\\ansi\\f0 Word}")), "pro4")
            expect(show.name).toBe("file")
            expect(show.meta).toMatchObject({ title: "Amazing Grace", author: "John Newton", CCLI: "12345" })
        })

        it("turns RTF \\par into a newline within the line", () => {
            const show = run(pro4(rtfData("{\\rtf1\\ansi\\f0 First\\par Second}")), "pro4")
            expect(lineValues(slides(show)[0])).toEqual(["First\n Second"])
        })

        it("falls back to PlainText, splitting paragraphs into separate lines", () => {
            const show = run(pro4(plainText("Line A\n\nLine B")), "pro4")
            expect(lineValues(slides(show)[0])).toEqual(["Line A", "Line B"])
        })
    })
})
