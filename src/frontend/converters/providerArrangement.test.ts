import { describe, expect, it } from "vitest"
import type { Show, Slide } from "../../types/Show"
import { getArrangementContent, getArrangementSignature, getGroupSignature, hasSameSlideContent, matchArrangements, mergeAsNewArrangement } from "./providerArrangement"

function slide(group: string | null, lines: string[], children?: string[]): Slide {
    return {
        group,
        color: null,
        settings: {},
        notes: "",
        ...(children ? { children } : {}),
        items: lines.length ? [{ style: "", lines: lines.map((line) => ({ align: "", text: [{ style: "", value: line }] })) }] : []
    }
}

/** verse -> chorus -> verse2 -> chorus */
function buildShow(): Show {
    return {
        name: "Mare este Domnul",
        category: "song",
        settings: { activeLayout: "layout", template: null },
        timestamps: { created: 1, modified: null, used: null },
        meta: { title: "Mare este Domnul", artist: "Local artist" },
        slides: {
            v1: slide("Verse 1", ["mare este Domnul", "vrednic de laudă"]),
            c1: slide("Chorus", ["cânt spre Tine"]),
            v2: slide("Verse 2", ["mare e puterea Lui"])
        },
        layouts: { layout: { name: "Default", notes: "", slides: [{ id: "v1" }, { id: "c1" }, { id: "v2" }, { id: "c1" }] } },
        media: {}
    }
}

describe("getGroupSignature", () => {
    it("ignores case, punctuation and line splitting", () => {
        const a: Show = { ...buildShow(), slides: { x: slide("Verse", ["Mare este Domnul,", "vrednic de laudă!"]) } }
        const b: Show = { ...buildShow(), slides: { y: slide("Verse", ["mare este domnul vrednic", "DE LAUDĂ"]) } }
        expect(getGroupSignature(a, "x")).toBe(getGroupSignature(b, "y"))
    })

    it("includes the lyrics of child slides", () => {
        const show: Show = {
            ...buildShow(),
            slides: {
                parent: slide("Verse", ["prima linie"], ["child"]),
                child: slide(null, ["a doua linie"])
            }
        }
        expect(getGroupSignature(show, "parent")).toBe("prima linie a doua linie")
    })

    it("is empty for an instrumental slide", () => {
        const show: Show = { ...buildShow(), slides: { empty: slide("Instrumental", []) } }
        expect(getGroupSignature(show, "empty")).toBe("")
    })
})

describe("getArrangementSignature", () => {
    it("follows the order the layout presents the slides in", () => {
        const show = buildShow()
        const reordered: Show = { ...show, layouts: { layout: { name: "Default", notes: "", slides: [{ id: "c1" }, { id: "v1" }, { id: "v2" }, { id: "c1" }] } } }
        expect(getArrangementSignature(show)).not.toBe(getArrangementSignature(reordered))
    })

    it("is empty for a show without an arrangement", () => {
        const show = buildShow()
        expect(getArrangementSignature({ ...show, layouts: {} })).toBe("")
    })
})

describe("matchArrangements", () => {
    it("maps onto a non-active local arrangement that already matches", () => {
        const existing = buildShow()
        existing.layouts.other = { name: "OnStage", notes: "", slides: [{ id: "v1" }, { id: "c1" }] }

        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["mare este Domnul vrednic de laudă"]), b: slide("Chorus", ["cânt spre Tine"]) },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }] } },
            settings: { activeLayout: "incoming", template: null }
        }

        expect(matchArrangements(existing, incoming)).toEqual({ incoming: "other" })
    })

    it("maps every incoming arrangement, not just the active one", () => {
        const existing = buildShow()
        existing.layouts.short = { name: "Short", notes: "", slides: [{ id: "v1" }] }

        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["mare este Domnul vrednic de laudă"]), b: slide("Chorus", ["cânt spre Tine"]), c: slide("Verse 2", ["mare e puterea Lui"]) },
            layouts: {
                full: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "b" }] },
                short: { name: "Second service", notes: "", slides: [{ id: "a" }] }
            },
            settings: { activeLayout: "full", template: null }
        }

        expect(matchArrangements(existing, incoming)).toEqual({ full: "layout", short: "short" })
    })

    it("returns null when one incoming arrangement is new", () => {
        const existing = buildShow()
        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["mare este Domnul vrednic de laudă"]), b: slide("Chorus", ["cânt spre Tine"]), c: slide("Verse 2", ["mare e puterea Lui"]) },
            layouts: {
                full: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "b" }] },
                other: { name: "Second service", notes: "", slides: [{ id: "b" }, { id: "a" }] }
            },
            settings: { activeLayout: "full", template: null }
        }

        expect(matchArrangements(existing, incoming)).toBe(null)
    })

    it("returns null when the structure differs", () => {
        const existing = buildShow()
        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["versuri complet diferite"]) },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "a" }] } },
            settings: { activeLayout: "incoming", template: null }
        }

        expect(matchArrangements(existing, incoming)).toBe(null)
    })
})

