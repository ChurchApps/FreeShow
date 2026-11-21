import { describe, expect, it } from "vitest"
import { getSlideProgress } from "./slideProgress"

const makeLayout = (...disabledFlags: boolean[]) => disabledFlags.map((disabled, index) => ({ data: { id: String(index), disabled } }))

describe("getSlideProgress", () => {
    it("counts enabled slides at or before the live slide and across the layout", () => {
        const layout = makeLayout(false, true, false, true)
        expect(getSlideProgress(layout, 0)).toEqual({ currentSlideNumber: 1, slidesLength: 2 })
        expect(getSlideProgress(layout, 2)).toEqual({ currentSlideNumber: 2, slidesLength: 2 })
    })

    it("keeps the enabled position when a disabled slide is manually shown", () => {
        expect(getSlideProgress(makeLayout(false, true, false), 1)).toEqual({ currentSlideNumber: 1, slidesLength: 2 })
    })

    it("reports zero progress when there is no live slide or every slide is disabled", () => {
        expect(getSlideProgress(makeLayout(false, true, false), -1)).toEqual({ currentSlideNumber: 0, slidesLength: 2 })
        expect(getSlideProgress(makeLayout(true, true), 1)).toEqual({ currentSlideNumber: 0, slidesLength: 0 })
        expect(getSlideProgress([], 0)).toEqual({ currentSlideNumber: 0, slidesLength: 0 })
    })
})
