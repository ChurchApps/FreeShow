import { beforeEach, describe, expect, it, vi } from "vitest"

// search.ts pulls in stores + heavy collaborators; stub them so the pure scorer can run.
const h = vi.hoisted(() => {
    const makeStore = (initial: unknown) => {
        let value = initial
        return { _set: (v: unknown) => (value = v), subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) }
    }
    return { textCache: makeStore({}), categories: makeStore({}), drawerTabsData: makeStore({}) }
})
vi.mock("../stores", () => ({ textCache: h.textCache, categories: h.categories, drawerTabsData: h.drawerTabsData }))
vi.mock("../components/helpers/array", () => ({
    sortObjectNumbers: (arr: any[], key: string, desc = false) => [...arr].sort((a, b) => (desc ? (b[key] || 0) - (a[key] || 0) : (a[key] || 0) - (b[key] || 0)))
}))
// mirror the real Levenshtein-based similarity so the test reflects production behaviour
vi.mock("../converters/txt", () => {
    const editDistance = (a: string, b: string) => {
        a = a.toLowerCase()
        b = b.toLowerCase()
        const costs: number[] = []
        for (let i = 0; i <= a.length; i++) {
            let last = i
            for (let j = 0; j <= b.length; j++) {
                if (i === 0) costs[j] = j
                else if (j > 0) {
                    let next = costs[j - 1]
                    if (a[i - 1] !== b[j - 1]) next = Math.min(Math.min(next, last), costs[j]) + 1
                    costs[j - 1] = last
                    last = next
                }
            }
            if (i > 0) costs[b.length] = last
        }
        return costs[b.length]
    }
    const similarity = (s1: string, s2: string) => {
        const longer = s1.length >= s2.length ? s1 : s2
        const shorter = s1.length >= s2.length ? s2 : s1
        if (!longer.length) return 1
        return (longer.length - editDistance(longer, shorter)) / longer.length
    }
    return { similarity }
})

import { formatSearch, showSearch, showSearchFilter } from "./search"

const shows = [
    { id: "amazing", name: "Amazing Grace" },
    { id: "gracealone", name: "Grace Alone" },
    { id: "great", name: "How Great Thou Art" },
    { id: "mp", name: "Blessed Be", quickAccess: { number: "MP133" } }
] as any

const ids = (results: any[]) => results.map((r) => r.id)

describe("formatSearch", () => {
    it("lowercases and strips punctuation + diacritics", () => {
        expect(formatSearch("Café, Réal!")).toBe("cafe real")
    })
    it("optionally removes spaces", () => {
        expect(formatSearch("amazing grace", true)).toBe("amazinggrace")
    })
    it("returns empty string for non-strings", () => {
        expect(formatSearch(undefined as unknown as string)).toBe("")
    })
})

describe("showSearchFilter", () => {
    beforeEach(() => h.textCache._set({}))

    it("scores an exact title match 100", () => {
        expect(showSearchFilter("Amazing Grace", shows[0])).toBe(100)
    })
    it("scores a title starts-with match 100", () => {
        expect(showSearchFilter("amaz", shows[0])).toBe(100)
    })
    it("scores a song-number exact match 100", () => {
        expect(showSearchFilter("mp133", shows[3])).toBe(100)
    })
    it("ranks a title-word hit above a content-only hit", () => {
        h.textCache._set({ great: "amazing love how can it be" })
        const titleHit = showSearchFilter("amazing", shows[0]) // word in the title
        const contentHit = showSearchFilter("amazing", shows[2]) // word only in content
        expect(contentHit).toBeGreaterThan(0)
        expect(titleHit).toBeGreaterThan(contentHit)
    })
    it("returns 0 for no match", () => {
        expect(showSearchFilter("xylophone", shows[0])).toBe(0)
    })
    it("ignores empty / punctuation-only queries (no match-everything bug)", () => {
        expect(showSearchFilter("", shows[0])).toBe(0)
        expect(showSearchFilter("!!!", shows[0])).toBe(0)
    })
})

describe("showSearch ranking", () => {
    beforeEach(() => h.textCache._set({}))

    it("ranks a show containing ALL query words above one with only some (multi-word)", () => {
        const res = showSearch("amazing grace", shows)
        expect(ids(res)[0]).toBe("amazing")
        expect(ids(res)).toContain("gracealone")
        expect(ids(res).indexOf("amazing")).toBeLessThan(ids(res).indexOf("gracealone"))
    })
    it("finds a show by lyric content when the title doesn't match", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend or life to me" })
        const res = showSearch("everlasting portion", shows)
        expect(ids(res)[0]).toBe("great")
    })
    it("excludes non-matching shows", () => {
        const res = showSearch("zzz nonexistent", shows)
        expect(res.some((r) => r.id === "amazing")).toBe(false)
    })
    it("normalizes the top match to 100", () => {
        const res = showSearch("grace", shows)
        expect(res[0].match).toBe(100)
    })
    it("does not flood results with unrelated shows (fuzzy similarity alone never matches)", () => {
        // regression: similarity() is non-zero for unrelated text; it must not include non-matching shows
        const res = showSearch("kitchen", shows)
        expect(res.length).toBe(0)
    })
    it("still matches a close typo via fuzzy title similarity", () => {
        const res = showSearch("amzinggrace", shows)
        expect(res[0]?.id).toBe("amazing")
    })
})

describe("exact phrase (quoted) search", () => {
    beforeEach(() => h.textCache._set({}))

    it("matches a quoted phrase that appears in the title", () => {
        expect(showSearchFilter('"amazing grace"', shows[0])).toBe(100)
    })
    it("does not match without the exact phrase, and ignores fuzzy/typos", () => {
        expect(showSearchFilter('"amazing grace"', shows[1])).toBe(0)
        expect(showSearchFilter('"amzing grace"', shows[0])).toBe(0)
    })
    it("matches a quoted phrase found in lyrics/content", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend" })
        const res = showSearch('"everlasting portion"', shows)
        expect(res[0]?.id).toBe("great")
    })
    it("returns nothing when the quoted phrase matches no show", () => {
        const res = showSearch('"not a real phrase"', shows)
        expect(res.length).toBe(0)
    })
})
