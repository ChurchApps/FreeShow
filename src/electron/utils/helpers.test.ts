import { describe, it, expect } from "vitest"
import { checkIfMatching, clone, wait } from "./helpers"

describe("electron helpers", () => {
    describe("clone", () => {
        it("deep-clones objects (no shared references)", () => {
            const original = { a: 1, nested: { b: [1, 2, 3] } }
            const copy = clone(original)
            expect(copy).toEqual(original)
            expect(copy).not.toBe(original)
            copy.nested.b.push(4)
            expect(original.nested.b).toEqual([1, 2, 3])
        })
        it("returns primitives and null unchanged", () => {
            expect(clone(5)).toBe(5)
            expect(clone("x")).toBe("x")
            expect(clone(null)).toBe(null)
        })
    })

    describe("checkIfMatching", () => {
        it("treats objects with the same content but different key order as equal", () => {
            expect(checkIfMatching({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
            expect(checkIfMatching({ x: { p: 1, q: 2 } }, { x: { q: 2, p: 1 } })).toBe(true)
        })
        it("detects differing values", () => {
            expect(checkIfMatching({ a: 1 }, { a: 2 })).toBe(false)
        })
        it("is order-sensitive for arrays (slide order matters)", () => {
            expect(checkIfMatching({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
            expect(checkIfMatching({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
        })
        it("returns false for non-objects", () => {
            expect(checkIfMatching(null, { a: 1 })).toBe(false)
            expect(checkIfMatching("a", "a")).toBe(false)
        })
    })

    describe("wait", () => {
        it("resolves after the given delay", async () => {
            await expect(wait(1)).resolves.toBe("ended")
        })
    })
})
