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
    it("only matches words at word starts — 'here' never matches \"There's\"", () => {
        expect(showSearchFilter("here", { id: "nothingbetter", name: "There's Nothing Better" } as any)).toBe(0)
        expect(showSearchFilter("here", { id: "anointinghere", name: "There's An Anointing Here" } as any)).toBe(80)
    })
    it("matches partially typed words at word starts (type-ahead)", () => {
        expect(showSearchFilter("amaz grac", shows[0])).toBe(90)
    })
})

describe("absolute confidence bands", () => {
    beforeEach(() => h.textCache._set({}))

    it("scores all words in the title, adjacent and in order, 90", () => {
        expect(showSearchFilter("anointing here", { id: "a", name: "There's An Anointing Here" } as any)).toBe(90)
    })
    it("scores all words in the title, scattered/reversed, 75", () => {
        expect(showSearchFilter("grace amazing", shows[0])).toBe(75)
    })
    it("scores a single word in the title 80", () => {
        expect(showSearchFilter("grace", shows[0])).toBe(80)
    })
    it("scores words split between title and content 55-75", () => {
        h.textCache._set({ aida: "the anointing is here today" })
        const score = showSearchFilter("anointing here", { id: "aida", name: "The Anointing - AIDA" } as any)
        expect(score).toBeGreaterThanOrEqual(55)
        expect(score).toBeLessThanOrEqual(75)
    })
    it("scores content-only matches 40-60 (at or above the create-hint threshold)", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend or life to me" })
        const score = showSearchFilter("everlasting portion", shows[2])
        expect(score).toBe(55) // 40 + full adjacency 10 + phrase bonus 5
        expect(score).toBeGreaterThanOrEqual(40)
    })
    it("keeps absolute scores in showSearch results (no renormalizing to the top hit)", () => {
        const res = showSearch("grace", shows)
        expect(res[0].id).toBe("gracealone") // starts-with -> 100
        expect(res[0].match).toBe(100)
        expect(res.find((r) => r.id === "amazing")?.match).toBe(80) // absolute, not scaled up
    })
})

describe("strict AND narrowing", () => {
    beforeEach(() => h.textCache._set({}))

    it("excludes shows missing any query word", () => {
        const res = showSearch("amazing grace", shows)
        expect(ids(res)).toEqual(["amazing"]) // "Grace Alone" lacks "amazing"
    })
    it("a garbage word yields no results", () => {
        const res = showSearch("anointing here mksowejasdlkansdad", [{ id: "anointinghere", name: "There's An Anointing Here" }] as any)
        expect(res.length).toBe(0)
    })
    it("requires short words too", () => {
        expect(showSearchFilter("xq grace", shows[0])).toBe(0)
    })
    it("adding a word can only narrow the results", () => {
        h.textCache._set({ great: "amazing love how can it be" })
        const broad = showSearch("amazing", shows)
        const narrow = showSearch("amazing love", shows)
        expect(ids(narrow).every((id) => ids(broad).includes(id))).toBe(true)
        expect(ids(narrow)).toEqual(["great"]) // only the show containing both words remains
    })
})

describe("showSearch ranking", () => {
    beforeEach(() => h.textCache._set({}))

    it("finds a show by lyric content when the title doesn't match", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend or life to me" })
        const res = showSearch("everlasting portion", shows)
        expect(ids(res)[0]).toBe("great")
    })
    it("ranks adjacent title words above a title+content split match", () => {
        h.textCache._set({ aida: "the anointing is here today" })
        const res = showSearch("anointing here", [
            { id: "anointinghere", name: "There's An Anointing Here" },
            { id: "aida", name: "The Anointing - AIDA" }
        ] as any)
        expect(ids(res)).toEqual(["anointinghere", "aida"])
        expect(res[0].match).toBe(90)
        expect(res[1].match).toBeLessThan(90)
    })
    it("does not flood results with unrelated shows (fuzzy similarity alone never matches)", () => {
        // regression: similarity() is non-zero for unrelated text; it must not include non-matching shows
        const res = showSearch("kitchen", shows)
        expect(res.length).toBe(0)
    })
    it("still matches a close typo via fuzzy title similarity", () => {
        const res = showSearch("amzinggrace", shows)
        expect(res[0]?.id).toBe("amazing")
        expect(res[0]?.match).toBeGreaterThanOrEqual(60) // typo band 60-85
        expect(res[0]?.match).toBeLessThanOrEqual(85)
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
    it("matches a quoted phrase found in lyrics/content at 70", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend" })
        const res = showSearch('"everlasting portion"', shows)
        expect(res[0]?.id).toBe("great")
        expect(res[0]?.match).toBe(70)
    })
    it("anchors quoted phrases to word boundaries", () => {
        expect(showSearchFilter('"here"', { id: "nothingbetter", name: "There's Nothing Better" } as any)).toBe(0)
        expect(showSearchFilter('"here"', { id: "anointinghere", name: "There's An Anointing Here" } as any)).toBe(100)
    })
    it("returns nothing when the quoted phrase matches no show", () => {
        const res = showSearch('"not a real phrase"', shows)
        expect(res.length).toBe(0)
    })
})
