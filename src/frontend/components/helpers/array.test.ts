import { describe, it, expect, vi } from "vitest"

// array.ts pulls in ../../utils/language for translateText (used by sortObject); language.ts
// drags stores + IPC + `window` into scope, none of which we care about here. Stub it out.
vi.mock("../../utils/language", () => ({
    translateText: (s: string) => s
}))

import { arrayHasData, areObjectsEqual, changeValues, clone, getChangedKeys, keysToID, moveToPos, rangeSelect, removeDeleted, removeDuplicates, removeDuplicateValues, removeValues, sortByName, sortByNameAndNumber, sortByTime, sortByTimeNew, sortFilenames, sortObject, sortObjectNumbers } from "./array"

describe("arrayHasData", () => {
    it("finds a primitive value in the array", () => {
        expect(arrayHasData([1, 2, 3] as any, 2)).toBe(true)
    })
    it("finds a deeply-equal object", () => {
        expect(arrayHasData([{ a: 1 }, { b: 2 }] as any, { b: 2 })).toBe(true)
    })
    it("returns false for a missing value", () => {
        expect(arrayHasData([1, 2, 3] as any, 4)).toBe(false)
    })
    it("returns false for non-array input", () => {
        expect(arrayHasData("not an array" as any, "n")).toBe(false)
        expect(arrayHasData(null as any, null)).toBe(false)
    })
})

describe("removeDuplicates", () => {
    it("removes primitive duplicates while preserving first-seen order", () => {
        expect(removeDuplicates([1, 2, 2, 3, 1] as any)).toEqual([1, 2, 3])
    })
    it("does not deep-dedupe objects (identity only, by design of Set)", () => {
        const a = { x: 1 }
        expect(removeDuplicates([a, { x: 1 }, a] as any)).toHaveLength(2)
    })
    it("returns non-array input unchanged", () => {
        expect(removeDuplicates("hi" as any)).toBe("hi")
    })
})

describe("sortByTime / sortByTimeNew", () => {
    it("sortByTime compares plain Date-like values", () => {
        const arr = ["2023-01-02", "2023-01-01", "2023-01-03"]
        expect([...arr].sort(sortByTime as any)).toEqual(["2023-01-01", "2023-01-02", "2023-01-03"])
    })
    it("sortByTime unwraps a `from` field for calendar events", () => {
        const events = [{ from: "2023-01-02" }, { from: "2023-01-01" }]
        expect([...events].sort(sortByTime as any)[0].from).toBe("2023-01-01")
    })
    it("sortByTimeNew sorts objects by the given key ascending", () => {
        const arr = [{ time: 300 }, { time: 100 }, { time: 200 }]
        expect(sortByTimeNew(arr).map((a) => a.time)).toEqual([100, 200, 300])
    })
})

describe("moveToPos", () => {
    it("moves an item to a new index", () => {
        expect(moveToPos([1, 2, 3, 4] as any, 0, 2)).toEqual([2, 3, 1, 4])
    })
    it("pads with undefined when newPos is past the end", () => {
        const result = moveToPos([1, 2] as any, 0, 3) as any[]
        expect(result[3]).toBe(1)
        expect(result.length).toBe(4)
    })
    it("returns the array unchanged for a negative newPos", () => {
        const arr = [1, 2, 3]
        expect(moveToPos(arr as any, 0, -1)).toBe(arr as any)
    })
    it("returns non-array input unchanged", () => {
        expect(moveToPos("nope" as any, 0, 1)).toBe("nope")
    })
})

describe("sortByName", () => {
    it("sorts by name alphabetically", () => {
        const arr = [{ name: "Charlie" }, { name: "alpha" }, { name: "Bravo" }]
        // localeCompare is case-insensitive-ish so 'alpha' < 'Bravo' < 'Charlie'
        expect(sortByName(arr).map((a) => a.name)).toEqual(["alpha", "Bravo", "Charlie"])
    })
    it("treats embedded numbers naturally with numberSort (default)", () => {
        const arr = [{ name: "Track 10" }, { name: "Track 2" }, { name: "Track 1" }]
        expect(sortByName(arr).map((a) => a.name)).toEqual(["Track 1", "Track 2", "Track 10"])
    })
    it("filters out entries whose sort key isn't a string", () => {
        const arr = [{ name: "a" }, { name: 42 as unknown as string }, { name: "b" }]
        expect(sortByName(arr).map((a) => a.name)).toEqual(["a", "b"])
    })
    it("returns [] for non-array input (guards against store misuse)", () => {
        expect(sortByName(undefined as any)).toEqual([])
    })
})

describe("sortObject", () => {
    it("sorts objects by the given key", () => {
        const arr = [{ label: "c" }, { label: "a" }, { label: "b" }]
        expect(sortObject(arr, "label" as any).map((a) => a.label)).toEqual(["a", "b", "c"])
    })
    it("treats missing keys as empty strings", () => {
        const arr: any[] = [{ label: "b" }, {}, { label: "a" }]
        const sorted = sortObject(arr, "label" as any)
        expect(sorted[0].label).toBeUndefined()
    })
})

describe("sortObjectNumbers", () => {
    it("sorts ascending by numeric key", () => {
        const arr = [{ n: 3 }, { n: 1 }, { n: 2 }]
        expect(sortObjectNumbers(arr, "n" as any).map((a) => a.n)).toEqual([1, 2, 3])
    })
    it("sorts descending when reverse=true", () => {
        const arr = [{ n: 1 }, { n: 3 }, { n: 2 }]
        expect(sortObjectNumbers(arr, "n" as any, true).map((a) => a.n)).toEqual([3, 2, 1])
    })
    it("returns [] for non-array input", () => {
        expect(sortObjectNumbers(undefined as any, "n" as any)).toEqual([])
    })
})

