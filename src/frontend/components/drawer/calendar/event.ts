import { get } from "svelte/store"
import { uid } from "uid"
import type { Event } from "../../../../types/Calendar"
import { events } from "../../../stores"
import { translateText } from "../../../utils/language"
import { actionData } from "../../actions/actionData"
import { clone } from "../../helpers/array"
import { history } from "../../helpers/history"

function getOrdinalWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: string): number {
    const dates: number[] = []
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d)
        if (date.getDay() === weekday) {
            dates.push(d)
        }
    }
    if (ordinal === "1st") return dates[0]
    if (ordinal === "2nd") return dates[1]
    if (ordinal === "3rd") return dates[2]
    if (ordinal === "4th") return dates[3]
    if (ordinal === "last") return dates[dates.length - 1]
    return dates[0]
}

export function createRepeatedEvents(event: Event, onlyMissing = false, skipDates: string[] = []) {
    // <!-- REPEAT EVERY: {1-10000}, {day, week, month, year} -->
    // <!-- REPEAT ON: {MO,TH,WE,TH,FR,SA,SU} (if "week") -->
    // <!-- ENDING: {date, after {10} times, never} -->

    const data = event.repeatData!
    const dates: string[][] = []

    let currentFromDate = new Date(event.from)
    let currentToDate = new Date(event.to)
    let endingDate = new Date(data.endingDate || "")
    endingDate = setDate(currentFromDate, { date: endingDate.getDate(), month: endingDate.getMonth(), year: endingDate.getFullYear() })

    const isCalendarRepeat = ["1st", "2nd", "3rd", "4th", "last"].includes(data.type)
    const originalFromDate = new Date(event.from)
    const originalToDate = new Date(event.to)
    const originalFromDay = originalFromDate.getDate()
    const originalToDay = originalToDate.getDate()
    const durationMs = originalToDate.getTime() - originalFromDate.getTime()
    const weekday = originalFromDate.getDay()

    const increment = {
        day: () => {
            currentFromDate.setDate(currentFromDate.getDate() + Number(data.count))
            currentToDate.setDate(currentToDate.getDate() + Number(data.count))
        },
        week: () => {
            currentFromDate.setDate(currentFromDate.getDate() + 7 * Number(data.count))
            currentToDate.setDate(currentToDate.getDate() + 7 * Number(data.count))
        },
        month: () => {
            const count = Number(data.count)
            const fromTotalMonths = currentFromDate.getFullYear() * 12 + currentFromDate.getMonth() + count
            const toTotalMonths = currentToDate.getFullYear() * 12 + currentToDate.getMonth() + count
            currentFromDate = setDate(currentFromDate, { year: Math.floor(fromTotalMonths / 12), month: fromTotalMonths % 12, date: originalFromDay })
            currentToDate = setDate(currentToDate, { year: Math.floor(toTotalMonths / 12), month: toTotalMonths % 12, date: originalToDay })
        },
        year: () => {
            const count = Number(data.count)
            currentFromDate = setDate(currentFromDate, { year: currentFromDate.getFullYear() + count, date: originalFromDay })
            currentToDate = setDate(currentToDate, { year: currentToDate.getFullYear() + count, date: originalToDay })
        }
    }

    const advanceDates = () => {
        if (isCalendarRepeat) {
            let targetMonth = currentFromDate.getMonth() + 1
            let targetYear = currentFromDate.getFullYear()
            if (targetMonth > 11) {
                targetYear += Math.floor(targetMonth / 12)
                targetMonth = targetMonth % 12
            }
            const targetDay = getOrdinalWeekdayOfMonth(targetYear, targetMonth, weekday, data.type)
            currentFromDate = setDate(currentFromDate, { year: targetYear, month: targetMonth, date: targetDay })
            currentToDate = new Date(currentFromDate.getTime() + durationMs)
        } else {
            increment[data.type as keyof typeof increment]()
        }
    }

    const getISO = (date: Date) => {
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - offset * 60 * 1000)
        return localDate.toISOString().substring(0, 10)
    }

    // get dates array
    if (data.ending === "date") {
        while (currentFromDate.getTime() <= endingDate.getTime()) {
            advanceDates()

            if (currentFromDate.getTime() <= endingDate.getTime()) {
                const iso = getISO(currentFromDate)
                if (!skipDates.includes(iso)) {
                    dates.push([currentFromDate.toString(), currentToDate.toString()])
                }
            }
        }
    } else if (data.ending === "after") {
        let count = 0
        while (count < data.afterRepeats!) {
            count++
            advanceDates()

            if (count < data.afterRepeats!) {
                const iso = getISO(currentFromDate)
                if (!skipDates.includes(iso)) {
                    dates.push([currentFromDate.toString(), currentToDate.toString()])
                }
            }
        }
    }

    // create events
    const groupId = event.group || event.id || uid()
    event.group = groupId

    let newEvents: any = {}
    if (!onlyMissing) newEvents = { [event.id || event.group || ""]: event }

    dates.forEach((date: string[]) => {
        const newEvent = clone(event)

        delete newEvent.id
        newEvent.from = date[0]
        newEvent.to = date[1]
        newEvent.group = groupId
        if (event.origin) newEvent.origin = event.origin

        // find existing event at this date!
        let exists = false
        if (onlyMissing) {
            Object.values(get(events)).forEach((currentEvent) => {
                if (!currentEvent.group || currentEvent.group !== groupId) return
                if (currentEvent.from !== newEvent.from || currentEvent.to !== newEvent.to) return

                exists = true
            })
        }

        if (exists) return
        newEvents[uid()] = newEvent
    })

    // TODO: remove existing events after last newEvent.from

    if (!Object.keys(newEvents).length) return
    history({ id: "UPDATE", newData: { data: newEvents, keys: Object.keys(newEvents) }, location: { page: "drawer", id: "event" } })
}

export const setDate = (date: Date, options: any): Date => {
    const year = options.year ?? date.getFullYear()
    const month = options.month ?? date.getMonth()
    let day = options.date ?? date.getDate()
    const maxDays = new Date(year, month + 1, 0).getDate()
    if (day > maxDays) day = maxDays
    const newDate = [year, month + 1, day]
    const time = date.getHours() + ":" + date.getMinutes()
    return new Date([...newDate, time].join(" "))
}

export function updateEventData(editEvent: any, stored: any, { type, action }: any): any {
    let data = clone(editEvent)
    const oldData = JSON.parse(stored)
    const id = editEvent.id

    data.from = new Date(editEvent.isoFrom + " " + (editEvent.time ? editEvent.fromTime : ""))
    oldData.from = new Date(oldData.isoFrom + " " + (oldData.time ? oldData.fromTime : ""))
    data.to = new Date(editEvent.isoTo + " " + (editEvent ? editEvent.toTime : ""))
    oldData.to = new Date(oldData.isoTo + " " + (oldData ? oldData.toTime : ""))
    data.type = type
    oldData.type = type

    // to has to be after from
    if (data.to.getTime() - data.from.getTime() <= 0) data.to = data.from

    const keysToRemove = ["id", "isoFrom", "isoTo", "fromTime", "toTime"]
    keysToRemove.forEach((key) => {
        delete data[key]
        delete oldData[key]
    })

    if (data.type === "action") data = getActionEventData(data, action)

    return { data, oldData, id }
}

// action
export function getActionEventData(event: any, action: any) {
    const actionName = translateText(actionData[action.id]?.name)

    event.action = action
    event.name = actionName
    event.color = null
    delete event.location
    delete event.notes

    return event
}
