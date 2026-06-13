import { describe, it, expect, vi } from "vitest"
import { createKeydownHandler, triggerClickOnEnterSpace } from "./clickable"

// Minimal stand-in for a KeyboardEvent — just the bits these helpers touch.
function fakeEvent(key: string, opts: { node?: string; cls?: string[]; inSlide?: boolean } = {}) {
    const calls = { prevented: false, stopped: false, clicked: false }
    const target = {
        nodeName: opts.node ?? "DIV",
        classList: { contains: (c: string) => (opts.cls ?? []).includes(c) },
        closest: (sel: string) => (sel === ".slide" && opts.inSlide ? {} : null)
    }
    const event = {
        key,
        target,
        currentTarget: { click: () => (calls.clicked = true) },
        preventDefault: () => (calls.prevented = true),
        stopPropagation: () => (calls.stopped = true)
    }
    return { event, calls }
}

describe("clickable keyboard helpers", () => {
    describe("createKeydownHandler", () => {
        it("invokes the callback on Enter and Space (and prevents default)", () => {
            const cb = vi.fn()
            const handler = createKeydownHandler(cb)
            const enter = fakeEvent("Enter")
            handler(enter.event as any)
            handler(fakeEvent(" ").event as any)
            expect(cb).toHaveBeenCalledTimes(2)
            expect(enter.calls.prevented).toBe(true)
            expect(enter.calls.stopped).toBe(true)
        })

        it("ignores other keys", () => {
            const cb = vi.fn()
            createKeydownHandler(cb)(fakeEvent("a").event as any)
            expect(cb).not.toHaveBeenCalled()
        })

        it("ignores key events from inputs, textareas and editable elements", () => {
            const cb = vi.fn()
            const handler = createKeydownHandler(cb)
            handler(fakeEvent("Enter", { node: "INPUT" }).event as any)
            handler(fakeEvent("Enter", { node: "TEXTAREA" }).event as any)
            handler(fakeEvent("Enter", { cls: ["edit"] }).event as any)
            expect(cb).not.toHaveBeenCalled()
        })

        it("ignores Space inside a slide, but still handles Enter there", () => {
            const cb = vi.fn()
            const handler = createKeydownHandler(cb)
            handler(fakeEvent(" ", { inSlide: true }).event as any)
            expect(cb).not.toHaveBeenCalled()
            handler(fakeEvent("Enter", { inSlide: true }).event as any)
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    describe("triggerClickOnEnterSpace", () => {
        it("clicks the current target on Enter", () => {
            const e = fakeEvent("Enter")
            triggerClickOnEnterSpace(e.event as any)
            expect(e.calls.clicked).toBe(true)
        })

        it("does nothing for other keys or for inputs", () => {
            const other = fakeEvent("a")
            triggerClickOnEnterSpace(other.event as any)
            expect(other.calls.clicked).toBe(false)

            const input = fakeEvent("Enter", { node: "INPUT" })
            triggerClickOnEnterSpace(input.event as any)
            expect(input.calls.clicked).toBe(false)
        })
    })
})
