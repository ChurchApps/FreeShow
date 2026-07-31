import { describe, expect, it } from "vitest"
import { isComposingKey } from "./composition"

const key = (props: Partial<KeyboardEvent>) => ({ isComposing: false, keyCode: 0, ...props }) as KeyboardEvent

describe("isComposingKey", () => {
    it("is true while an IME is composing", () => {
        expect(isComposingKey(key({ key: "Enter", isComposing: true }))).toBe(true)
    })

    it("is true for keyCode 229, which some engines send instead", () => {
        expect(isComposingKey(key({ key: "Process", keyCode: 229 }))).toBe(true)
    })

    it("is false for ordinary typing", () => {
        expect(isComposingKey(key({ key: "Enter", keyCode: 13 }))).toBe(false)
        expect(isComposingKey(key({ key: "a", keyCode: 65 }))).toBe(false)
        expect(isComposingKey(key({ key: "Backspace", keyCode: 8 }))).toBe(false)
    })

    it("is false for the Enter that commits, once composition has ended", () => {
        expect(isComposingKey(key({ key: "Enter", keyCode: 13, isComposing: false }))).toBe(false)
    })
})
