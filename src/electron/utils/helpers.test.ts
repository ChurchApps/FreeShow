import { describe, it, expect } from "vitest"
import { checkIfMatching, clone, wait, waitUntilValueIsDefined } from "./helpers"

describe("clone (electron helper)", () => {
    it("returns a deep copy — the original is untouched after mutations", () => {
        const src = { a: { b: [1, 2, 3] } }
        const copy = clone(src)
        copy.a.b.push(99)
        expect(src.a.b).toEqual([1, 2, 3])
    })
    it("returns primitives and null as-is", () => {
        expect(clone(5 as any)).toBe(5)
        expect(clone("hi" as any)).toBe("hi")
        expect(clone(null as any)).toBe(null)
    })
})

describe("checkIfMatching", () => {
    it("returns true regardless of key insertion order", () => {
        expect(checkIfMatching({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })
    it("returns false when a value differs", () => {
        expect(checkIfMatching({ a: 1 }, { a: 2 })).toBe(false)
    })
    it("returns false when either side is falsy or non-object (guards against bad store loads)", () => {
        expect(checkIfMatching(null, { a: 1 })).toBe(false)
        expect(checkIfMatching({ a: 1 }, undefined)).toBe(false)
        expect(checkIfMatching("hi" as any, "hi" as any)).toBe(false)
    })
})

describe("wait", () => {
    it("resolves with 'ended' after roughly the requested delay", async () => {
        const start = Date.now()
        const result = await wait(20)
        expect(result).toBe("ended")
        // sanity: at least ~10ms elapsed (loose bound: CI schedulers vary)
        expect(Date.now() - start).toBeGreaterThanOrEqual(10)
    })
})

describe("waitUntilValueIsDefined", () => {
    it("resolves immediately with the value if it's already defined", async () => {
        const result = await waitUntilValueIsDefined(() => 42, 10, 200)
        expect(result).toBe(42)
    })

    it("polls at the given interval until the value becomes truthy", async () => {
        let attempts = 0
        const result = await waitUntilValueIsDefined(
            () => {
                attempts++
                return attempts >= 3 ? "ready" : null
            },
            10, // 10ms interval
            500 // 500ms overall timeout
        )
        expect(result).toBe("ready")
        expect(attempts).toBeGreaterThanOrEqual(3)
    })

    it("resolves null when the timeout elapses without a truthy value", async () => {
        const result = await waitUntilValueIsDefined(() => null, 10, 50)
        expect(result).toBeNull()
    })
})
