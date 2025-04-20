import { get } from "svelte/store"
import type { Time } from "../../../types/Main"
import { dictionary } from "../../stores"

export function secondsToTime(seconds: number): Time {
    // turn to positive (timers have custom negative placed before)
    seconds = Math.abs(seconds)

    let d: any = Math.floor(seconds / (3600 * 24))
    let h: any = Math.floor(seconds / 3600 - d * 24)
    let m: any = Math.floor((seconds - d * 3600 * 24 - h * 3600) / 60)
    let s: any = Math.floor(seconds - d * 3600 * 24 - h * 3600 - m * 60)
    // TODO: ms
    // let ms: any = Math.round(seconds - h * 3600 - m * 60 - s * 60)
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

export function joinTimeBig(time: number, showHours: boolean = true) {
    let allTimes: any = secondsToTime(time)

    let days = allTimes.d === 0 ? "" : allTimes.d + ", "
    let hours = showHours ? (allTimes.h === "00" ? "" : allTimes.h) : ""
    let minutes = padString(Number(allTimes.m) + (showHours ? 0 : Number(allTimes.h) * 60))
    let timeValue = days + [hours, minutes, allTimes.s].join(":")
    while (timeValue[0] === ":") timeValue = timeValue.slice(1, timeValue.length)

    timeValue = timeValue.replace(" :", " ")

    return timeValue
}

export function dateToString(date: string | number | Date, full: boolean = false, d: any = {}): string {
    if (!date) return ""

    date = new Date(date)
    let year: any = date.getFullYear()
    let month: any = date.getMonth() + 1
    let day: any = date.getDate()

    let string: string = ""
    if (full) {
        let weekday = getWeekday(date.getDay(), d, true)
        month = getMonthName(date.getMonth(), d)

        // Monday 6. February, 2021
        string = weekday + " " + day + ". " + month + ", " + year
    } else {
        if (month < 10) month = "0" + month
        if (day < 10) day = "0" + day
        year = year.toString().slice(-2)
        string = [day, month, year].join(".")
    }

    // TODO: get format (DD.MM.YY) | YYYY-MM-DD | MM/DD/YYYY
    return string
}

export function getWeekday(day: number, d = get(dictionary), uppercase: boolean = false) {
    let weekday = d.weekday ? d.weekday[day === 0 ? 7 : day] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
    if (uppercase) weekday = weekday[0].toUpperCase() + weekday.slice(1, weekday.length)

    return weekday
}

export function getMonthName(month: number, d = get(dictionary), uppercase: boolean = false) {
    // this might be upper or lower case depending on the language
    let monthname = d.month ? d.month[month + 1] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]
    if (uppercase) monthname = monthname[0].toUpperCase() + monthname.slice(1, monthname.length)

    return monthname
}

export function getDateAndTimeString(time: number) {
    let date = splitDate(new Date(time))
    return dateToString(time) + " " + addZero(date.hours) + ":" + addZero(date.minutes)
}

export function secondsToTimes(time: number) {
    // let hours: number = Math.floor((time / (1000 * 60 * 60)) % 24);
    // let minutes: number = Math.floor((time / 1000 / 60) % 60);
    // let seconds: number = Math.floor((time / 1000) % 60);
    let hours: number = Math.floor((time / (60 * 60)) % 24)
    let minutes: number = Math.floor((time / 60) % 60)
    let seconds: number = Math.floor(time % 60)

    return { hours, minutes, seconds }
}

export function format(t: string, { hours, minutes, seconds }: any) {
    if (t === "HH") return addZero(hours)
    if (t === "MM") return addZero(minutes)
    if (t === "SS") return addZero(seconds)
    return ""
}

export const padString = (a: number) => a.toString().padStart(2, "0")
export const addZero = (a: number) => ("0" + a).slice(-2)
// const clip = (a: number) => Math.max(0, Math.min(59, a))

export function splitDate(time: Date) {
    let date = time.getDate()
    let month = time.getMonth()
    let year = time.getFullYear()
    let hours = time.getHours()
    let minutes = time.getMinutes()

    return { date, month, year, hours, minutes }
}

export function changeTime(date: string | Date, time: string | Date) {
    date = new Date(date)
    time = new Date(time)
    let splittedDate = splitDate(date)
    let splittedTime = splitDate(time)

    return new Date(splittedDate.year, splittedDate.month, splittedDate.date, splittedTime.hours, splittedTime.minutes)
}

export function combineDateAndTime(date: string | Date, time: string) {
    date = new Date(date)
    let splittedDate = splitDate(date)
    let splittedTime = { hours: Number(time.slice(0, 2)), minutes: Number(time.slice(3, 5)) }

    return new Date(splittedDate.year, splittedDate.month, splittedDate.date, splittedTime.hours, splittedTime.minutes)
}

const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
]

export function timeAgo(time: number) {
    if (!time) return ""
    const seconds = Math.floor((Date.now() - time) / 1000)
    const interval: any = intervals.find((i) => i.seconds < seconds)
    if (!interval) return "just now"
    const count = Math.floor(seconds / interval.seconds)
    return `${count} ${interval.label}${count !== 1 ? "s" : ""} ago`
}

export function getTimeFromInterval(interval: string) {
    if (interval === "daily") return 86400000
    if (interval === "weekly") return 604800000
    if (interval === "mothly") return 2592000000
    return 0
}
