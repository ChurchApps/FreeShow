import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A minimal TrueType name table, sufficient to exercise the real metadata parser.
function fontBuffer() {
    const family = "Test Family"
    const bytes = new ArrayBuffer(46 + family.length * 2)
    const view = new DataView(bytes)
    view.setUint32(0, 0x00010000)
    view.setUint16(4, 1)
    view.setUint32(12, 0x6e616d65) // name
    view.setUint32(20, 28)
    view.setUint32(24, bytes.byteLength - 28)
    view.setUint16(30, 1)
    view.setUint16(32, 18)
    view.setUint16(34, 3) // UTF-16BE
    view.setUint16(40, 1) // family name
    view.setUint16(42, family.length * 2)
    for (let i = 0; i < family.length; i++) view.setUint16(46 + i * 2, family.charCodeAt(i))
    return bytes
}

describe("custom fonts", () => {
    let fonts: typeof import("./fonts")
    let links: any[]
    let documentFonts: { add: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> }

    beforeEach(async () => {
        vi.resetModules()
        links = []
        documentFonts = { add: vi.fn(), load: vi.fn().mockResolvedValue([{}]) }
        vi.stubGlobal("document", {
            fonts: documentFonts,
            createElement: vi.fn(() => ({ remove: vi.fn() })),
            head: { appendChild: vi.fn((link) => links.push(link)) }
        })
        vi.stubGlobal(
            "FontFace",
            class {
                constructor(
                    public family: string,
                    public source: unknown,
                    public descriptors: unknown
                ) {}
                async load() {
                    return this
                }
            }
        )
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => fontBuffer() }))
        fonts = await import("./fonts")
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it("keeps built-in fonts available when local font access fails", async () => {
        vi.stubGlobal("window", { queryLocalFonts: vi.fn().mockRejectedValue(new Error("Denied")) })
        const options = await fonts.getSystemFontsList()
        expect(options.some((font) => font.label === "CMGSans")).toBe(true)
    })

    it("merges custom families without duplicating installed fonts or weights", () => {
        const system = [{ label: "Arial", value: "'Arial'" }]
        const merged = fonts.mergeCustomFontOptions(system, [
            { name: "arial", path: "" },
            { name: "Roboto", path: "" },
            { name: "Roboto", path: "/Roboto-Bold.ttf" }
        ])
        expect(merged.map((font) => font.label)).toEqual(["Arial", "Roboto"])
        expect(system).toHaveLength(1)
        expect(fonts.mergeCustomFontOptions(system, [])).toEqual(system)
    })

    it("restores global choices from settings while keeping imported fonts local to their show", async () => {
        const { special, globalCustomFonts } = await import("../../stores")
        special.set({})
        expect(get(globalCustomFonts)).toEqual([])

        // Settings loaded at startup use the same store as live output updates.
        const registered = [{ name: "Global Family", path: "/Fonts/Global.ttf" }]
        const imported = [{ name: "PPT Family", path: "/Import/PPT.ttf" }]
        const localBefore = structuredClone(imported)
        special.set(JSON.parse(JSON.stringify({ customFonts: registered, hideCursor: true })))
        const options = () => fonts.mergeCustomFontOptions([], get(globalCustomFonts))
        expect(options().map((option) => option.label)).toEqual(["Global Family"])
        expect(fonts.mergeCustomFontOptions(options(), imported).map((option) => option.label)).toEqual(["Global Family", "PPT Family"])

        special.update((settings) => ({ ...settings, customFonts: [] }))
        expect(options()).toEqual([])
        expect(get(special).hideCursor).toBe(true)
        expect(imported).toEqual(localBefore)
        expect(fonts.mergeCustomFontOptions(options(), imported).map((option) => option.label)).toEqual(["PPT Family"])
        special.set({})
    })

    it("shares registered Google fonts across global and imported-show loaders", async () => {
        const font = { name: "Roboto", path: "" }
        const global = fonts.loadCustomFonts([font], false)
        const imported = fonts.loadCustomFonts([font])
        expect(links).toHaveLength(1)
        await links[0].onload()
        await Promise.all([global, imported])
        expect(documentFonts.load).toHaveBeenCalledOnce()
    })

    it("does not substitute Google fonts for inaccessible global local files", async () => {
        vi.mocked(fetch).mockRejectedValue(new Error("Missing file"))
        await fonts.loadCustomFonts([{ name: "Roboto", path: "/missing.ttf" }], false)
        expect(fetch).toHaveBeenCalledOnce()
        expect(links).toHaveLength(0)
    })

    it("shares in-flight Google loads and encodes the family in the URL", async () => {
        const font = { name: "Roboto & Serif", path: "" }
        const first = fonts.loadCustomFont(font)
        expect(fonts.loadCustomFont(font)).toBe(first)
        expect(links).toHaveLength(1)
        expect(links[0].href).toContain("family=Roboto%20%26%20Serif:wght@400;700")
        expect(fetch).not.toHaveBeenCalled()
        await links[0].onload()
        await expect(first).resolves.toEqual(font)
        expect(documentFonts.load).toHaveBeenCalledWith("100px 'Roboto & Serif'")
        await fonts.loadCustomFont(font)
        expect(links).toHaveLength(1)
    })

    it("removes failed stylesheets and permits retry after a network error", async () => {
        const font = { name: "Roboto", path: "" }
        const failed = fonts.loadCustomFont(font)
        const rejection = expect(failed).rejects.toThrow("Could not load Google font")
        links[0].onerror()
        await rejection
        expect(links[0].remove).toHaveBeenCalledOnce()
        const retry = fonts.loadCustomFont(font)
        expect(links).toHaveLength(2)
        await links[1].onload()
        await expect(retry).resolves.toEqual(font)
    })

    it("rejects a stylesheet that does not provide the requested font", async () => {
        documentFonts.load.mockResolvedValue([])
        const loading = fonts.loadCustomFont({ name: "Missing", path: "" })
        const rejection = expect(loading).rejects.toThrow()
        await links[0].onload()
        await rejection
        expect(links[0].remove).toHaveBeenCalledOnce()
    })

    it("times out stalled Google requests", async () => {
        vi.useFakeTimers()
        const loading = fonts.loadCustomFont({ name: "Roboto", path: "" })
        const rejection = expect(loading).rejects.toThrow()
        await vi.advanceTimersByTimeAsync(15000)
        await rejection
        expect(links[0].remove).toHaveBeenCalledOnce()
    })

    it("reads the actual family from a local file and caches it by path", async () => {
        const loaded = await fonts.loadCustomFont({ name: "", path: "C:\\Fonts\\Test #1.ttf" })
        expect(loaded).toEqual({ name: "Test Family", path: "C:\\Fonts\\Test #1.ttf" })
        expect(fetch).toHaveBeenCalledWith("file:///C:/Fonts/Test%20%231.ttf")
        expect(documentFonts.add.mock.calls[0][0].family).toBe("Test Family")
        await fonts.loadCustomFont(loaded)
        expect(fetch).toHaveBeenCalledOnce()
        expect(documentFonts.add).toHaveBeenCalledOnce()
        expect(links).toHaveLength(0)
    })

    it("rejects malformed local fonts without silently substituting a Google font", async () => {
        vi.mocked(fetch).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) } as Response)
        await expect(fonts.loadCustomFont({ name: "Bad", path: "/Bad.ttf" })).rejects.toThrow()
        expect(documentFonts.add).not.toHaveBeenCalled()
        expect(links).toHaveLength(0)
    })

    it("retries inaccessible local files after they become available", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Missing file"))
        const font = { name: "Test Family", path: "/Test.ttf" }
        await expect(fonts.loadCustomFont(font)).rejects.toThrow("Missing file")
        await expect(fonts.loadCustomFont(font)).resolves.toEqual(font)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("preserves the PowerPoint import fallback for missing local files", async () => {
        vi.mocked(fetch).mockRejectedValue(new Error("Missing file"))
        fonts.loadCustomFonts([{ name: "Roboto", path: "/missing.ttf" }])
        await vi.waitFor(() => expect(links).toHaveLength(1))
        await links[0].onload()
        expect(links[0].href).toContain("family=Roboto:")
    })
})
