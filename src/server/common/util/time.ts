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

export function dateToString(date: Date, full: boolean = false): string {
    date = new Date(date)

    let year: any = date.getFullYear()
    let month: any = date.getMonth() + 1
    let day: any = date.getDate()

    let string: string = ""
    if (full) {
        let d: any = {}
        // TODO: get dictionary...
        let weekday = d.weekday ? d.weekday[date.getDay()] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]
        month = d.month ? d.month[date.getMonth()] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()]

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

// TIMER

export function getCurrentTimerValue(timer: Timer, ref: any, today: Date, updater = get(activeTimers)) {
    let currentTime: number = 0

    if (timer.type === "counter") {
        currentTime = updater.filter(a => a.id === ref.id)[0]?.currentTime
        if (typeof currentTime !== "number") currentTime = timer.start!
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
