import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addStageStreamViewer, hasStageStreamViewers, removeStageStreamViewer } from "./stageStreamViewers"

const OUTPUT_ID = "output1"

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    // module state is shared - make sure every registered viewer is expired out
    vi.advanceTimersByTime(60000)
    hasStageStreamViewers([], OUTPUT_ID)
    vi.useRealTimers()
})

describe("stageStreamViewers — mirror viewer tracking for capture gating", () => {
    it("reports no viewers when no client subscribed (text-only stage displays)", () => {
        expect(hasStageStreamViewers(["socketA", "socketB"], OUTPUT_ID)).toBe(false)
    })

    it("reports a viewer after subscribing, and flags first registration", () => {
        expect(addStageStreamViewer("socketA", OUTPUT_ID)).toBe(true)
        expect(addStageStreamViewer("socketA", OUTPUT_ID)).toBe(false) // renewal, not new
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(true)
    })

    it("matches any output for viewers without a specific output id", () => {
        addStageStreamViewer("socketA")
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(true)
        expect(hasStageStreamViewers(["socketA"], "otherOutput")).toBe(true)
    })

    it("does not match a different output for viewers with a specific output id", () => {
        addStageStreamViewer("socketA", OUTPUT_ID)
        expect(hasStageStreamViewers(["socketA"], "otherOutput")).toBe(false)
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(true)
    })

    it("stops reporting after unsubscribe", () => {
        addStageStreamViewer("socketA", OUTPUT_ID)
        removeStageStreamViewer("socketA")
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(false)
    })

    it("prunes disconnected viewers", () => {
        addStageStreamViewer("socketA", OUTPUT_ID)
        expect(hasStageStreamViewers(["socketB"], OUTPUT_ID)).toBe(false)
    })

    it("expires viewers whose heartbeat stopped", () => {
        addStageStreamViewer("socketA", OUTPUT_ID)
        vi.advanceTimersByTime(11000)
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(false)
    })

    it("keeps viewers alive while the heartbeat renews them", () => {
        addStageStreamViewer("socketA", OUTPUT_ID)
        vi.advanceTimersByTime(8000)
        addStageStreamViewer("socketA", OUTPUT_ID)
        vi.advanceTimersByTime(8000)
        expect(hasStageStreamViewers(["socketA"], OUTPUT_ID)).toBe(true)
    })
})
