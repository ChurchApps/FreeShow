import { describe, expect, it } from "vitest"
import type { LayoutRef } from "../../../types/Show"
import { getUpcomingGroupIndex } from "./upcomingGroup"

function slide(layoutIndex: number, disabled = false, parentIndex?: number): LayoutRef {
    return {
        type: parentIndex === undefined ? "parent" : "child",
        layoutId: "layout",
        layoutIndex,
        index: layoutIndex,
        id: String(layoutIndex),
        parent: parentIndex === undefined ? undefined : { id: String(parentIndex), index: parentIndex, layoutIndex: parentIndex },
        data: { id: String(layoutIndex), disabled }
    }
}

describe("getUpcomingGroupIndex", () => {
    it("skips the current group's children and wholly disabled groups", () => {
        const ref = [slide(0), slide(1, false, 0), slide(2, true), slide(3, true, 2), slide(4)]
        expect(getUpcomingGroupIndex(ref, 0)).toBe(4)
        expect(getUpcomingGroupIndex(ref, 1)).toBe(4)
    })

    it("looks up the group from its first playable child when the parent slide is disabled", () => {
        const ref = [slide(0), slide(1, true), slide(2, false, 1), slide(3)]
        expect(getUpcomingGroupIndex(ref, 0)).toBe(1)
    })

    it("returns no result when there is no active slide or every later group is disabled", () => {
        const ref = [slide(0), slide(1, true), slide(2, true, 1)]
        expect(getUpcomingGroupIndex(ref, -1)).toBeUndefined()
        expect(getUpcomingGroupIndex(ref, 0)).toBeUndefined()
    })
})
