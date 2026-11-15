import { describe, expect, it, vi } from "vitest"

// select.ts imports the stores and array helpers (which pull in Svelte components); the helpers under test are pure, so stubs are enough
vi.mock("../../stores", () => ({ selected: { subscribe: () => () => {}, set: () => {}, update: () => {} } }))
vi.mock("./array", () => ({ removeDuplicates: (a: any[]) => [...new Set(a)] }))

import { clearShiftAnchor, getPasteIndex, getShiftAnchor, getShiftRangeStart, setShiftAnchor } from "./select"

const slides = [0, 1, 2, 3].map((index) => ({ index, showId: "show1" }))
const nothing = { id: null, data: [] }

describe("getShiftRangeStart", () => {
    it("starts from the last plain-clicked item when nothing is selected", () => {
        const anchor = { id: "slide", data: { index: 0, showId: "show1" } }
        expect(getShiftRangeStart(nothing, anchor, "slide", slides[2], slides)).toEqual({ index: 0, showId: "show1" })
    })

    it("keeps the existing selection of the same list", () => {
        const anchor = { id: "slide", data: { index: 0, showId: "show1" } }
        const selection = { id: "slide" as const, data: [slides[1]] }
        expect(getShiftRangeStart(selection, anchor, "slide", slides[3], slides)).toBeNull()
    })

    it("uses the anchor when the selection belongs to another list", () => {
        const anchor = { id: "slide", data: { index: 1, showId: "show1" } }
        const selection = { id: "show" as const, data: [{ id: "a", index: 0 }] }
        expect(getShiftRangeStart(selection, anchor, "slide", slides[3], slides)).toEqual({ index: 1, showId: "show1" })
    })

    it("ignores an anchor from another list", () => {
        const anchor = { id: "show", data: { index: 0 } }
        expect(getShiftRangeStart(nothing, anchor, "slide", slides[2], slides)).toBeNull()
    })

    it("ignores an anchor that is no longer in the list (e.g. a slide of another show)", () => {
        const anchor = { id: "slide", data: { index: 0, showId: "otherShow" } }
        expect(getShiftRangeStart(nothing, anchor, "slide", slides[2], slides)).toBeNull()
    })

    it("does nothing when Shift+clicking the anchor itself", () => {
        const anchor = { id: "slide", data: { index: 2, showId: "show1" } }
        expect(getShiftRangeStart(nothing, anchor, "slide", slides[2], slides)).toBeNull()
    })

    it("does nothing without an anchor", () => {
        expect(getShiftRangeStart(nothing, null, "slide", slides[2], slides)).toBeNull()
    })

    it("accepts an indexed anchor when the list has no shift range", () => {
        expect(getShiftRangeStart(nothing, { id: "media", data: { index: 4 } }, "media", { index: 7 })).toEqual({ index: 4 })
        expect(getShiftRangeStart(nothing, { id: "media", data: { path: "a.jpg" } }, "media", { index: 7 })).toBeNull()
    })
})

describe("getPasteIndex", () => {
    it("pastes after the selected item", () => {
        expect(getPasteIndex({ id: "show", data: [{ id: "b", index: 1 }] }, "show", 3)).toBe(2)
    })

    it("pastes after the last of several selected items", () => {
        expect(getPasteIndex({ id: "show", data: [{ index: 2 }, { index: 0 }] }, "show", 5)).toBe(3)
    })

    it("pastes at the end when nothing in the list is selected", () => {
        expect(getPasteIndex({ id: null, data: [] }, "show", 3)).toBe(3)
        expect(getPasteIndex({ id: "slide", data: [{ index: 0 }] }, "show", 3)).toBe(3)
    })

    it("pastes at the end when the selection has no usable index", () => {
        expect(getPasteIndex({ id: "show", data: [{ id: "a" }] }, "show", 3)).toBe(3)
        expect(getPasteIndex({ id: "show", data: [{ index: 9 }] }, "show", 3)).toBe(3)
    })
})

describe("shift anchor", () => {
    it("remembers the last plain-clicked item until it is cleared", () => {
        setShiftAnchor("slide", { index: 1, showId: "show1" })
        expect(getShiftAnchor()).toEqual({ id: "slide", data: { index: 1, showId: "show1" } })
        expect(getShiftRangeStart(nothing, getShiftAnchor(), "slide", slides[3], slides)).toEqual({ index: 1, showId: "show1" })

        // e.g. after any edit (history), the index might point to another slide
        clearShiftAnchor()
        expect(getShiftAnchor()).toBeNull()
        expect(getShiftRangeStart(nothing, getShiftAnchor(), "slide", slides[3], slides)).toBeNull()
    })
})
