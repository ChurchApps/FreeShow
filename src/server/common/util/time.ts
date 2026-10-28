import { get } from "svelte/store"
import type { Time } from "../../../types/Main"
import type { Timer } from "../../../types/Show"
import { activeTimers, events } from "../../stage/util/stores"

export const padString = (a: number) => a.toString().padStart(2, "0")

export function secondsToTime(seconds: number): Time {
    // turn to positive (timers have custom negative placed before)
    seconds = Math.abs(seconds)

    let d: any = Math.floor(seconds / (3600 * 24))
    let h: any = Math.floor(seconds / 3600 - d * 24)
    let m: any = Math.floor((seconds - d * 3600 * 24 - h * 3600) / 60)
    let s: any = Math.round(seconds - d * 3600 * 24 - h * 3600 - m * 60)
    let ms: any = 0

    if (h < 10) h = "0" + h
    if (m < 10) m = "0" + m
    if (s < 10) s = "0" + s
    if (ms < 10) ms = "0" + ms

    return { ms, s, m, h, d }
}

export function joinTime(time: Time, ms: boolean = false): string {
    let arr: string[] = [time.m, time.s]
    if (Number(time.h)) arr.unshift(time.h)
    if (ms) arr.push(time.ms)
    return arr.join(":")
}

export function joinTimeBig(time: number, showHours: boolean = true, padding: boolean = true) {
    let allTimes: any = secondsToTime(time)

    let days = allTimes.d ? allTimes.d + ", " : ""
    let h = showHours && Number(allTimes.h) ? (padding ? allTimes.h : Number(allTimes.h).toString()) : ""

    let mins = Number(allTimes.m) + (showHours ? 0 : Number(allTimes.h) * 60)
    let m = h || padding ? padString(mins) : mins.toString()

    return (days + [h, m, allTimes.s].filter(Boolean).join(":")).replace(" :", " ")
}

export function dateToString(date: string | number | Date, short: boolean = false): string {
    if (!date) return ""
    date = new Date(date)

    if (short) {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
        const diffDays = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24))

        if (diffDays >= 0 && diffDays <= 7) {
            if (diffDays === 0) {
                try {
                    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
                    const res = rtf.format(0, "day")
                    return res.charAt(0).toUpperCase() + res.slice(1)
                } catch {
                    return "Today"
                }
            }
            if (diffDays < 7) {
                try {
                    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" })
                    const res = rtf.format(-diffDays, "day")
                    return res.charAt(0).toUpperCase() + res.slice(1)
                } catch {
                    return `${diffDays} days ago`
                }
            }
            if (diffDays === 7) {
                try {
                    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" })
                    const res = rtf.format(-1, "week")
                    return res.charAt(0).toUpperCase() + res.slice(1)
                } catch {
                    return "1 week ago"
                }
            }
        }

        try {
            const parts = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).formatToParts(date)
            const fullParts = new Intl.DateTimeFormat(undefined, { month: "long" }).formatToParts(date)
            const fullMonth = fullParts.find((p) => p.type === "month")?.value
            if (fullMonth && fullMonth.length <= 4) {
                const mPart = parts.find((p) => p.type === "month")
                if (mPart) mPart.value = fullMonth
            }
            return parts.map((p) => p.value).join("")
        } catch {
            return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
        }
    }

    try {
        const str = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
        let d: any = {}
        // TODO: get dictionary...
        let monthName = d.month ? d.month[date.getMonth()] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()]
        let weekday = d.weekday ? d.weekday[date.getDay()] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]
        // Monday 6. February, 2021
        return weekday + " " + date.getDate() + ". " + monthName + ", " + date.getFullYear()
    }
}

// TIMER

export function getCurrentTimerValue(timer: Timer, ref: any, today: Date, updater = get(activeTimers)) {
    let currentTime: number = 0

    if (timer.type === "counter" || timer.type === "pco_live") {
        currentTime = updater.filter((a) => a.id === ref.id)[0]?.currentTime
        if (typeof currentTime !== "number") currentTime = timer.type === "pco_live" ? 0 : timer.start!
    } else if (timer.type === "clock") {
        let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
        currentTime = (todayTime.getTime() - today.getTime()) / 1000
    } else if (timer.type === "event") {
        let eventTime = new Date(get(events)[timer.event!]?.from)?.getTime() || 0
        currentTime = (eventTime - today.getTime()) / 1000
    }

    if (currentTime < 0 && !timer.overflow) currentTime = 0

    return currentTime
}
