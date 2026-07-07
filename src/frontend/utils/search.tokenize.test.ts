import { describe, it, expect, vi } from "vitest"

// tokenize + isRefinement are pure; formatSearch is already covered from another angle in search.test.ts.
// Mock the same collaborator surface that search.test.ts does so importing search.ts here doesn't
// try to reach into svelte stores or txt.ts.
const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return { _set: (v: unknown) => (value = v), subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) }
    }
    return { textCache: makeStore({}), categories: makeStore({}), drawerTabsData: makeStore({}) }
})
vi.mock("../stores", () => ({ textCache: h.textCache, categories: h.categories, drawerTabsData: h.drawerTabsData }))
vi.mock("../components/helpers/array", () => ({
    sortObjectNumbers: (arr: any[], key: string, desc = false) => [...arr].sort((a, b) => (desc ? (b[key] || 0) - (a[key] || 0) : (a[key] || 0) - (b[key] || 0)))
}))
vi.mock("../converters/txt", () => ({ similarity: () => 0 }))

import { isRefinement, tokenize } from "./search"

describe("tokenize", () => {
    it("splits on whitespace and lowercases", () => {
        expect(tokenize("Amazing Grace")).toEqual(["amazing", "grace"])
    })
    it("collapses runs of whitespace and skips empty tokens", () => {
        expect(tokenize("   how   great   thou   art   ")).toEqual(["how", "great", "thou", "art"])
    })
    it("returns an empty array for an empty or whitespace-only string", () => {
        expect(tokenize("")).toEqual([])
        expect(tokenize("   \t \n ")).toEqual([])
    })
    it("does not touch punctuation (that's formatSearch's job)", () => {
        expect(tokenize("hello, world!")).toEqual(["hello,", "world!"])
    })
})

describe("isRefinement", () => {
    // A refinement means the new query is 'the old query plus more' — so any full-token match should
    // benefit from cached results without re-running the full search.
    it("returns true when every old token still appears in the new tokens", () => {
        expect(isRefinement(["amazing", "grace", "sweet"], ["amazing", "grace"])).toBe(true)
    })
    it("returns false when an old token is missing (user broadened / changed the query)", () => {
        expect(isRefinement(["amazing"], ["amazing", "grace"])).toBe(false)
    })
    it("returns false when there is nothing to refine yet (first search)", () => {
        // by contract this is 'not a refinement' — the caller should still do a full search
        expect(isRefinement(["amazing"], [])).toBe(false)
    })
    it("is a subset check, not order-sensitive", () => {
        expect(isRefinement(["grace", "amazing"], ["amazing", "grace"])).toBe(true)
    })
})
