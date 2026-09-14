import { EventEmitter } from "events"
import { describe, expect, it, vi } from "vitest"

vi.mock("../IPC/responsesMain", () => ({
    createLog: (err: any) => ({ message: String(err?.message || err) }),
    logError: () => {}
}))

vi.mock("./files", () => ({
    createFolder: () => {}
}))

// Fake ClientRequest that mimics the two Node.js behaviors this test cares about:
// - options.timeout alone only emits a "timeout" event, it never aborts the connection on its own.
// - calling .destroy(err) on a real ClientRequest asynchronously emits an "error" event with err.
// This lets the test drive httpsRequest() through the exact hang scenario without opening real sockets.
class FakeClientRequest extends EventEmitter {
    destroyed = false
    write() {}
    end() {}
    destroy(err?: Error) {
        this.destroyed = true
        if (err) queueMicrotask(() => this.emit("error", err))
    }
}

class FakeResponse extends EventEmitter {
    statusCode = 200
    headers = {}
    pipe() {}
}

let lastRequest: FakeClientRequest
let lastResponse: FakeResponse

vi.mock("https", () => ({
    default: {
        request: (_options: any, onResponse: any) => {
            lastRequest = new FakeClientRequest()
            lastResponse = new FakeResponse()
            lastRequest.on("__respond", () => onResponse(lastResponse))
            return lastRequest
        }
    }
}))

import { httpsRequest } from "./requests"

describe("httpsRequest", () => {
    it("calls the callback with a timeout error once the timeout event fires, instead of hanging forever", async () => {
        const cb = vi.fn()
        httpsRequest("example.com", "/", "GET", {}, {}, cb)

        // simulate Node emitting "timeout" after options.timeout elapses on a hung connection
        lastRequest.emit("timeout")

        await new Promise((r) => setTimeout(r, 10))
        expect(cb).toHaveBeenCalledTimes(1)
        const [err, result] = cb.mock.calls[0]
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toMatch(/timed out/i)
        expect(result).toBeNull()
        expect(lastRequest.destroyed).toBe(true)
    })

    it("only calls the callback once when the timeout fires after the response already started (partial response, then hang)", async () => {
        const cb = vi.fn()
        httpsRequest("example.com", "/", "GET", {}, {}, cb)

        // response headers arrived, but the body stalls (e.g. a slow/hung backend) - then the
        // timeout fires; both the request's "error" and the response's own "error" can follow
        lastRequest.emit("__respond")
        lastRequest.emit("timeout")
        await new Promise((r) => setTimeout(r, 0))
        lastResponse.emit("error", new Error("aborted"))

        await new Promise((r) => setTimeout(r, 10))
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb.mock.calls[0][0].message).toMatch(/timed out/i)
    })

    it("calls callback with error when file download response stream emits an error", async () => {
        const cb = vi.fn()
        httpsRequest("example.com", "/file.zip", "GET", {}, {}, cb, "/tmp/file.zip")

        lastRequest.emit("__respond")
        lastResponse.emit("error", new Error("stream connection broke"))

        await new Promise((r) => setTimeout(r, 10))
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb.mock.calls[0][0].message).toMatch(/stream connection broke/i)
    })

    it("calls callback with error when file download response closes prematurely", async () => {
        const cb = vi.fn()
        httpsRequest("example.com", "/file.zip", "GET", {}, {}, cb, "/tmp/file.zip")

        lastRequest.emit("__respond")
        ;(lastResponse as any).complete = false
        lastResponse.emit("close")

        await new Promise((r) => setTimeout(r, 10))
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb.mock.calls[0][0].message).toMatch(/closed prematurely/i)
    })
})
