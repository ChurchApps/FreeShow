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
    it("scores a title starts-with match dynamically below 100", () => {
        expect(showSearchFilter("amaz", shows[0])).toBe(85)
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
        expect(showSearchFilter("here", { id: "anointinghere", name: "There's An Anointing Here" } as any)).toBe(84)
    })
    it("matches partially typed words at word starts (type-ahead)", () => {
        expect(showSearchFilter("amaz grac", shows[0])).toBe(89)
    })
    it("ranks exact title at 100, whole-word prefix at 92, and partial-word prefix at 86", () => {
        const songList = [
            { id: "exact", name: "Grace" },
            { id: "alone", name: "Grace Alone" },
            { id: "graceful", name: "Graceful" }
        ] as any
        const res = showSearch("grace", songList)
        expect(res[0].id).toBe("exact")
        expect(res[0].match).toBe(100)
        expect(res[1].id).toBe("alone")
        expect(res[1].match).toBe(92)
        expect(res[2].id).toBe("graceful")
        expect(res[2].match).toBe(86)
    })
})

describe("absolute confidence bands", () => {
    beforeEach(() => h.textCache._set({}))

    it("scores all words in the title, adjacent and in order, 89", () => {
        expect(showSearchFilter("anointing here", { id: "a", name: "There's An Anointing Here" } as any)).toBe(89)
    })
    it("scores all words in the title, scattered/reversed, 86", () => {
        expect(showSearchFilter("grace amazing", shows[0])).toBe(86)
    })
    it("scores a single word in the title 85", () => {
        expect(showSearchFilter("grace", shows[0])).toBe(85)
    })
    it("scores words split between title and content 55-78", () => {
        h.textCache._set({ aida: "the anointing is here today" })
        const score = showSearchFilter("anointing here", { id: "aida", name: "The Anointing - AIDA" } as any)
        expect(score).toBeGreaterThanOrEqual(55)
        expect(score).toBeLessThanOrEqual(78)
    })
    it("scores content-only matches 35-60 (at or above the create-hint threshold)", () => {
        h.textCache._set({ great: "thou my everlasting portion more than friend or life to me" })
        const score = showSearchFilter("everlasting portion", shows[2])
        expect(score).toBe(53) // 35 + full adjacency 10 + decayed phrase bonus 4 + decayed word bonus 3.5 = 52.5 -> 53
        expect(score).toBeGreaterThanOrEqual(35)
        expect(score).toBeLessThanOrEqual(60)
    })
    it("applies exponential decay diminishing returns to repeated lyric matches", () => {
        h.textCache._set({
            once: "amazing grace how sweet the sound",
            twice: "amazing grace how sweet the sound, amazing grace",
            thrice: "amazing grace how sweet the sound, amazing grace, amazing grace"
        })
        const score1 = showSearchFilter("amazing grace", { id: "once", name: "Song A" } as any)
        const score2 = showSearchFilter("amazing grace", { id: "twice", name: "Song B" } as any)
        const score3 = showSearchFilter("amazing grace", { id: "thrice", name: "Song C" } as any)

        expect(score1).toBeGreaterThanOrEqual(35)
        expect(score2).toBeGreaterThan(score1)
        expect(score3).toBeGreaterThan(score2)
        // Check diminishing returns: difference from 1->2 is larger than or equal to 2->3
        expect(score2 - score1).toBeGreaterThanOrEqual(score3 - score2)
        expect(score3).toBeLessThanOrEqual(60)
    })
    it("keeps absolute scores in showSearch results (no renormalizing to the top hit)", () => {
        const res = showSearch("grace", shows)
        expect(res[0].id).toBe("gracealone") // starts with "Grace" -> 92
        expect(res[0].match).toBe(92)
        expect(res.find((r) => r.id === "amazing")?.match).toBe(85) // absolute, not scaled up
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
        expect(res[0].match).toBe(89)
        expect(res[1].match).toBeLessThan(89)
    })
    it("does not flood results with unrelated shows (fuzzy similarity alone never matches)", () => {
        // regression: similarity() is non-zero for unrelated text; it must not include non-matching shows
        const res = showSearch("kitchen", shows)
        expect(res.length).toBe(0)
    })
    it("still matches a close typo via fuzzy title similarity", () => {
        const res = showSearch("amzinggrace", shows)
        expect(res[0]?.id).toBe("amazing")
        expect(res[0]?.match).toBeGreaterThanOrEqual(65) // typo band 65-85
        expect(res[0]?.match).toBeLessThanOrEqual(85)
    })
    it("matches single-word transposed typo such as 'Haelujah' for 'Hallelujah'", () => {
        const res = showSearch("Haelujah", [{ id: "hallelujah", name: "Hallelujah" }] as any)
        expect(res[0]?.id).toBe("hallelujah")
        expect(res[0]?.match).toBeGreaterThanOrEqual(65)
    })
    it("matches multi-word typo queries against longer show titles", () => {
        const res = showSearch("amzing grace", [{ id: "song", name: "Amazing Grace How Sweet" }] as any)
        expect(res[0]?.id).toBe("song")
        expect(res[0]?.match).toBeGreaterThanOrEqual(65)
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
