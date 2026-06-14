import { describe, it, expect } from "vitest"
import { addToPos, getIndexes, mover } from "./mover"

describe("mover helpers", () => {
    describe("getIndexes", () => {
        it("extracts .index values sorted descending", () => {
            expect(getIndexes([{ index: 2 }, { index: 0 }, { index: 1 }])).toEqual([2, 1, 0])
        })
        it("returns [] for non-arrays", () => {
            expect(getIndexes(null as any)).toEqual([])
        })
    })

    describe("addToPos", () => {
        it("inserts items at the given position", () => {
            expect(addToPos([1, 2, 3], ["a", "b"], 1)).toEqual([1, "a", "b", 2, 3])
        })
        it("inserts at the start and the end", () => {
            expect(addToPos([1, 2], ["x"], 0)).toEqual(["x", 1, 2])
            expect(addToPos([1, 2], ["x"], 2)).toEqual([1, 2, "x"])
        })
        it("returns the original for non-array inputs", () => {
            expect(addToPos("nope" as any, [1], 0)).toBe("nope")
        })
    })

    describe("mover", () => {
        it("moves a single item forward, accounting for the gap it leaves", () => {
            expect(mover([1, 2, 3, 4], [1], 3)).toEqual([1, 3, 2, 4])
        })
        it("moves a single item backward", () => {
            expect(mover([1, 2, 3, 4], [3], 1)).toEqual([1, 4, 2, 3])
        })
        it("moves a contiguous selection to the end", () => {
            expect(mover([1, 2, 3, 4], [0, 1], 4)).toEqual([3, 4, 1, 2])
        })
        it("returns the original for non-array input", () => {
            expect(mover(null as any, [0], 0)).toBe(null)
        })
    })
})
