import { describe, expect, it } from "vitest"
import { getUpDownSlideKey } from "./clickerKeys"

describe("getUpDownSlideKey", () => {
    it("maps ArrowDown to next slide and ArrowUp to previous slide when enabled", () => {
        expect(getUpDownSlideKey("ArrowDown", true)).toBe("ArrowRight")
        expect(getUpDownSlideKey("ArrowUp", true)).toBe("ArrowLeft")
    })

    it("keeps the default behaviour when disabled", () => {
        expect(getUpDownSlideKey("ArrowDown", false)).toBeNull()
        expect(getUpDownSlideKey("ArrowUp", false)).toBeNull()
    })

    it("ignores other keys", () => {
        for (const key of ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", " ", "Home", "End", "a"]) {
            expect(getUpDownSlideKey(key, true)).toBeNull()
        }
    })
})
