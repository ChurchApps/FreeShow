import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { activeDays, categories, dictionary, events } from "../../stores"
import { clone } from "../helpers/array"
import { checkName } from "../helpers/show"
import { _show } from "../helpers/shows"

export const copyDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
// const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

export const getDateString = (date: Date) => {
    let d = ("0" + date.getDate()).slice(-2)
    let m = ("0" + (date.getMonth() + 1)).slice(-2)
    let y = date.getFullYear().toString().slice(-2)
    return d + "." + m + "." + y
}

function getTime(date: Date) {
    let h = ("0" + date.getHours()).slice(-2)
    let m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
}

export function sortDays(selectedDays: number[]) {
    let sortedDays = selectedDays.sort((a, b) => a - b)
    let from = new Date(sortedDays[0])
    let to = new Date(sortedDays[sortedDays.length - 1])
    return { sortedDays, from, to }
}

export function createSlides(currentEvents: any[], id: string = "") {
    let slides: any = {}
    let layouts: any[] = []

    currentEvents.forEach((day: any) => {
        let id = uid()
        let textDay = new Date(day.date).getDate() + ". " + get(dictionary).month[new Date(day.date).getMonth() + 1]
        let group: string = textDay
        day.events[0].from = new Date(day.events[0].from)
        day.events[0].to = new Date(day.events[0].to)

        // event over multiple days
        if (!isSameDay(day.events[0].from, day.events[0].to)) {
            if (day.events[0].from.getFullYear() !== day.events[0].to.getFullYear()) textDay += " " + day.events[0].from.getFullYear()
            if (day.events[0].from.getMonth() === day.events[0].to.getMonth() && day.events[0].from.getFullYear() === day.events[0].to.getFullYear()) {
                textDay = new Date(day.date).getDate() + ".-" + day.events[0].to.getDate() + ". " + get(dictionary).month[day.events[0].to.getMonth() + 1]
            } else textDay += " - " + day.events[0].to.getDate() + ". " + get(dictionary).month[day.events[0].to.getMonth() + 1]
            if (day.events[0].from.getFullYear() !== day.events[0].to.getFullYear()) textDay += " " + day.events[0].to.getFullYear()
            group = textDay
        } else {
            // event this week
            const MILLISECONDS_IN_A_DAY = 86400000
            let today = new Date()
            let todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate())
            let daysUntilEvent = Math.floor((new Date(day.date).getTime() - todayWithoutTime.getTime()) / MILLISECONDS_IN_A_DAY)
            if (daysUntilEvent === 0 && get(dictionary).calendar.today) textDay = get(dictionary).calendar.today
            else if (daysUntilEvent === 1 && get(dictionary).calendar.tomorrow) textDay = get(dictionary).calendar.tomorrow
            else if (daysUntilEvent < 7 && daysUntilEvent > 0 && get(dictionary).weekday["1"]) {
                let weekDay = new Date(day.date).getDay()
                if (weekDay === 0) weekDay = 7
                let dayString = get(dictionary).weekday[weekDay]
                dayString = dayString[0].toUpperCase() + dayString.slice(1, dayString.length)
                textDay = dayString
            }
        }
        // only one event or all events have the same color
        let color: any = day.events.length === 1 || [...new Set(day.events.map((a: any) => a.color))].length === 1 ? day.events[0].color : null

        // TODO: event over multiple days!!

        // let duration = 6 + Math.floor(day.events.length * 0.75)
        let totalLength: number = 0

        // TODO: align clocks (another font?)
        let values: any[][] = [[{ value: textDay, style: "font-weight: bold;line-height:1.5em;" }]] // , [{ value: "", style: "font-size:30px;" }]
        day.events
            .sort((a: any, b: any) => a.from - b.from)
            .forEach((event: any) => {
                let v: any[] = []
                if (event.time) {
                    let time = getTime(new Date(event.from))
                    // TODO: event.to (if days are different?)
                    // if (event.to.getTime() - event.from.getTime() > 0) time += " - " + getTime(new Date(event.to))
                    v.push({ value: time + " ", style: "font-weight: bold;font-size:60px;font-family:Arial;" })
                }
                v.push({ value: event.name, style: "font-size:80px;" })
                if (event.location) v.push({ value: " - " + event.location, style: "font-size:70px;font-style:italic;" })
                if (event.notes) v[v.length - 1].value += ":"
                values.push(v)
                if (event.notes) values.push([{ value: "&nbsp;&nbsp;&nbsp;&nbsp;" + event.notes, style: "font-size:60px;" }])
                values.push([{ value: "", style: "font-size:80px;" }])
                totalLength += event.name.length + event.notes.length / 3 // + event.location.length
            })
        let items: any[] = [
            {
                // TODO: use template!!
                style: "left:100px;top:120px;width:1770px;height:840px;",
                align: "",
                lines: values.map((a) => ({ align: "text-align:left;", text: a })),
            },
        ]

        // TODO: split in half if lines.length > 8
        slides[id] = { group, color, settings: {}, notes: "", items }
        let l: any = { id }
        if (currentEvents.length > 1) {
            let duration = totalLength < 25 ? Math.max(5, totalLength * 0.5) : totalLength < 80 ? Math.max(10, totalLength * 0.3) : Math.max(25, totalLength * 0.2)
            l.nextTimer = Math.min(60, Math.floor(duration))
        }
        layouts.push(l)
    })
    if (currentEvents.length > 1) layouts[layouts.length - 1].end = true

    let layoutID = _show(id).get("settings.activeLayout") || "default"

    let show: Show = clone(_show(id).get() || new ShowObj(true, "events", layoutID, new Date().getTime(), false))

    // add events category
    if (!get(categories).events) {
        categories.update((a) => {
            a.events = { name: "category.events", icon: "event", default: true }
            return a
        })
    }

    show.slides = slides
    show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }

    if (!id) {
        // TODO: week?
        let { sortedDays, from, to } = sortDays(get(activeDays))
        show.name = getDateString(from)
        if (sortedDays[0] - sortedDays[1] < 0) show.name += " - " + getDateString(to)
        show.name = checkName(show.name)

        show.reference = { type: "calendar", data: { days: get(activeDays) } }
    }

    return { show }
}

export function getSelectedEvents(selectedDays: number[] = get(activeDays)) {
    let currentEvents: any[] = []
    let temp: any[] = []

    if (!selectedDays.length) return []

    selectedDays.forEach((day: number) => {
        temp.push({ date: day, events: [] })
        let thisDay = new Date(day)
        Object.entries(get(events)).forEach(([id, a]) => {
            if (isSameDay(new Date(a.from), copyDate(thisDay))) {
                if (isSameDay(new Date(a.to), copyDate(thisDay))) temp[temp.length - 1].events.push({ id, ...a })
                else temp.push({ date: day, events: [{ id, ...a }] })
            }
            // if (isBetween(a.from, a.to, copy(thisDay))) temp[temp.length - 1].push({ id, ...a })
        })
        // else temp[temp.length - 1] = temp[temp.length - 1].sort((a: any, b: any) => a.from - b.from)
    })

    // sort
    temp = temp
        .filter((a) => a.events.length)
        .map((a) => {
            a.events = a.events.sort((a: any, b: any) => new Date(a.from).getTime() - new Date(b.from).getTime())
            return a
        })

    currentEvents = temp.sort((a, b) => a.date - b.date)
    return currentEvents
}
