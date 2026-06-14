import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { destroy, receive, send } from "./request"

describe("request (renderer IPC dispatch helpers)", () => {
    let api: { send: ReturnType<typeof vi.fn>; receive: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        api = { send: vi.fn(), receive: vi.fn(), removeListener: vi.fn() }
        ;(globalThis as any).window = { api }
    })
    afterEach(() => {
        delete (globalThis as any).window
    })

    it("send() forwards the data to every channel", () => {
        send("MAIN" as any, ["a", "b"], { x: 1 })
        expect(api.send).toHaveBeenCalledTimes(2)
        expect(api.send).toHaveBeenCalledWith("MAIN", { channel: "a", data: { x: 1 } })
        expect(api.send).toHaveBeenCalledWith("MAIN", { channel: "b", data: { x: 1 } })
    })

    it("receive() dispatches an incoming message to the handler for its channel", () => {
        const handlers = { greet: vi.fn(), other: vi.fn() }
        receive("MAIN" as any, handlers, "listener-1")

        const [registeredId, onMessage, listenerId] = api.receive.mock.calls[0]
        expect(registeredId).toBe("MAIN")
        expect(listenerId).toBe("listener-1")

        onMessage({ channel: "greet", data: 42 })
        expect(handlers.greet).toHaveBeenCalledWith(42)
        expect(handlers.other).not.toHaveBeenCalled()
    })

    it("destroy() removes the listener", () => {
        destroy("MAIN" as any, "listener-1")
        expect(api.removeListener).toHaveBeenCalledWith("MAIN", "listener-1")
    })
})
