import { describe, expect, it, vi } from "vitest"

// spellcheck.ts reaches for the electron app/window, which does not exist in a unit test
vi.mock("electron", () => ({}))
vi.mock("../IPC/main", () => ({ sendToMain: vi.fn() }))
vi.mock("..", () => ({ getMainWindow: () => null }))
vi.mock("../data/store", () => ({ config: { get: vi.fn(), set: vi.fn() } }))

const { findSpellCheckerLanguage } = await import("./spellcheck")

// what Chromium actually offers, shortened
const AVAILABLE = ["en-US", "en-GB", "es-ES", "es-419", "pt-BR", "pt-PT", "nb", "de"]

describe("findSpellCheckerLanguage", () => {
    it("takes an exact match first", () => {
        expect(findSpellCheckerLanguage("pt-BR", AVAILABLE)).toBe("pt-BR")
        expect(findSpellCheckerLanguage("nb", AVAILABLE)).toBe("nb")
    })

    it("falls back to the same language in another region", () => {
        expect(findSpellCheckerLanguage("es", AVAILABLE)).toBe("es-ES")
        expect(findSpellCheckerLanguage("en", AVAILABLE)).toBe("en-US")
    })

    it("accepts the underscore form the app uses", () => {
        expect(findSpellCheckerLanguage("pt_BR", AVAILABLE)).toBe("pt-BR")
    })

    it("ignores case", () => {
        expect(findSpellCheckerLanguage("ES-es", AVAILABLE)).toBe("es-ES")
    })

    it("returns nothing when there is no dictionary for the language", () => {
        expect(findSpellCheckerLanguage("zu", AVAILABLE)).toBe("")
        expect(findSpellCheckerLanguage("", AVAILABLE)).toBe("")
        expect(findSpellCheckerLanguage("es", [])).toBe("")
    })
})
