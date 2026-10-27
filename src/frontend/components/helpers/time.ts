import { get } from "svelte/store"
import type { Time } from "../../../types/Main"
import { dictionary, language } from "../../stores"

export function secondsToTime(seconds: number): Time {
    // turn to positive (timers have custom negative placed before)
    if (!Number.isFinite(seconds) || isNaN(seconds)) {
        seconds = 0
    } else {
        seconds = Math.abs(seconds)
    }

    const d: number = Math.floor(seconds / (3600 * 24))
    const h: number = Math.floor(seconds / 3600 - d * 24)
    const m: number = Math.floor((seconds - d * 3600 * 24 - h * 3600) / 60)
    const s: number = Math.floor(seconds - d * 3600 * 24 - h * 3600 - m * 60)
    // TODO: ms
    // let ms: number = Math.round(seconds - h * 3600 - m * 60 - s * 60)
    const ms = 9

    return { ms: padString(ms), s: padString(s), m: padString(m), h: padString(h), d }
}

export function joinTime(time: Time, ms = false): string {
    const arr: string[] = [time.m, time.s]
    if (Number(time.h)) arr.unshift(time.h)
    if (ms) arr.push(time.ms)
    return arr.join(":")
}

export function joinTimeBig(time: number, showHours = true, padding = true) {
    const allTimes = secondsToTime(time)

    const days = allTimes.d ? allTimes.d + ", " : ""
    const h = showHours && Number(allTimes.h) ? (padding ? allTimes.h : Number(allTimes.h).toString()) : ""

    const mins = Number(allTimes.m) + (showHours ? 0 : Number(allTimes.h) * 60)
    const m = h || padding ? padString(mins) : mins.toString()

    return (days + [h, m, allTimes.s].filter(Boolean).join(":")).replace(" :", " ")
}

export function dateToString(date: string | number | Date, short = false): string {
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
        const weekday = getWeekday(date.getDay(), get(dictionary), true)
        const monthName = getMonthName(date.getMonth(), get(dictionary), true)
        return weekday + " " + String(date.getDate()) + ". " + String(monthName) + ", " + String(date.getFullYear())
    }
}

export function getWeekday(day: number, d = get(dictionary), uppercase = false, locale?: string) {
    const dIndex = day === 7 || day === 0 ? 0 : day
    const loc = (locale || get(language) || "").replace("_", "-") || undefined
    let weekday = ""
    try {
        weekday = new Date(2000, 0, 2 + dIndex).toLocaleDateString(loc, { weekday: "long" })
    } catch {
        weekday = d.weekday ? d.weekday[day === 0 ? 7 : day] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dIndex]
    }
    if (!weekday?.length) return ""
    if (uppercase) weekday = weekday[0].toUpperCase() + weekday.slice(1)

    return weekday
}

export function getMonthName(month: number, d = get(dictionary), uppercase = false, locale?: string) {
    const mIndex = month >= 1 && month <= 12 ? month - 1 : month
    const loc = (locale || get(language) || "").replace("_", "-") || undefined
    let monthname = ""
    try {
        monthname = new Date(2000, mIndex, 1).toLocaleDateString(loc, { month: "long" })
    } catch {
        monthname = d.month ? d.month[mIndex + 1] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][mIndex]
    }
    if (!monthname?.length) return ""
    if (uppercase) monthname = monthname[0].toUpperCase() + monthname.slice(1)

    return monthname
}

export function getDateAndTimeString(time: number) {
    if (!time) return ""
    const date = new Date(time)
    try {
        return date.toLocaleDateString(undefined) + " " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    } catch {
        const d = splitDate(date)
        return [addZero(d.date), addZero(d.month + 1), d.year.toString().slice(-2)].join(".") + " " + addZero(d.hours) + ":" + addZero(d.minutes)
    }
}

export const padString = (a: number) => (Number.isFinite(a) ? a.toString().padStart(2, "0") : "00")
export const addZero = (a: number) => (Number.isFinite(a) ? ("0" + String(a)).slice(-2) : "00")
// const clip = (a: number) => Math.max(0, Math.min(59, a))

export function splitDate(time: Date) {
    const date = time.getDate()
    const month = time.getMonth()
    const year = time.getFullYear()
    const hours = time.getHours()
    const minutes = time.getMinutes()

    return { date, month, year, hours, minutes }
}

export function changeTime(date: string | Date, time: string | Date) {
    date = new Date(date)
    time = new Date(time)
    const splittedDate = splitDate(date)
    const splittedTime = splitDate(time)

    return new Date(splittedDate.year, splittedDate.month, splittedDate.date, splittedTime.hours, splittedTime.minutes)
}

export function combineDateAndTime(date: string | Date, time: string) {
    date = new Date(date)
    if (typeof time !== "string") return date

    const splittedDate = splitDate(date)
    const splittedTime = { hours: Number(time.slice(0, 2)), minutes: Number(time.slice(3, 5)) }

    return new Date(splittedDate.year, splittedDate.month, splittedDate.date, splittedTime.hours, splittedTime.minutes)
}

const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 }
]

export function timeAgo(time: number, locale = undefined) {
    if (!time) return ""
    const diffSec = Math.round((time - Date.now()) / 1000)
    const absSec = Math.abs(diffSec)

    if (absSec < 10) return "just now"

    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" })
        if (absSec < 60) return rtf.format(diffSec, "second")
        const diffMin = Math.round(diffSec / 60)
        if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
        const diffHours = Math.round(diffSec / 3600)
        if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour")
        const diffDays = Math.round(diffSec / 86400)
        if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day")
        const diffMonths = Math.round(diffSec / (86400 * 30))
        if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month")
        const diffYears = Math.round(diffSec / (86400 * 365))
        return rtf.format(diffYears, "year")
    } catch {
        const seconds = Math.floor((Date.now() - time) / 1000)
        const interval: any = intervals.find((i) => i.seconds < seconds)
        if (!interval) return "just now"
        const count = Math.floor(seconds / interval.seconds)
        return `${count} ${interval.label}${count !== 1 ? "s" : ""} ago`
    }
}

export function getTimeFromInterval(interval) {
    if (interval === "daily") return 86400000
    if (interval === "weekly") return 604800000
    if (interval === "mothly") return 2592000000
    return 0
}
