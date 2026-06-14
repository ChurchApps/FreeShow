import { describe, it, expect } from "vitest"
import { languageFlags, languages, replace } from "./languageData"

// These three maps must stay in lockstep: adding a language means adding a
// browser-locale mapping AND a flag. These tests fail loudly if one is forgotten.
describe("languageData consistency", () => {
    const codes = Object.keys(languages)

    it("defines at least the core languages", () => {
        expect(codes).toContain("en")
        expect(codes.length).toBeGreaterThan(10)
    })

    it("has a non-empty browser-locale mapping for every language", () => {
        for (const code of codes) {
            const locales = replace[code as keyof typeof replace]
            expect(Array.isArray(locales), `missing replace entry for ${code}`).toBe(true)
            expect(locales.length, `empty replace entry for ${code}`).toBeGreaterThan(0)
        }
    })

    it("has a flag for every language", () => {
        for (const code of codes) {
            expect(languageFlags, `missing flag for ${code}`).toHaveProperty(code)
        }
    })

    it("has no stray keys in replace or flags", () => {
        const sorted = codes.slice().sort()
        expect(Object.keys(replace).sort()).toEqual(sorted)
        expect(Object.keys(languageFlags).sort()).toEqual(sorted)
    })
})
