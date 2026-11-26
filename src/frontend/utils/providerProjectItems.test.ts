import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { fillPlaceholderItem, getProviderItemId, mergeProviderProjectItems, restorePlaceholderItem } from "./providerProjectItems"

const show = (id: string, providerItemId?: string, extra: Partial<ProjectShowRef> = {}): ProjectShowRef => ({ id, type: "show", ...(providerItemId ? { providerItemId } : {}), ...extra })
const placeholder = (id: string, name: string, providerItemId?: string): ProjectShowRef => ({ id, type: "show_placeholder", name, ...(providerItemId ? { providerItemId } : {}) })
const section = (id: string, name: string, providerItemId?: string, extra: Partial<ProjectShowRef> = {}): ProjectShowRef => ({ id, type: "section", name, ...(providerItemId ? { providerItemId } : {}), ...extra })

const merge = (existing: ProjectShowRef[], incoming: ProjectShowRef[], missingShows: string[] = [], providerNames: { [key: string]: string } = {}) => mergeProviderProjectItems(existing, incoming, { providerNames, showExists: (id) => !missingShows.includes(id) })
const ids = (items: ProjectShowRef[]) => items.map((a) => a.id)

describe("mergeProviderProjectItems", () => {
    it("keeps added items behind the item they followed", () => {
        const existing = [show("intro"), show("a", "p1"), show("extra"), { id: "video.mp4", type: "video" as const }, show("b", "p2")]
        const result = merge(existing, [show("a", "p1"), show("b", "p2")])

        expect(ids(result)).toEqual(["intro", "a", "extra", "video.mp4", "b"])
    })

    it("follows the provider order, moving added items with their item", () => {
        const existing = [show("a", "p1"), show("after_a"), show("b", "p2"), show("after_b")]
        const result = merge(existing, [show("b", "p2"), show("a", "p1")])

        expect(ids(result)).toEqual(["b", "after_b", "a", "after_a"])
    })

    it("adds new provider items and removes the ones removed at the provider", () => {
        const existing = [show("a", "p1"), show("b", "p2"), show("after_b")]
        const result = merge(existing, [show("a", "p1"), show("c", "p3")])

        expect(ids(result)).toEqual(["a", "after_b", "c"])
    })

    it("does not duplicate anything when synced repeatedly", () => {
        const incoming = [section("s1", "Worship", "h1"), show("a", "p1"), placeholder("x1", "Song B", "p2")]
        const once = merge([show("intro"), ...incoming, show("outro")], incoming)
        const twice = merge(once, [section("s2", "Worship", "h1"), show("a", "p1"), placeholder("x2", "Song B", "p2")])

        expect(twice).toEqual(once)
        expect(ids(twice)).toEqual(["intro", "s1", "a", "x1", "outro"])
    })

    it("keeps user settings and takes over provider changes", () => {
        const existing = [section("s1", "Old name", "h1", { color: "#ff0000", data: { settings: { triggerAction: "act" } }, notes: "mine" })]
        const [result] = merge(existing, [section("s2", "New name", "h1", { notes: "", scheduleLength: 60 })])

        expect(result).toEqual(section("s1", "New name", "h1", { color: "#ff0000", data: { settings: { triggerAction: "act" } }, notes: "mine", scheduleLength: 60 }))
    })

    it("keeps a filled placeholder while there is no match", () => {
        const [result] = merge([show("mine", "p1")], [placeholder("x1", "Song", "p1")])

        expect(result).toEqual(show("mine", "p1"))
    })

    it("turns an item back into a placeholder when its show is deleted", () => {
        const [result] = merge([show("deleted", "p1")], [placeholder("x1", "Song", "p1")], ["deleted"])

        expect(result.type).toBe("show_placeholder")
    })

    it("fills a placeholder once there is a match", () => {
        const [result] = merge([placeholder("x1", "Song", "p1")], [show("found", "p1")])

        expect(result).toEqual(show("found", "p1"))
    })

    it("keeps media chosen for a placeholder", () => {
        const media: ProjectShowRef = { id: "clip.mp4", type: "video", providerItemId: "p1" }

        expect(merge([media], [placeholder("x1", "Clip", "p1")])).toEqual([media])
    })

    it("drops the layout when another show is linked", () => {
        const [result] = merge([show("old", "p1", { layout: "l1", layoutInfo: { a: 1 } })], [show("new", "p1")])

        expect(result).toEqual(show("new", "p1"))
    })

    it("keeps a copy the user made of a provider item", () => {
        const result = merge([show("a", "p1"), show("b", "p2"), show("a", "p1")], [show("a", "p1"), show("b", "p2")])

        expect(ids(result)).toEqual(["a", "b", "a"])
    })

    it("matches a song used twice by order", () => {
        const incoming = [show("a", "p1"), show("b", "p2"), show("a", "p1")]

        expect(ids(merge(incoming, incoming))).toEqual(["a", "b", "a"])
    })

    it("adopts placeholders, sections and media from earlier syncs", () => {
        const existing: ProjectShowRef[] = [section("s1", "Worship"), placeholder("x1", "Song B"), { id: "clip.mp4", type: "video" }, show("manual")]
        const incoming: ProjectShowRef[] = [section("s2", "Worship", "h1"), placeholder("x2", "Song B", "p2"), { id: "clip.mp4", type: "video", providerItemId: "clip.mp4" }]
        const result = merge(existing, incoming)

        expect(ids(result)).toEqual(["s1", "x1", "clip.mp4", "manual"])
        expect(result.map((a) => a.providerItemId)).toEqual(["h1", "p2", "clip.mp4", undefined])
    })

    it("replaces an earlier placeholder by name when there is a match now", () => {
        const result = merge([placeholder("x1", "Song B")], [show("found", "p2")], [], { p2: "song b" })

        expect(result).toEqual([show("found", "p2")])
    })

    it("does not adopt an added item which only shares a name with a matched one", () => {
        const existing = [section("s1", "Worship", "h1"), section("mine", "Worship")]
        const result = merge(existing, [section("s2", "Worship", "h1")])

        expect(ids(result)).toEqual(["s1", "mine"])
    })
})

