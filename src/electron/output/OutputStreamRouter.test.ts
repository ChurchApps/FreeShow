import { beforeEach, describe, expect, it } from "vitest"
import { OutputStreamRouter, slugifyStreamPath, STREAM_FRAME_ACK_TIMEOUT } from "./OutputStreamRouter"

const outputA = { id: "out-a", path: "/primary", name: "Primary" }
const outputB = { id: "out-b", path: "/stage-left", name: "Stage Left" }

describe("slugifyStreamPath", () => {
    it("matches paths, names and ids to the same slug", () => {
        expect(slugifyStreamPath("/Stage Left")).toBe("stage-left")
        expect(slugifyStreamPath("Stage Left")).toBe("stage-left")
        expect(slugifyStreamPath("/stage-left/")).toBe("stage-left")
        expect(slugifyStreamPath("/")).toBe("")
        expect(slugifyStreamPath("")).toBe("")
    })
})

describe("OutputStreamRouter", () => {
    beforeEach(() => OutputStreamRouter.reset())

    it("routes each output only to the clients watching that output", () => {
        OutputStreamRouter.addSocket("a")
        OutputStreamRouter.addSocket("b")
        OutputStreamRouter.setPath("a", "/primary")
        OutputStreamRouter.setPath("b", "/stage-left")

        const sockets = ["a", "b"]
        expect(OutputStreamRouter.getTargets(sockets, outputA)).toEqual(["a"])
        expect(OutputStreamRouter.getTargets(sockets, outputB)).toEqual(["b"])
    })

    it("falls back to the output name and id when no path is stored", () => {
        OutputStreamRouter.addSocket("byName")
        OutputStreamRouter.addSocket("byId")
        OutputStreamRouter.setPath("byName", "/stage-left")
        OutputStreamRouter.setPath("byId", "/out-b")

        const targets = OutputStreamRouter.getTargets(["byName", "byId"], { id: outputB.id, name: outputB.name })
        expect(targets).toEqual(["byName", "byId"])
    })

    it("sends nothing to a client whose path matches no output", () => {
        OutputStreamRouter.addSocket("a")
        OutputStreamRouter.setPath("a", "/does-not-exist")

        expect(OutputStreamRouter.getTargets(["a"], outputA)).toEqual([])
    })

    it("gives root clients the output selected in the server settings", () => {
        OutputStreamRouter.addSocket("root")
        OutputStreamRouter.setPath("root", "/")

        expect(OutputStreamRouter.getTargets(["root"], outputA, outputA.id)).toEqual(["root"])
        expect(OutputStreamRouter.getTargets(["root"], outputB, outputA.id)).toEqual([])
    })

    it("sends nothing until a new client announced which output it wants", () => {
        OutputStreamRouter.addSocket("a", 1000)

        // would otherwise briefly render another output before the subscription arrives
        expect(OutputStreamRouter.getTargets(["a"], outputA, "", 1100)).toEqual([])

        OutputStreamRouter.setPath("a", "/primary")
        expect(OutputStreamRouter.getTargets(["a"], outputA, "", 1200)).toEqual(["a"])
    })

    it("falls back to the root output for clients that never announce a path", () => {
        OutputStreamRouter.addSocket("old", 1000)

        expect(OutputStreamRouter.getTargets(["old"], outputA, outputA.id, 1100)).toEqual([])
        expect(OutputStreamRouter.getTargets(["old"], outputA, outputA.id, 9000)).toEqual(["old"])
    })

    it("keeps root clients on a single output when none is selected", () => {
        OutputStreamRouter.addSocket("root")
        OutputStreamRouter.setPath("root", "/")

        // the first output that streams claims the root path, so it does not flip between outputs
        expect(OutputStreamRouter.getTargets(["root"], outputB, "", 1000)).toEqual(["root"])
        expect(OutputStreamRouter.getTargets(["root"], outputA, "", 1000)).toEqual([])
        expect(OutputStreamRouter.getTargets(["root"], outputB, "", 1100)).toEqual(["root"])

        // another output takes over once that one stops streaming
        expect(OutputStreamRouter.getTargets(["root"], outputA, "", 9000)).toEqual(["root"])
        expect(OutputStreamRouter.getTargets(["root"], outputB, "", 9100)).toEqual([])
    })

    it("waits for an acknowledgement before sending the next frame of the same output", () => {
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1000)).toBe(true)
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1050)).toBe(false)

        OutputStreamRouter.acknowledge("a", outputA.id)
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1100)).toBe(true)
    })

    it("does not let one output or one client block another", () => {
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1000)).toBe(true)
        // different output, same client
        expect(OutputStreamRouter.claimFrame("a", outputB.id, 1000)).toBe(true)
        // same output, different client
        expect(OutputStreamRouter.claimFrame("b", outputA.id, 1000)).toBe(true)
    })

    it("resumes streaming when a client stops acknowledging", () => {
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1000)).toBe(true)
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1000 + STREAM_FRAME_ACK_TIMEOUT)).toBe(true)
    })

    it("drops pending frames when a client switches output or disconnects", () => {
        OutputStreamRouter.addSocket("a")
        OutputStreamRouter.setPath("a", "/primary")
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1000)).toBe(true)

        OutputStreamRouter.setPath("a", "/stage-left")
        expect(OutputStreamRouter.claimFrame("a", outputA.id, 1050)).toBe(true)
        expect(OutputStreamRouter.getTargets(["a"], outputA)).toEqual([])

        // disconnecting clears the stored path and any frame still waiting for an acknowledgement
        expect(OutputStreamRouter.claimFrame("a", outputB.id, 1050)).toBe(true)
        OutputStreamRouter.removeSocket("a")
        expect(OutputStreamRouter.claimFrame("a", outputB.id, 1060)).toBe(true)
        expect(OutputStreamRouter.getTargets(["a"], outputA, outputA.id)).toEqual(["a"]) // untracked = root client
    })
})
