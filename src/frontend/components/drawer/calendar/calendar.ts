import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../../../types/Show"
import { ShowObj } from "../../../classes/Show"
import { createCategory } from "../../../converters/importHelpers"
import { events, activeDays, calendarAddShow, dictionary, showsCache } from "../../../stores"
import { getItemText } from "../../edit/scripts/textStyle"
import { clone, removeDuplicates, sortByTime } from "../../helpers/array"
import { loadShows } from "../../helpers/setShow"
import { checkName } from "../../helpers/show"
import { _show } from "../../helpers/shows"

export const MILLISECONDS_IN_A_DAY = 86400000

export const copyDate = (date: Date, add = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + add)
export const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const isBetween = (from: Date, to: Date, date: Date) => date >= copyDate(from) && date <= copyDate(to)
export const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()
const getMonthIndex = (month: number) => (month + 1 > 12 ? month + 1 : 0)

export const getDateString = (date: Date) => {
    const d = ("0" + date.getDate()).slice(-2)
    const m = ("0" + (date.getMonth() + 1)).slice(-2)
    const y = date.getFullYear().toString().slice(-2)
    return d + "." + m + "." + y
}

export function getTime(date: Date) {
    const h = ("0" + date.getHours()).slice(-2)
    const m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
}

export function sortDays(selectedDays: number[]) {
    const sortedDays = selectedDays.sort((a, b) => a - b)
    const from = new Date(sortedDays[0])
    const to = new Date(sortedDays[sortedDays.length - 1])
    return { sortedDays, from, to }
}

export async function createSlides(currentEvents: any[], showId = "") {
    const slides: any = {}
    const layouts: any[] = []

    // TODO: use template
    const itemStyle = "left:100px;top:120px;width:1770px;height:840px;"
    const titleStyle = "font-weight: bold;line-height:1.5em;"
    const timeStyle = "font-weight: bold;font-size:60px;font-family:Arial;"
    const nameStyle = "font-size:80px;"
    const locationStyle = "font-size:70px;font-style:italic;"
    const notesStyle = "font-size:60px;"

    currentEvents.forEach(createEventSlide)
    function createEventSlide(day: any) {
        const id = uid()
        let textDay = new Date(day.date).getDate() + ". " + get(dictionary).month?.[new Date(day.date).getMonth() + 1]
        let group: string = textDay

        const from = new Date(day.events[0].from)
        const to = new Date(day.events[0].to)
        day.events[0].from = from
        day.events[0].to = to

        const isOverMultipleDays = !isSameDay(from, to)
        if (isOverMultipleDays) {
            textDay = getEventStringOverMultipleDays(textDay, [day.date, from, to])
            group = textDay
        } else {
            const dayString = getDayNameIfCloseToToday(day.date)
            if (dayString) textDay = dayString
        }

        const oneEventOrSameColor = day.events.length === 1 || removeDuplicates(day.events.map((a: any) => a.color)).length === 1
        const color: any = oneEventOrSameColor ? day.events[0].color : null

        let textLength = 0
        const values: any[][] = [[{ value: textDay, style: titleStyle }]]

        day.events = day.events.sort((a: any, b: any) => a.from - b.from)
        day.events.forEach((event: any) => {
            if (!event.name) return

            const v: any[] = []

            if (event.time)
                v.push({
                    value: `${getTime(new Date(event.from))} `,
                    style: timeStyle,
                })
            v.push({ value: event.name, style: nameStyle })
            if (event.location) v.push({ value: ` - ${event.location}`, style: locationStyle })

            if (event.notes) v[v.length - 1].value += ":"
            values.push(v)
            if (event.notes)
                values.push([
                    {
                        value: `&nbsp;&nbsp;&nbsp;&nbsp;${event.notes}`,
                        style: notesStyle,
                    },
                ])

            textLength += event.name.length / 1.5 + (event.notes?.length || 0) / 5
        })

        const lines: any[] = values.map((a) => ({
            align: "text-align:left;",
            text: a,
        }))
        const items: any[] = [{ style: itemStyle, align: "", lines }]

        // TODO: split in half if lines.length > 8
        slides[id] = { group, color, settings: {}, notes: "", items }

        const l: any = { id }
        if (currentEvents.length > 1) l.nextTimer = getToNextDuration(textLength)
        layouts.push(l)
    }

    // add custom show slides
    let showMedia: any = {}
    const includeShowId: string = _show(showId).get("reference")?.data?.show || get(calendarAddShow) || ""
    if (includeShowId) await addCustomShowSlides()
    async function addCustomShowSlides() {
        await loadShows([includeShowId])
        const show = get(showsCache)[includeShowId]
        if (!show) return

        const _calendarShow = clone(_show(includeShowId).get())
        const showLayoutRef = clone(_show(includeShowId).layouts("active").ref()[0])
        const showSlides = _calendarShow.slides
        showMedia = _calendarShow.media || {}

        showLayoutRef.forEach(addSlidesAndTimers)
        function addSlidesAndTimers(layoutRef) {
            const id = layoutRef.id
            if (!showSlides[id]) return
            if (!slides[id]) slides[id] = showSlides[id]

            const layout = layoutRef.data || {}
            delete layout.end

            if (!layout.nextTimer) {
                const totalTextLength = slides[id].items.reduce((value, item) => (value += getItemText(item).length), 0) / 2
                if (layout.background && !totalTextLength) layout.nextTimer = 10
                else layout.nextTimer = getToNextDuration(totalTextLength)
            }

            const isParent = layoutRef.type === "parent"
            if (isParent) {
                layouts.push(layout)
                return
            }

            if (!layouts[layouts.length - 1].children) layouts[layouts.length - 1].children = {}
            if (!layouts[layouts.length - 1].children[id]) layouts[layouts.length - 1].children[id] = {}
            layouts[layouts.length - 1].children[id] = layout
        }
    }

    if (currentEvents.length > 1) setLoopToStart()
    function setLoopToStart() {
        const lastParent = layouts[layouts.length - 1]
        const parentChildren = slides[lastParent.id].children

        if (!parentChildren?.length) {
            layouts[layouts.length - 1].end = true
            return
        }

        const lastChild = parentChildren[parentChildren.length - 1]
        if (!lastParent.children) lastParent.children = {}
        if (!lastParent.children[lastChild]) lastParent.children[lastChild] = {}
        lastParent.children[lastChild].end = true
    }

    createCategory("events", "event", { isDefault: true, isArchive: true })

    const layoutId = _show(showId).get("settings.activeLayout") || "default"
    const show: Show = clone(_show(showId).get() || new ShowObj(false, "events", layoutId, new Date().getTime(), false))

    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: get(dictionary).example?.default || "",
            notes: "",
            slides: layouts,
        },
    }
    show.media = showMedia

    if (showId) return { show }

    show.name = createCalendarShowName()
    show.reference = { type: "calendar", data: { days: get(activeDays) } }
    if (get(calendarAddShow)) show.reference.data.show = get(calendarAddShow)

    return { show }
}

