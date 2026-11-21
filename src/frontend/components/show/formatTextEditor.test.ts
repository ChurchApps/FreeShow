import { get } from "svelte/store"
import { expect, it, vi } from "vitest"
import type { Item, Show } from "../../../types/Show"
import { showsCache } from "../../stores"
import { formatText } from "./formatTextEditor"

vi.mock("../../show/slides", () => ({}))
vi.mock("../../utils/language", () => ({}))
vi.mock("../helpers/show", () => ({ getGlobalGroup: () => "" }))
vi.mock("../helpers/output", async () => {
    const { getItemText } = await import("../edit/scripts/textStyle")
    return { isEmpty: (item: Item) => !getItemText(item).length }
})
vi.mock("../helpers/history", () => ({
    history: ({ newData, oldData }: { newData: { data: Show }; oldData: { id: string } }) => showsCache.set({ [oldData.id]: newData.data })
}))

function textbox(value: string): Item {
    return { type: "text", style: "left:50px;", lines: [{ align: "", text: [{ value, style: "font-size:100px;" }] }] }
}

it("preserves template items and their order across repeated text edits", () => {
    const background: Item = { type: "media", src: "background.png", style: "", fromTemplate: true, bindings: ["audience"] }
    const lowerThird: Item = { type: "media", src: "lower-third.png", style: "", fromTemplate: true, bindings: ["stream"] }
    const titleItems = [lowerThird, textbox("Opening prayer"), background]
    const continuationItems = [background, textbox("Continuation"), lowerThird]
    const show: Show = {
        name: "Prayer",
        category: null,
        settings: { activeLayout: "layout", template: "prayer-template" },
        timestamps: { created: 0, modified: null, used: null },
        meta: {},
        media: {},
        layouts: { layout: { name: "Default", notes: "", slides: [{ id: "title" }, { id: "verse" }] } },
        slides: {
            title: { group: "Title", color: "", settings: {}, notes: "Keep these notes", items: titleItems, children: ["continuation"] },
            continuation: { group: null, color: "", settings: {}, notes: "", items: continuationItems },
            verse: { group: "Verse", color: "", settings: {}, notes: "", items: [background, textbox("First version")] }
        }
    }
    showsCache.set({ prayer: show })

    for (const verse of ["Second version", "Third version", "Fourth version"]) {
        formatText(`[Title]\nOpening prayer\n\nContinuation\n\n[Verse]\n${verse}`, "prayer")

        const updated = get(showsCache).prayer
        const editedVerse = updated.slides[updated.layouts.layout.slides[1].id]
        expect(updated.slides.title).toEqual(show.slides.title)
        expect(updated.slides.continuation).toEqual(show.slides.continuation)
        expect(editedVerse.items).toEqual([background, textbox(verse)])
    }
})
