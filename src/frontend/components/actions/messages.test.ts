import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// messages.ts pulls in stores + output helpers; stub the heavy collaborators, keep real svelte stores
const h = vi.hoisted(() => ({
    setOutputCalls: [] as any[][],
    clearOverlayCalls: [] as string[]
}))

vi.mock("../../stores", async () => {
    const { writable } = await import("svelte/store")
    return {
        messages: writable({}),
        overlays: writable({}),
        outLocked: writable(false)
    }
})
vi.mock("../helpers/output", () => ({
    setOutput: (...args: any[]) => h.setOutputCalls.push(args)
}))
vi.mock("../output/clear", () => ({
    clearOverlay: (id: string) => h.clearOverlayCalls.push(id)
}))
vi.mock("./apiHelper", () => ({
    // simplified closest-match: exact (case-insensitive) first, then substring
    sortByClosestMatch: (array: any[], value: string, key = "name") => [...array].sort((a, b) => (b[key]?.toLowerCase() === value.toLowerCase() ? 1 : 0) - (a[key]?.toLowerCase() === value.toLowerCase() ? 1 : 0) || (b[key]?.toLowerCase().includes(value.toLowerCase()) ? 1 : 0) - (a[key]?.toLowerCase().includes(value.toLowerCase()) ? 1 : 0))
}))
vi.mock("../helpers/array", () => ({
    keysToID: (object: Record<string, any>) => Object.entries(object).map(([id, a]) => ({ ...a, id }))
}))

import { messages, outLocked, overlays } from "../../stores"
import { clearMessage, getMessages, isMessageActive, replaceMessageTokens, triggerMessage, triggerMessageByName } from "./messages"

const LOBBY_MESSAGE = {
    name: "Lobby call",
    text: "Parent of child {{number}},\nplease come to the {place}",
    tokens: { number: "000" }
}

beforeEach(() => {
    vi.useFakeTimers()
    h.setOutputCalls.length = 0
    h.clearOverlayCalls.length = 0
    messages.set({ lobby: { ...LOBBY_MESSAGE } } as any)
    overlays.set({})
    outLocked.set(false)
})
afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
})

describe("replaceMessageTokens", () => {
    it("fills {{tokens}} from trigger values, falling back to message defaults", () => {
        const message = get(messages).lobby
        expect(replaceMessageTokens(message.text, message, { number: "42" })).toBe("Parent of child 42,\nplease come to the {place}")
        expect(replaceMessageTokens(message.text, message, {})).toBe("Parent of child 000,\nplease come to the {place}")
    })

    it("leaves single-brace {dynamic values} untouched for live render-time resolution", () => {
        const message = get(messages).lobby
        expect(replaceMessageTokens(message.text, message, { number: "7" })).toContain("{place}")
    })

    it("keeps unfilled tokens visible when no value or default exists", () => {
        const message = { name: "m", text: "Hello {{who}}" } as any
        expect(replaceMessageTokens(message.text, message, {})).toBe("Hello {{who}}")
    })
})

describe("triggerMessage", () => {
    it("materializes a marked overlay with resolved text and pushes it to the output", () => {
        triggerMessage("lobby", { number: "42" })

        const overlay = get(overlays).message_lobby
        expect(overlay).toBeTruthy()
        expect(overlay.fromMessageId).toBe("lobby")
        expect(overlay.items[0].lines?.map((l) => l.text[0].value)).toEqual(["Parent of child 42,", "please come to the {place}"])

        // pushed onto the overlay output layer with add=true
        expect(h.setOutputCalls).toContainEqual(["overlays", "message_lobby", false, "", true])
        expect(isMessageActive("lobby")).toBe(true)
    })

    it("re-triggering replaces the shown values instead of stacking", () => {
        triggerMessage("lobby", { number: "1" })
        triggerMessage("lobby", { number: "2" })

        expect(Object.keys(get(overlays))).toEqual(["message_lobby"])
        expect(get(overlays).message_lobby.items[0].lines?.[0].text[0].value).toBe("Parent of child 2,")
    })

    it("does nothing when the output is locked or the message is unknown", () => {
        outLocked.set(true)
        triggerMessage("lobby")
        outLocked.set(false)
        triggerMessage("missing")

        expect(get(overlays)).toEqual({})
        expect(h.setOutputCalls.length).toBe(0)
    })

    it("auto-clears after displayDuration seconds", () => {
        messages.update((a: any) => ((a.lobby.displayDuration = 10), a))
        triggerMessage("lobby")
        expect(h.clearOverlayCalls).toEqual([])

        vi.advanceTimersByTime(10_000)
        expect(h.clearOverlayCalls).toEqual(["message_lobby"])
    })
})

describe("triggerMessageByName", () => {
    it("finds the closest-matching message by name", () => {
        triggerMessageByName("lobby call", { number: "9" })
        expect(get(overlays).message_lobby?.items[0].lines?.[0].text[0].value).toBe("Parent of child 9,")
    })
})

describe("clearMessage", () => {
    it("clears the output layer and removes the transient overlay after the clearing transition", () => {
        triggerMessage("lobby")
        clearMessage("lobby")

        expect(h.clearOverlayCalls).toEqual(["message_lobby"])
        // overlay data stays briefly so the layer can animate out...
        expect(get(overlays).message_lobby).toBeTruthy()
        // ...then is deleted
        vi.advanceTimersByTime(600)
        expect(get(overlays).message_lobby).toBeUndefined()
        expect(isMessageActive("lobby")).toBe(false)
    })

    it("cancels a pending auto-clear", () => {
        messages.update((a: any) => ((a.lobby.displayDuration = 10), a))
        triggerMessage("lobby")
        clearMessage("lobby")
        vi.advanceTimersByTime(20_000)

        // only the manual clear - the auto-clear timeout was cancelled
        expect(h.clearOverlayCalls).toEqual(["message_lobby"])
    })
})

describe("getMessages", () => {
    it("lists messages with token names and live active state", () => {
        expect(getMessages()).toEqual([{ id: "lobby", name: "Lobby call", text: LOBBY_MESSAGE.text, tokens: ["number"], displayDuration: 0, active: false }])

        triggerMessage("lobby")
        expect(getMessages()[0].active).toBe(true)
    })
})
