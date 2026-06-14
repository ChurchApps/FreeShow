import { describe, it, expect } from "vitest"
import { addZero, changeTime, combineDateAndTime, getMonthName, getTimeFromInterval, getWeekday, joinTime, joinTimeBig, padString, secondsToTime, splitDate, timeAgo } from "./time"

describe("time helpers", () => {
    describe("secondsToTime", () => {
        it("splits seconds into padded d/h/m/s", () => {
            expect(secondsToTime(0)).toEqual({ ms: "09", s: "00", m: "00", h: "00", d: 0 })
            expect(secondsToTime(65)).toEqual({ ms: "09", s: "05", m: "01", h: "00", d: 0 })
            expect(secondsToTime(3661)).toEqual({ ms: "09", s: "01", m: "01", h: "01", d: 0 })
            expect(secondsToTime(90000)).toEqual({ ms: "09", s: "00", m: "00", h: "01", d: 1 })
        })
        it("treats negative input as positive", () => {
            expect(secondsToTime(-65)).toEqual(secondsToTime(65))
        })
    })

    describe("joinTime", () => {
        it("joins m:s, adding hours only when non-zero", () => {
            expect(joinTime(secondsToTime(65))).toBe("01:05")
            expect(joinTime(secondsToTime(3661))).toBe("01:01:01")
        })
        it("can append milliseconds", () => {
            expect(joinTime(secondsToTime(65), true)).toBe("01:05:09")
        })
    })

    describe("joinTimeBig", () => {
        it("formats with hours", () => {
            expect(joinTimeBig(65)).toBe("01:05")
            expect(joinTimeBig(3661)).toBe("01:01:01")
        })
        it("folds hours into minutes when showHours is false", () => {
            expect(joinTimeBig(3661, false)).toBe("61:01")
        })
    })

    describe("padString / addZero", () => {
        it("pads numbers to two digits", () => {
            expect(padString(5)).toBe("05")
            expect(padString(12)).toBe("12")
        })
        it("addZero keeps the last two digits", () => {
            expect(addZero(5)).toBe("05")
            expect(addZero(123)).toBe("23")
        })
    })

    describe("splitDate", () => {
        it("breaks a Date into its parts", () => {
            expect(splitDate(new Date(2021, 1, 6, 14, 30))).toEqual({ date: 6, month: 1, year: 2021, hours: 14, minutes: 30 })
        })
    })

    describe("combineDateAndTime / changeTime", () => {
        it("combines a date with a HH:MM string", () => {
            const d = combineDateAndTime(new Date(2021, 1, 6), "14:30")
            expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2021, 1, 6, 14, 30])
        })
        it("changeTime takes the date from the first arg and the time from the second", () => {
            const d = changeTime(new Date(2021, 1, 6, 8, 0), new Date(2000, 0, 1, 14, 30))
            expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2021, 1, 6, 14, 30])
        })
    })

    describe("getWeekday / getMonthName", () => {
        it("falls back to English names when the dictionary has no entry", () => {
            expect(getWeekday(0, {} as any)).toBe("Sunday")
            expect(getWeekday(1, {} as any)).toBe("Monday")
            expect(getMonthName(0, {} as any)).toBe("January")
            expect(getMonthName(11, {} as any)).toBe("December")
        })
        it("uses the provided dictionary when present", () => {
            const dict = { weekday: ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] } as any
            expect(getWeekday(1, dict)).toBe("Lundi")
        })
    })

    describe("timeAgo", () => {
        it("returns '' for falsy input", () => {
            expect(timeAgo(0)).toBe("")
        })
        it("formats relative time with pluralization", () => {
            expect(timeAgo(Date.now() - 5000)).toBe("5 seconds ago")
            expect(timeAgo(Date.now() - 90000)).toBe("1 minute ago")
        })
    })

    describe("getTimeFromInterval", () => {
        it("maps interval names to milliseconds", () => {
            expect(getTimeFromInterval("daily")).toBe(86400000)
            expect(getTimeFromInterval("weekly")).toBe(604800000)
            expect(getTimeFromInterval("mothly")).toBe(2592000000)
            expect(getTimeFromInterval("nope")).toBe(0)
        })
    })
})