describe("hasSameSlideContent", () => {
    // the same words the local show has, but re-split into one line per slide
    function buildResplit(): Show {
        return {
            ...buildShow(),
            slides: {
                a: slide("Verse 1", ["mare este Domnul"], ["a2"]),
                a2: slide(null, ["vrednic de laudă"]),
                b: slide("Chorus", ["cânt spre Tine"]),
                c: slide("Verse 2", ["mare e puterea Lui"])
            },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "b" }] } },
            settings: { activeLayout: "incoming", template: null }
        }
    }

    it("is true when the lyrics are split exactly the same way", () => {
        const existing = buildShow()
        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["mare este Domnul", "vrednic de laudă"]), b: slide("Chorus", ["cânt spre Tine"]), c: slide("Verse 2", ["mare e puterea Lui"]) },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "b" }] } },
            settings: { activeLayout: "incoming", template: null }
        }

        const layoutMap = matchArrangements(existing, incoming)
        expect(layoutMap).not.toBe(null)
        expect(hasSameSlideContent(existing, incoming, layoutMap!)).toBe(true)
    })

    it("is false when the same words are split into different slides", () => {
        const existing = buildShow()
        const incoming = buildResplit()

        // the structure still matches — only the split changed
        const layoutMap = matchArrangements(existing, incoming)
        expect(layoutMap).toEqual({ incoming: "layout" })
        expect(hasSameSlideContent(existing, incoming, layoutMap!)).toBe(false)
    })

    it("ignores trailing whitespace", () => {
        const existing = buildShow()
        const incoming: Show = {
            ...buildShow(),
            slides: { a: slide("Verse 1", ["mare este Domnul  ", "  vrednic de laudă"]), b: slide("Chorus", ["cânt spre Tine"]), c: slide("Verse 2", ["mare e puterea Lui"]) },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "b" }] } },
            settings: { activeLayout: "incoming", template: null }
        }

        const layoutMap = matchArrangements(existing, incoming)
        expect(hasSameSlideContent(existing, incoming, layoutMap!)).toBe(true)
    })
})

describe("getArrangementContent", () => {
    it("keeps line and slide boundaries", () => {
        const show = buildShow()
        expect(getArrangementContent(show)).toContain("mare este Domnul\nvrednic de laudă")
    })
})