describe("sortByNameAndNumber (quick-access hymn numbers)", () => {
    const item = (name: string, number?: string) => ({ name, quickAccess: number ? { number } : undefined })

    it("sorts by numeric core when prefixes match", () => {
        const arr = [item("c", "MP10"), item("a", "MP2"), item("b", "MP1")]
        expect(sortByNameAndNumber(arr).map((a) => a.name)).toEqual(["b", "a", "c"])
    })
    it("sorts by prefix first, then number", () => {
        const arr = [item("c", "MP1"), item("a", "AB99"), item("b", "MP2")]
        expect(sortByNameAndNumber(arr).map((a) => a.name)).toEqual(["a", "c", "b"])
    })
    it("always pushes items without a number to the end", () => {
        const arr = [item("hasnum", "MP1"), item("nonum")]
        expect(sortByNameAndNumber(arr).map((a) => a.name)).toEqual(["hasnum", "nonum"])
    })
    it("supports descending direction", () => {
        const arr = [item("a", "MP1"), item("b", "MP2"), item("c", "MP3")]
        expect(sortByNameAndNumber(arr, "desc").map((a) => a.name)).toEqual(["c", "b", "a"])
    })
    it("returns [] for non-array input", () => {
        expect(sortByNameAndNumber(null as any)).toEqual([])
    })
})

describe("sortFilenames", () => {
    it("sorts numerically within the same base name", () => {
        const arr = [{ name: "img10.png" }, { name: "img2.png" }, { name: "img1.png" }]
        expect(sortFilenames(arr).map((a) => a.name)).toEqual(["img1.png", "img2.png", "img10.png"])
    })
    it("falls back to extension comparison when name+number match", () => {
        const arr = [{ name: "song1.wav" }, { name: "song1.mp3" }]
        expect(sortFilenames(arr).map((a) => a.name)).toEqual(["song1.mp3", "song1.wav"])
    })
})

describe("keysToID", () => {
    it("moves the object key onto each entry as `id`", () => {
        expect(keysToID({ a: { x: 1 }, b: { x: 2 } })).toEqual([
            { id: "a", x: 1 },
            { id: "b", x: 2 }
        ])
    })
    it("returns [] for falsy input", () => {
        expect(keysToID(null as any)).toEqual([])
    })
})

describe("removeValues / removeDeleted / removeDuplicateValues", () => {
    it("removeValues drops entries where key === value", () => {
        expect(removeValues([{ n: 1 }, { n: 2 }, { n: 1 }] as any, "n" as any, 1)).toEqual([{ n: 2 }])
    })
    it("removeDeleted filters out entries with a truthy `deleted`", () => {
        const arr = [{ id: "a" }, { id: "b", deleted: true }, { id: "c" }] as any
        expect(removeDeleted(arr).map((a: any) => a.id)).toEqual(["a", "c"])
    })
    it("removeDuplicateValues keeps only the first occurrence per JSON-equal value", () => {
        const result = removeDuplicateValues({ a: { x: 1 }, b: { x: 1 }, c: { x: 2 } })
        expect(Object.keys(result)).toEqual(["a", "c"])
    })
})

describe("changeValues", () => {
    it("assigns provided values and deletes keys set to undefined", () => {
        const target: any = { a: 1, b: 2 }
        changeValues(target, { a: 10, b: undefined, c: 3 })
        expect(target).toEqual({ a: 10, c: 3 })
    })
})

describe("clone", () => {
    it("returns a deep copy so mutations don't leak to the original", () => {
        const source = { a: { b: 1 } }
        const copy = clone(source)
        copy.a.b = 99
        expect(source.a.b).toBe(1)
    })
    it("returns primitives and null as-is", () => {
        expect(clone(5 as any)).toBe(5)
        expect(clone(null as any)).toBe(null)
    })
})

describe("rangeSelect (list multi-select with modifier keys)", () => {
    it("no modifier: replaces the selection with just the clicked item", () => {
        expect(rangeSelect({}, [1, 2, 3], 5)).toEqual([5])
    })
    it("ctrl: toggles the clicked item in/out of the selection", () => {
        expect(rangeSelect({ ctrlKey: true }, [1, 2], 3)).toEqual([1, 2, 3])
        expect(rangeSelect({ ctrlKey: true }, [1, 2, 3], 2)).toEqual([1, 3])
    })
    it("meta (macOS): behaves like ctrl", () => {
        expect(rangeSelect({ metaKey: true }, [1], 2)).toEqual([1, 2])
    })
    it("shift: fills the range between the last selected and the new index", () => {
        // last selected 2, clicked 5 → fills 3,4 into the selection
        const result = rangeSelect({ shiftKey: true }, [2], 5) as number[]
        expect(result).toEqual(expect.arrayContaining([2, 3, 4, 5]))
    })
})

describe("areObjectsEqual", () => {
    it("returns true regardless of key insertion order", () => {
        expect(areObjectsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })
    it("returns false when a value differs", () => {
        expect(areObjectsEqual({ a: 1 }, { a: 2 })).toBe(false)
    })
})

describe("getChangedKeys", () => {
    it("reports the keys that changed between the two aligned arrays", () => {
        const prev = [{ a: 1, b: 2 }]
        const curr = [{ a: 1, b: 3, c: 4 }]
        const changed = getChangedKeys(curr, prev)
        expect(changed).toEqual(
            expect.arrayContaining([
                { key: "b", index: 0 },
                { key: "c", index: 0 }
            ])
        )
        expect(changed.find((c) => c.key === "a")).toBeUndefined()
    })
})
