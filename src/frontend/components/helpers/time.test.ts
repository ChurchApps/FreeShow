import { describe, it, expect, vi } from "vitest"

// time.ts imports `dictionary` from ../../stores; that module drags a whole
// dependency graph in. Stub the store so `get(dictionary)` returns an empty dict,
// then pass explicit `d` args below where we care about translated output.
vi.mock("../../stores", () => {
    const makeStore = (initial: unknown) => ({ subscribe: (fn: (v: unknown) => void) => (fn(initial), () => {}) })
    return { dictionary: makeStore({}) }
})

import { addZero, combineDateAndTime, dateToString, getMonthName, getTimeFromInterval, getWeekday, joinTime, joinTimeBig, padString, secondsToTime, splitDate, timeAgo } from "./time"

describe("padString / addZero", () => {
    it("pads a single-digit number to two chars", () => {
        expect(padString(3)).toBe("03")
        expect(addZero(3)).toBe("03")
    })
    it("leaves two-digit numbers alone", () => {
        expect(padString(42)).toBe("42")
    })
})

describe("secondsToTime", () => {
    it("splits an hour + a bit into h/m/s components", () => {
        // 3661 seconds = 1h 1m 1s
        expect(secondsToTime(3661)).toMatchObject({ h: "01", m: "01", s: "01", d: 0 })
    })
    it("splits days off past 24 hours", () => {
        // one full day plus 2 hours
        expect(secondsToTime(86400 + 7200)).toMatchObject({ d: 1, h: "02", m: "00", s: "00" })
    })
    it("takes the absolute value (negative timer countdowns)", () => {
        expect(secondsToTime(-90)).toMatchObject({ m: "01", s: "30" })
    })
})

describe("joinTime / joinTimeBig", () => {
    it("omits the hours component when it's zero", () => {
        // secondsToTime(90) → 00:01:30 → joinTime drops leading 00 hours
        expect(joinTime(secondsToTime(90))).toBe("01:30")
    })
    it("includes hours when present", () => {
        // 3661 = 1h 1m 1s
        expect(joinTime(secondsToTime(3661))).toBe("01:01:01")
    })
    it("joinTimeBig rolls hours into minutes when showHours=false", () => {
        // 3720s = 1h 2m → shown as 62:00 when hours are collapsed
        expect(joinTimeBig(3720, false)).toBe("62:00")
    })
    it("joinTimeBig keeps hours when showHours=true", () => {
        expect(joinTimeBig(3720, true)).toBe("01:02:00")
    })
})

describe("dateToString", () => {
    it("formats a date as DD.MM.YY by default", () => {
        // Jan 5 2023 → "05.01.23"
        expect(dateToString(new Date(2023, 0, 5))).toBe("05.01.23")
    })
    it("returns an empty string for a falsy input", () => {
        expect(dateToString(0 as any)).toBe("")
        expect(dateToString("" as any)).toBe("")
    })
})

describe("getWeekday / getMonthName", () => {
    it("returns the English weekday when the dictionary is empty", () => {
        expect(getWeekday(1, {} as any)).toBe("Monday")
        expect(getWeekday(0, {} as any)).toBe("Sunday")
    })
    it("uppercases the first letter when asked", () => {
        // "monday" from dict → "Monday"; already-uppercased stays the same
        expect(getWeekday(1, { weekday: { 1: "monday" } } as any, true)).toBe("Monday")
    })
    it("returns the English month name when the dictionary is empty", () => {
        expect(getMonthName(0, {} as any)).toBe("January")
        expect(getMonthName(11, {} as any)).toBe("December")
    })
})

describe("splitDate / combineDateAndTime", () => {
    it("splitDate returns the individual fields", () => {
        const d = new Date(2023, 5, 15, 14, 30)
        expect(splitDate(d)).toEqual({ date: 15, month: 5, year: 2023, hours: 14, minutes: 30 })
    })
    it("combineDateAndTime stitches an HH:MM string onto a date", () => {
        const base = new Date(2023, 5, 15, 8, 0)
        const combined = combineDateAndTime(base, "14:45")
        expect(combined.getHours()).toBe(14)
        expect(combined.getMinutes()).toBe(45)
        expect(combined.getDate()).toBe(15)
    })
    it("combineDateAndTime returns the date unchanged when time isn't a string", () => {
        const base = new Date(2023, 5, 15, 8, 0)
        expect(combineDateAndTime(base, undefined as any).getTime()).toBe(base.getTime())
    })
})

describe("timeAgo", () => {
    it("returns 'just now' for a very recent timestamp", () => {
        expect(timeAgo(Date.now() - 100)).toBe("just now")
    })
    it("formats seconds correctly (singular/plural)", () => {
        // note: the "second" interval kicks in strictly ABOVE 1s ago; exactly 1s ago is "just now"
        expect(timeAgo(Date.now() - 2_000)).toBe("2 seconds ago")
        expect(timeAgo(Date.now() - 5_000)).toBe("5 seconds ago")
    })
    it("formats minutes correctly", () => {
        expect(timeAgo(Date.now() - 3 * 60 * 1000)).toBe("3 minutes ago")
    })
    it("returns empty string for falsy time (no timestamp)", () => {
        expect(timeAgo(0)).toBe("")
    })
})

describe("getTimeFromInterval", () => {
    it("returns the millisecond count for each named interval", () => {
        expect(getTimeFromInterval("daily")).toBe(86_400_000)
        expect(getTimeFromInterval("weekly")).toBe(604_800_000)
    })
    it("returns 0 for an unknown interval", () => {
        expect(getTimeFromInterval("hourly" as any)).toBe(0)
    })
})
