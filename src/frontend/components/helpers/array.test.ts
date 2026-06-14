import { describe, it, expect, vi } from "vitest"

// array.ts imports translateText from utils/language, which transitively pulls in the whole
// app (stores -> ... -> svelte components / browser APIs). Mock it so the pure array helpers
// can be unit-tested in isolation; translateText only affects sortObject's default-named items.
vi.mock("../../utils/language", () => ({ translateText: (id: string) => id }))

import { areObjectsEqual, arrayHasData, changeValues, clone, getChangedKeys, keysToID, moveToPos, rangeSelect, removeDeleted, removeDuplicates, removeDuplicateValues, removeValues, sortByName, sortFilenames, sortObjectNumbers } from "./array"

describe("array helpers", () => {
    describe("removeDuplicates", () => {
        it("removes duplicate primitives", () => {
            expect(removeDuplicates([1, 1, 2, 3, 3])).toEqual([1, 2, 3])
        })
        it("returns non-arrays untouched", () => {
            expect(removeDuplicates("x" as any)).toBe("x")
        })
    })

    describe("arrayHasData", () => {
        it("deep-matches an entry by value", () => {
            expect(arrayHasData([{ a: 1 }, { b: 2 }], { b: 2 })).toBe(true)
            expect(arrayHasData([{ a: 1 }], { a: 2 })).toBe(false)
        })
        it("is false for non-arrays", () => {
            expect(arrayHasData(null as any, 1)).toBe(false)
        })
    })

    describe("keysToID", () => {
        it("turns an object map into an array carrying the keys as ids", () => {
            expect(keysToID({ a: { v: 1 }, b: { v: 2 } })).toEqual([
                { v: 1, id: "a" },
                { v: 2, id: "b" }
            ])
        })
        it("returns [] for nullish input", () => {
            expect(keysToID(null as any)).toEqual([])
        })
    })

    describe("removeValues / removeDeleted", () => {
        it("removes entries whose key matches a value", () => {
            expect(removeValues([{ x: 1 }, { x: 2 }, { x: 1 }], "x", 1)).toEqual([{ x: 2 }])
        })
        it("removes entries flagged deleted", () => {
            expect(removeDeleted([{ id: 1 }, { id: 2, deleted: true }])).toEqual([{ id: 1 }])
        })
    })

    describe("removeDuplicateValues", () => {
        it("keeps the first key for each distinct value", () => {
            expect(removeDuplicateValues({ a: 1, b: 1, c: 2 })).toEqual({ a: 1, c: 2 })
        })
    })

    describe("changeValues", () => {
        it("sets provided values and deletes undefined ones", () => {
            expect(changeValues({ a: 1, b: 2 }, { a: 9, b: undefined })).toEqual({ a: 9 })
        })
    })

    describe("clone", () => {
        it("deep-clones without shared references", () => {
            const src = { a: { b: [1] } }
            const out = clone(src)
            out.a.b.push(2)
            expect(src.a.b).toEqual([1])
        })
        it("passes primitives through", () => {
            expect(clone(7)).toBe(7)
        })
    })

    describe("areObjectsEqual", () => {
        it("ignores top-level key order", () => {
            expect(areObjectsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
        })
        it("detects differences", () => {
            expect(areObjectsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
        })
    })

    describe("moveToPos", () => {
        it("moves an item to a new index", () => {
            expect(moveToPos([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
        })
        it("returns the array unchanged for a negative target", () => {
            expect(moveToPos([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
        })
    })

    describe("sorting", () => {
        it("sortByName sorts strings naturally (numeric-aware)", () => {
            expect(sortByName([{ name: "item10" }, { name: "item2" }, { name: "item1" }]).map((a) => a.name)).toEqual(["item1", "item2", "item10"])
        })
        it("sortByName drops entries without a string key", () => {
            expect(sortByName([{ name: "b" }, { name: 5 as any }, { name: "a" }]).map((a) => a.name)).toEqual(["a", "b"])
        })
        it("sortObjectNumbers sorts ascending and descending", () => {
            expect(sortObjectNumbers([{ n: 3 }, { n: 1 }, { n: 2 }], "n").map((a) => a.n)).toEqual([1, 2, 3])
            expect(sortObjectNumbers([{ n: 1 }, { n: 3 }, { n: 2 }], "n", true).map((a) => a.n)).toEqual([3, 2, 1])
        })
        it("sortFilenames orders by name then numeric suffix", () => {
            expect(sortFilenames([{ name: "file10.txt" }, { name: "file2.txt" }, { name: "file1.txt" }]).map((a) => a.name)).toEqual(["file1.txt", "file2.txt", "file10.txt"])
        })
    })

    describe("getChangedKeys", () => {
        it("lists keys that changed between two arrays of objects", () => {
            expect(getChangedKeys([{ a: 1, b: 2 }], [{ a: 1, b: 9 }])).toEqual([{ key: "b", index: 0 }])
        })
    })

    describe("rangeSelect", () => {
        it("plain click selects only the new item", () => {
            expect(rangeSelect({}, [1, 2], 5)).toEqual([5])
        })
        it("ctrl/meta toggles the item in/out of the selection", () => {
            expect(rangeSelect({ ctrlKey: true }, [1, 2], 3)).toEqual([1, 2, 3])
            expect(rangeSelect({ ctrlKey: true }, [1, 2, 3], 2)).toEqual([1, 3])
        })
        it("shift selects a numeric range", () => {
            expect(rangeSelect({ shiftKey: true }, [2], 5)).toEqual([2, 3, 4, 5])
        })
    })
})
