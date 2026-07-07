import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// common.ts pulls in stores, IPC, and cross-module helpers we don't need. Stub them all —
// the target functions (throttle, hasNewerUpdate, wait) don't actually touch any of them.
vi.mock("../stores", () => {
    const makeStore = (initial: unknown = null) => {
        let value = initial
        return {
            _set: (v: unknown) => (value = v),
            set: (v: unknown) => (value = v),
            subscribe: (fn: (v: unknown) => void) => (fn(value), () => {})
        }
    }
    return {
        activePopup: makeStore(""),
        activeTriggerFunction: makeStore(""),
        autosave: makeStore("15min"),
        currentWindow: makeStore(null),
        disabledServers: makeStore({}),
        drawer: makeStore({ height: 0, stored: null }),
        errorHasOccurred: makeStore(false),
        focusedArea: makeStore(""),
        os: makeStore({ platform: "test" }),
        outputs: makeStore({}),
        quickSearchActive: makeStore(false),
        resized: makeStore({ leftPanel: 0, rightPanel: 0 }),
        serverData: makeStore({}),
        statusIndicator: makeStore(""),
        theme: makeStore("light"),
        themes: makeStore({}),
        toastMessages: makeStore([]),
        version: makeStore("test")
    }
})
vi.mock("../components/helpers/output", () => ({ getActiveOutputs: () => [], toggleOutputs: () => {} }))
vi.mock("../IPC/main", () => ({ sendMain: () => {} }))
vi.mock("./request", () => ({ send: () => {} }))
vi.mock("./save", () => ({ save: () => {} }))
vi.mock("../values/autosave", () => ({ convertAutosave: {} }))
// keep the real array/color helpers — they're small and used by common's public surface

import { hasNewerUpdate, throttle, wait } from "./common"

describe("wait", () => {
    it("resolves with 'ended' after the requested delay", async () => {
        const result = await wait(10)
        expect(result).toBe("ended")
    })
})

describe("throttle", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("invokes the callback synchronously on the first call for a given id", () => {
        const cb = vi.fn()
        throttle("t1", 1, cb, 10)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb).toHaveBeenCalledWith(1)
    })

    it("swallows rapid-fire calls in the same window, then emits the latest value on the trailing edge", () => {
        const cb = vi.fn()
        throttle("t2", 1, cb, 10) // fires immediately with 1
        throttle("t2", 2, cb, 10) // held
        throttle("t2", 3, cb, 10) // held (only the latest survives)
        expect(cb).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(1000 / 10) // 100ms window elapses
        // trailing call fires with the most recent value
        expect(cb).toHaveBeenCalledTimes(2)
        expect(cb).toHaveBeenLastCalledWith(3)
    })

    it("does NOT emit a trailing call if nothing new arrived during the throttle window", () => {
        const cb = vi.fn()
        throttle("t3", "only", cb, 10) // fires immediately
        vi.advanceTimersByTime(1000 / 10)
        // no queued update, so no trailing emission
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("uses separate windows per id", () => {
        const cb1 = vi.fn()
        const cb2 = vi.fn()
        throttle("A", 1, cb1, 10)
        throttle("B", 2, cb2, 10)
        expect(cb1).toHaveBeenCalledWith(1)
        expect(cb2).toHaveBeenCalledWith(2)
    })
})

describe("hasNewerUpdate", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("resolves false after the timeout when no newer call comes in", async () => {
        const p = hasNewerUpdate("only", 50)
        vi.advanceTimersByTime(60)
        await expect(p).resolves.toBe(false)
    })

    it("resolves true on the OLD promise when a newer call arrives for the same id (supersedes)", async () => {
        const first = hasNewerUpdate("same-id", 100)
        const second = hasNewerUpdate("same-id", 100) // the new one preempts the first

        await expect(first).resolves.toBe(true) // superseded
        vi.advanceTimersByTime(120)
        await expect(second).resolves.toBe(false) // and the new one gets to finish
    })

    it("keeps ids independent (a newer update on one id doesn't preempt another)", async () => {
        const a = hasNewerUpdate("id-A", 50)
        const b = hasNewerUpdate("id-B", 50)
        vi.advanceTimersByTime(60)
        await expect(a).resolves.toBe(false)
        await expect(b).resolves.toBe(false)
    })
})
