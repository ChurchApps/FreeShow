import { describe, it, expect } from "vitest"
import { clampCrop, clampPan, getCropCenter, getCropState, getCropValues, isSameCrop } from "./cropping"

describe("cropping helpers", () => {
    describe("getCropValues", () => {
        it("defaults to zeros for nullish input", () => {
            expect(getCropValues(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
            expect(getCropValues(null)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
        })

        it("coerces strings to numbers and bad values to 0", () => {
            expect(getCropValues({ top: "10", right: "20", bottom: "abc", left: 5 } as any)).toEqual({ top: 10, right: 20, bottom: 0, left: 5 })
        })
    })

    describe("isSameCrop", () => {
        it("compares the four edges", () => {
            expect(isSameCrop({ top: 1, right: 2, bottom: 3, left: 4 }, { top: 1, right: 2, bottom: 3, left: 4 })).toBe(true)
            expect(isSameCrop({ top: 1, right: 2, bottom: 3, left: 4 }, { top: 1, right: 2, bottom: 3, left: 0 })).toBe(false)
        })
    })

    describe("clampCrop", () => {
        it("leaves valid values untouched", () => {
            expect(clampCrop({ top: 10, right: 20, bottom: 10, left: 20 })).toEqual({ top: 10, right: 20, bottom: 10, left: 20 })
        })

        it("clamps each edge to the 0..99 range", () => {
            expect(clampCrop({ top: -5, right: 150, bottom: -1, left: 0 })).toEqual({ top: 0, right: 99, bottom: 0, left: 0 })
        })

        it("scales opposing edges down when their sum exceeds 99", () => {
            expect(clampCrop({ top: 0, right: 60, bottom: 0, left: 60 })).toEqual({ top: 0, right: 49.5, bottom: 0, left: 49.5 })
        })
    })

    describe("clampPan", () => {
        it("keeps the pan within the visible window", () => {
            expect(clampPan(50, 100)).toBe(50)
            expect(clampPan(0, 100)).toBe(1)
            expect(clampPan(70, 50)).toBe(50)
            expect(clampPan(-10, 50)).toBe(0)
        })
    })

    describe("getCropCenter", () => {
        it("returns the midpoint of the visible region", () => {
            expect(getCropCenter({ top: 0, right: 0, bottom: 0, left: 0 })).toEqual({ x: 50, y: 50 })
            expect(getCropCenter({ top: 0, right: 0, bottom: 0, left: 20 })).toEqual({ x: 60, y: 50 })
            expect(getCropCenter({ top: 10, right: 0, bottom: 30, left: 0 })).toEqual({ x: 50, y: 40 })
        })
    })

    describe("getCropState", () => {
        it("reports no crop for empty input", () => {
            const state = getCropState(undefined, false)
            expect(state.cropHasValues).toBe(false)
            expect(state.crop).toEqual({ top: 0, right: 0, bottom: 0, left: 0, type: "ppt" })
            expect(state.mediaCropGeometry).toBe("width: 100%;height: 100%;left: 0;top: 0;")
        })

        it("builds a clip-path for clip crops and enables the overflow preview", () => {
            const state = getCropState({ top: 10, right: 10, bottom: 10, left: 10, type: "clip" }, true)
            expect(state.cropHasValues).toBe(true)
            expect(state.showCropOverflowPreview).toBe(true)
            expect(state.mediaCropGeometry).toBe("width: 100%;height: 100%;left: 0;top: 0;clip-path: inset(10% 10% 10% 10%);-webkit-clip-path: inset(10% 10% 10% 10%);")
        })

        it("builds zoom geometry for ppt crops (no overflow preview)", () => {
            const state = getCropState({ left: 50, type: "ppt" }, true)
            expect(state.showCropOverflowPreview).toBe(false)
            expect(state.mediaCropGeometry).toBe("width: 200%;height: 100%;left: -100%;top: 0%;")
        })
    })
})