function getEventStringOverMultipleDays(textDay, [day, from, to]: Date[]): string {
    const startAndEndSameYear = from.getFullYear() === to.getFullYear()
    const startAndEndSameMonth = from.getMonth() === to.getMonth()

    if (startAndEndSameMonth && startAndEndSameYear) return `${new Date(day).getDate()}.-${to.getDate()}. ${get(dictionary).month?.[to.getMonth() + 1]}`

    if (!startAndEndSameYear) textDay += " " + from.getFullYear()
    textDay += ` - ${to.getDate()}. ${get(dictionary).month?.[to.getMonth() + 1]}`
    if (!startAndEndSameYear) textDay += " " + to.getFullYear()

    return textDay
}

function getDayNameIfCloseToToday(day: Date): string {
    const today = new Date()
    const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const daysUntilEvent = Math.floor((new Date(day).getTime() - todayWithoutTime.getTime()) / MILLISECONDS_IN_A_DAY)

    if (daysUntilEvent === 0) return get(dictionary).calendar?.today || ""
    if (daysUntilEvent === 1) return get(dictionary).calendar?.tomorrow || ""
    if (daysUntilEvent < 7 && daysUntilEvent > 0) {
        const weekDay = new Date(day).getDay() || 7
        const dayString = get(dictionary).weekday?.[weekDay] || ""

        return dayString[0].toUpperCase() + dayString.slice(1, dayString.length)
    }

    return ""
}

function createCalendarShowName() {
    let name = ""
    const { sortedDays, from, to } = sortDays(get(activeDays))

    name = getDateString(from)
    if (sortedDays[0] - sortedDays[1] < 0) name += " - " + getDateString(to)

    return checkName(name)
}

function getToNextDuration(textLength: number) {
    const duration: number = getDurationFromTextLength()

    return Math.min(20, Math.floor(duration))

    function getDurationFromTextLength() {
        if (textLength < 25) return Math.max(5, textLength * 0.5)
        if (textLength < 80) return Math.max(10, textLength * 0.3)
        return Math.max(25, textLength * 0.2)
    }
}

export function getSelectedEvents(selectedDays: number[] = get(activeDays)) {
    let currentEvents: any[] = []
    let tempEvents: any[] = []

    if (!selectedDays.length) return []

    selectedDays.forEach((day: number) => {
        tempEvents.push({ date: day, events: [] })
        const thisDay = new Date(day)

        Object.entries(get(events)).forEach(([id, a]) => {
            const startingAtSameDate = isSameDay(new Date(a.from), copyDate(thisDay))
            if (!startingAtSameDate) return

            const endingAtSameDate = isSameDay(new Date(a.to), copyDate(thisDay))
            if (endingAtSameDate) tempEvents[tempEvents.length - 1].events.push({ id, ...a })
            else tempEvents.push({ date: day, events: [{ id, ...a }] })
        })
    })

    // sort
    tempEvents = tempEvents.map(sortDayAndOnlyKeepNormalEvents).filter((a) => a.events.length)
    function sortDayAndOnlyKeepNormalEvents(events) {
        events.events = events.events.filter((a) => a.type === "event").sort(sortByTime)
        return events
    }

    currentEvents = tempEvents.sort((a, b) => a.date - b.date)
    return currentEvents
}

// HELPERS

// https://stackoverflow.com/a/6117889
export function getWeekNumber(d: Date) {
    d = copyDate(d)
    d.setDate(getNearestThurday())

    const firstDayInYear = new Date(d.getFullYear(), 0, 1)
    const daysPassedCurrentYear = (d.getTime() - firstDayInYear.getTime()) / MILLISECONDS_IN_A_DAY + 1
    const weekNumber = Math.ceil(daysPassedCurrentYear / 7)

    return weekNumber

    // ISO 8601 states that week 1 is the week with the first Thursday of that year
    function getNearestThurday() {
        const todaysWeekday = d.getDay() || 7 // change Sunday to 7
        const nearestThursday = d.getDate() + 4 - todaysWeekday
        return nearestThursday
    }
}