describe("fillPlaceholderItem", () => {
    it("takes over the provider item of the placeholder", () => {
        const result = fillPlaceholderItem({ ...placeholder("x1", "Song", "p1"), scheduleLength: 30 }, show("mine"))

        expect(result).toEqual(show("mine", "p1", { scheduleLength: 30, replacedPlaceholder: "Song" }))
    })

    it("leaves other replacements unchanged", () => {
        expect(fillPlaceholderItem(show("a", "p1"), show("mine"))).toEqual(show("mine"))
    })

    it("remembers the name of a placeholder without a provider item", () => {
        expect(fillPlaceholderItem(placeholder("x1", "Song"), show("mine"))).toEqual(show("mine", undefined, { replacedPlaceholder: "Song" }))
    })
})

describe("placeholder filled before it knew its provider item", () => {
    const filled = fillPlaceholderItem(placeholder("x1", "Song"), show("mine"))

    it("does not come back on the next sync, or any later one", () => {
        const once = merge([filled], [placeholder("x2", "Song", "p1")])
        const twice = merge(once, [placeholder("x3", "Song", "p1")])

        expect(once).toEqual([show("mine", "p1", { replacedPlaceholder: "Song" })])
        expect(twice).toEqual(once)
    })

    it("only takes the provider item with the same name", () => {
        const result = merge([filled], [placeholder("x2", "Other", "p1")])

        expect(ids(result)).toEqual(["mine", "x2"])
    })
})

describe("restorePlaceholderItem", () => {
    const original = { ...placeholder("x1", "Song", "p1"), scheduleLength: 30 }
    const filled = fillPlaceholderItem(original, show("mine", undefined, { color: "#ff0000", layout: "l1" }))

    it("restores the placeholder which was filled", () => {
        expect(restorePlaceholderItem(filled, "x2", "My show")).toEqual({ ...placeholder("x2", "Song", "p1"), scheduleLength: 30, color: "#ff0000" })
    })

    it("stays a placeholder on the next sync", () => {
        const restored = restorePlaceholderItem(filled, "x2", "My show")
        const result = merge([restored], [placeholder("x3", "Song", "p1")])

        expect(result).toEqual([restored])
    })

    it("uses the fallback name if the placeholder name is not known", () => {
        expect(restorePlaceholderItem(show("mine", "p1"), "x2", "My show").name).toBe("My show")
    })
})

describe("getProviderItemId", () => {
    it("falls back to the name for sections and to the id for other items", () => {
        expect(getProviderItemId(section("random", "Worship"))).toBe("section:Worship")
        expect(getProviderItemId(show("pcosong_1"))).toBe("pcosong_1")
        expect(getProviderItemId(section("random", "Worship", "h1"))).toBe("h1")
    })
})
