import { describe, expect, it } from "vitest"
import { getMetadataSlideIndices } from "./metadataSlideIndex"

function slides(disabledFlags: boolean[]) {
    return disabledFlags.map((disabled) => ({ data: { disabled } }))
}

describe("getMetadataSlideIndices", () => {
    it("defaults to the literal first and last slide when nothing is disabled", () => {
        const ref = slides([false, false, false, false])
        expect(getMetadataSlideIndices(ref)).toEqual({ firstActiveSlideIndex: 0, lastActiveSlideIndex: 3 })
    })

    it("skips a disabled slide 0 when computing the first active slide", () => {
        const ref = slides([true, false, false, false])
        expect(getMetadataSlideIndices(ref).firstActiveSlideIndex).toBe(1)
    })

    it("skips a disabled trailing slide when computing the last active slide", () => {
        const ref = slides([false, false, false, true])
        expect(getMetadataSlideIndices(ref).lastActiveSlideIndex).toBe(2)
    })

    it("firstOffset targets the Nth active slide after the first", () => {
        // slide 0 disabled (media placeholder), slides 1-4 are content
        const ref = slides([true, false, false, false, false])
        // offset 0 -> first active slide (index 1, the real first stanza)
        expect(getMetadataSlideIndices(ref, 0).firstActiveSlideIndex).toBe(1)
        // offset 1 -> second active slide (index 2)
        expect(getMetadataSlideIndices(ref, 1).firstActiveSlideIndex).toBe(2)
    })

    it("lastOffset targets the Nth active slide before the last", () => {
        const ref = slides([false, false, false, false, true]) // slide 4 disabled (blank closer)
        expect(getMetadataSlideIndices(ref, 0, 0).lastActiveSlideIndex).toBe(3)
        expect(getMetadataSlideIndices(ref, 0, 1).lastActiveSlideIndex).toBe(2)
    })

    it("an offset's count is unaffected by a disabled slide in between", () => {
        // active: 0, [1 disabled], 2, 3 -> active indices are [0, 2, 3]
        const ref = slides([false, true, false, false])
        // offset 1 should land on the *second active* slide (index 2), not
        // literally index (0 + 1) which would be the disabled slide
        expect(getMetadataSlideIndices(ref, 1).firstActiveSlideIndex).toBe(2)
    })

    it("clamps an offset beyond the available active slides to the last one", () => {
        const ref = slides([false, false, false])
        expect(getMetadataSlideIndices(ref, 100).firstActiveSlideIndex).toBe(2)
        expect(getMetadataSlideIndices(ref, 0, 100).lastActiveSlideIndex).toBe(0)
    })

    it("returns -1 for both when every slide is disabled", () => {
        const ref = slides([true, true, true])
        expect(getMetadataSlideIndices(ref)).toEqual({ firstActiveSlideIndex: -1, lastActiveSlideIndex: -1 })
    })

    it("returns -1 for both on an empty layout", () => {
        expect(getMetadataSlideIndices([])).toEqual({ firstActiveSlideIndex: -1, lastActiveSlideIndex: -1 })
    })

    it("treats a negative or non-numeric offset as 0", () => {
        const ref = slides([false, false, false])
        expect(getMetadataSlideIndices(ref, -5).firstActiveSlideIndex).toBe(0)
        expect(getMetadataSlideIndices(ref, NaN).firstActiveSlideIndex).toBe(0)
        // @ts-expect-error - exercising bad input from a loosely-typed caller
        expect(getMetadataSlideIndices(ref, "not a number").firstActiveSlideIndex).toBe(0)
    })

    it("floors a fractional offset", () => {
        const ref = slides([false, false, false, false])
        expect(getMetadataSlideIndices(ref, 1.9).firstActiveSlideIndex).toBe(1)
    })

    it("firstOffset and lastOffset that overlap both still resolve independently", () => {
        // single active slide: both first and last offset 0 point to it
        const ref = slides([false])
        expect(getMetadataSlideIndices(ref, 0, 0)).toEqual({ firstActiveSlideIndex: 0, lastActiveSlideIndex: 0 })
    })
})
