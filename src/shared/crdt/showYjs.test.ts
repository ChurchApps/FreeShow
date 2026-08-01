import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { applyShowDiffToYDoc, showToYDoc, yDocToShow } from "./showYjs"

describe("showYjs mapping", () => {
    it("round-trips a show through a Y.Doc", () => {
        const show = {
            name: "Song",
            category: null,
            slides: { a: { group: "Verse 1", items: [] }, b: { group: "Chorus", items: [] } },
            layouts: { l1: { slides: [{ id: "a" }, { id: "b" }] } },
            media: {}
        }
        const doc = new Y.Doc()
        showToYDoc(show, doc)
        expect(yDocToShow(doc)).toEqual(show)
    })

    it("merges concurrent edits to DIFFERENT slides", () => {
        const base = { name: "Song", slides: { a: { group: "A" } }, layouts: {}, media: {} }

        const docA = new Y.Doc()
        showToYDoc(base, docA)
        const docB = new Y.Doc()
        Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA)) // B starts from A's state (shared map identity)

        // A adds slide b, B adds slide c (concurrently)
        applyShowDiffToYDoc(docA, base, { ...base, slides: { a: { group: "A" }, b: { group: "B" } } }, "local")
        applyShowDiffToYDoc(docB, base, { ...base, slides: { a: { group: "A" }, c: { group: "C" } } }, "local")

        // exchange updates
        Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))
        Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

        expect(Object.keys(yDocToShow(docA).slides).sort()).toEqual(["a", "b", "c"])
        expect(Object.keys(yDocToShow(docB).slides).sort()).toEqual(["a", "b", "c"])
    })

    it("applies deletions", () => {
        const base = { name: "S", slides: { a: {}, b: {} }, layouts: {}, media: {} }
        const doc = new Y.Doc()
        showToYDoc(base, doc)
        applyShowDiffToYDoc(doc, base, { ...base, slides: { a: {} } }, "local")
        expect(Object.keys(yDocToShow(doc).slides)).toEqual(["a"])
    })
})