describe("mergeAsNewArrangement", () => {
    function buildIncoming(): Show {
        return {
            name: "Mare este Domnul",
            category: "onstage",
            settings: { activeLayout: "incoming", template: null },
            timestamps: { created: 2, modified: null, used: null },
            meta: { title: "Mare este Domnul", CCLI: "12345", artist: "OnStage artist" },
            slides: {
                // same lyrics as the local Chorus, only split differently
                onstageChorus: slide("Chorus", ["cânt spre Tine"]),
                onstageBridge: slide("Bridge", ["punte nouă, versuri noi"])
            },
            layouts: { incoming: { name: "Default", notes: "", slides: [{ id: "onstageChorus" }, { id: "onstageBridge" }, { id: "onstageChorus" }] } },
            media: {}
        }
    }

    it("reuses the local slide when the lyrics already exist", () => {
        const { show: merged } = mergeAsNewArrangement(buildShow(), buildIncoming())
        const newLayoutId = merged.settings.activeLayout
        const slides = merged.layouts[newLayoutId].slides

        expect(slides[0].id).toBe("c1")
        expect(slides[2].id).toBe("c1")
    })

    it("adds genuinely new lyrics as a new slide", () => {
        const existing = buildShow()
        const { show: merged } = mergeAsNewArrangement(existing, buildIncoming())
        const bridgeId = merged.layouts[merged.settings.activeLayout].slides[1].id

        expect(Object.keys(existing.slides)).not.toContain(bridgeId)
        expect(merged.slides[bridgeId].group).toBe("Bridge")
        expect(getGroupSignature(merged, bridgeId)).toBe("punte nouă versuri noi")
    })

    it("keeps every local slide and arrangement", () => {
        const { show: merged } = mergeAsNewArrangement(buildShow(), buildIncoming())

        expect(Object.keys(merged.slides)).toEqual(expect.arrayContaining(["v1", "c1", "v2"]))
        expect(merged.layouts.layout.slides).toHaveLength(4)
    })

    it("makes the added arrangement the active one", () => {
        const { show: merged } = mergeAsNewArrangement(buildShow(), buildIncoming(), "OnStage")
        const newLayoutId = merged.settings.activeLayout

        expect(newLayoutId).not.toBe("layout")
        expect(merged.layouts[newLayoutId].name).toBe("OnStage")
        expect(merged.layouts[newLayoutId].slides).toHaveLength(3)
    })

    it("does not overwrite an arrangement of the same name", () => {
        const existing = buildShow()
        existing.layouts.previous = { name: "OnStage", notes: "", slides: [{ id: "v1" }] }

        const { show: merged } = mergeAsNewArrangement(existing, buildIncoming(), "OnStage")

        expect(merged.layouts.previous.name).toBe("OnStage")
        expect(merged.layouts[merged.settings.activeLayout].name).toBe("OnStage 2")
    })

    it("fills in missing song details without overwriting local ones", () => {
        const { show: merged } = mergeAsNewArrangement(buildShow(), buildIncoming())

        expect(merged.meta.CCLI).toBe("12345")
        expect(merged.meta.artist).toBe("Local artist")
    })

    it("copies child slides along with their parent", () => {
        const incoming = buildIncoming()
        incoming.slides.onstageBridge = slide("Bridge", ["prima linie"], ["bridgeChild"])
        incoming.slides.bridgeChild = slide(null, ["a doua linie"])

        const { show: merged } = mergeAsNewArrangement(buildShow(), incoming)
        const bridgeId = merged.layouts[merged.settings.activeLayout].slides[1].id
        const childIds = merged.slides[bridgeId].children || []

        expect(childIds).toHaveLength(1)
        expect(merged.slides[childIds[0]]).toBeDefined()
        expect(childIds[0]).not.toBe("bridgeChild")
    })

    it("leaves the local show object untouched", () => {
        const existing = buildShow()
        mergeAsNewArrangement(existing, buildIncoming())

        expect(Object.keys(existing.slides)).toHaveLength(3)
        expect(Object.keys(existing.layouts)).toHaveLength(1)
        expect(existing.settings.activeLayout).toBe("layout")
    })

    it("reports which local arrangement each provider arrangement became", () => {
        const { show: merged, layoutMap } = mergeAsNewArrangement(buildShow(), buildIncoming())

        expect(Object.keys(layoutMap)).toEqual(["incoming"])
        expect(merged.layouts[layoutMap.incoming]).toBeDefined()
        expect(layoutMap.incoming).toBe(merged.settings.activeLayout)
    })

    it("adds one arrangement per provider structure and maps each of them", () => {
        const incoming = buildIncoming()
        // a second service plays the same song without the bridge
        incoming.layouts.second = { name: "Second service", notes: "", slides: [{ id: "onstageChorus" }] }

        const { show: merged, layoutMap } = mergeAsNewArrangement(buildShow(), incoming)

        expect(Object.keys(layoutMap)).toEqual(expect.arrayContaining(["incoming", "second"]))
        expect(layoutMap.incoming).not.toBe(layoutMap.second)
        expect(merged.layouts[layoutMap.second].slides).toEqual([{ id: "c1" }])
        expect(merged.layouts[layoutMap.second].name).toBe("Second service")
    })

    it("points two identical provider arrangements at one local arrangement", () => {
        const incoming = buildIncoming()
        incoming.layouts.second = { name: "Second service", notes: "", slides: [{ id: "onstageChorus" }, { id: "onstageBridge" }, { id: "onstageChorus" }] }

        const { show: merged, layoutMap } = mergeAsNewArrangement(buildShow(), incoming)

        expect(layoutMap.second).toBe(layoutMap.incoming)
        // the local song only gained the one new arrangement
        expect(Object.keys(merged.layouts)).toHaveLength(2)
    })

    it("copies a section shared by several provider arrangements only once", () => {
        const incoming = buildIncoming()
        incoming.layouts.second = { name: "Second service", notes: "", slides: [{ id: "onstageBridge" }] }

        const { show: merged, layoutMap } = mergeAsNewArrangement(buildShow(), incoming)
        const bridgeInFirst = merged.layouts[layoutMap.incoming].slides[1].id

        expect(merged.layouts[layoutMap.second].slides).toEqual([{ id: bridgeInFirst }])
        // 3 local slides + the single copied bridge
        expect(Object.keys(merged.slides)).toHaveLength(4)
    })
})
