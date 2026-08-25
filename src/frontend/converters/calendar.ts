import { get } from "svelte/store"
import { uid } from "uid"
import type { Event } from "../../types/Calendar"
import { getAvailableColor } from "../components/drawer/calendar/calendars"
import { createRepeatedEvents } from "../components/drawer/calendar/event"
import { clone } from "../components/helpers/array"
import { addZero } from "../components/helpers/time"
import { calendars, events } from "../stores"

// https://github.com/adrianlee44/ical2json/blob/main/src/ical2json.ts
const NEW_LINE = /\r\n|\n|\r/
const COLON = ":"
const SPACE = " "

interface IcalObject {
    [key: string]: string | string[] | IcalObject[]
}

interface VEvent {
    CLASS?: string
    CREATED?: string
    DESCRIPTION?: string
    "DTEND;VALUE=DATE"?: string
    "DTEND;TZID=Europe/Oslo"?: string
    DTEND?: string
    RRULE?: string // FREQ=WEEKLY;WKST=MO;UNTIL={DATE};INTERVAL={NUMBER};BYDAY={WEEKDAY}
    EXDATE?: string
    DTSTAMP?: string
    DTSTART?: string
    "DTSTART;VALUE=DATE"?: string
    "LAST-MODIFIED"?: string
    LOCATION?: string
    SEQUENCE?: string
    STATUS?: string
    SUMMARY?: string
    TRANSP?: string
    UID?: string
}

const WEEKDAY_INDEX: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6
}

function shiftDateToWeekdayOnOrAfter(date: Date, weekday: number, useUtc: boolean): Date {
    const shifted = new Date(date)
    const currentWeekday = useUtc ? shifted.getUTCDay() : shifted.getDay()
    const offset = (weekday - currentWeekday + 7) % 7

    if (useUtc) {
        shifted.setUTCDate(shifted.getUTCDate() + offset)
    } else {
        shifted.setDate(shifted.getDate() + offset)
    }

    return shifted
}

function formatIsoDate(date: Date, hasTime: boolean, useUtc: boolean): string {
    const year = useUtc ? date.getUTCFullYear() : date.getFullYear()
    const month = addZero((useUtc ? date.getUTCMonth() : date.getMonth()) + 1)
    const day = addZero(useUtc ? date.getUTCDate() : date.getDate())

    if (!hasTime) {
        return `${year}-${month}-${day}`
    }

    const hours = addZero(useUtc ? date.getUTCHours() : date.getHours())
    const minutes = addZero(useUtc ? date.getUTCMinutes() : date.getMinutes())
    const seconds = addZero(useUtc ? date.getUTCSeconds() : date.getSeconds())

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${useUtc ? "Z" : ""}`
}

function parseIcsDate(dateStr: string): { iso: string; hasTime: boolean } {
    if (!dateStr) return { iso: "", hasTime: false }
    const clean = dateStr.trim()
    if (clean.includes("-")) {
        return { iso: clean, hasTime: clean.includes("T") }
    }
    // Match YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMM
    const dateTimeMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
    if (dateTimeMatch) {
        const [, y, m, d, hh, mm, ss = "00", z = ""] = dateTimeMatch
        return {
            iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}${z}`,
            hasTime: true
        }
    }
    // Match YYYYMMDD
    const dateMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/)
    if (dateMatch) {
        const [, y, m, d] = dateMatch
        return {
            iso: `${y}-${m}-${d}`,
            hasTime: false
        }
    }
    return { iso: clean, hasTime: clean.includes("T") }
}

export function convertCalendar(data: any) {
    const assignedColors = new Map<string, string>()
    const currentEvents = get(events)

    data.forEach(({ content, name, id, color }: any) => {
        const object: any = convertToJSON(content)
        // TODO: convert timezone

        const icaEvents: VEvent[] = object.VCALENDAR?.[0]?.VEVENT || []
        if (!icaEvents.length) return

        const currentCalendars = get(calendars)
        const calName = name ? name.replace(/\.ics$/i, "").trim() : "Calendar"
        let calId = id
        let existingCal: any = null
        if (calId && currentCalendars?.[calId]) {
            existingCal = currentCalendars[calId]
        } else {
            existingCal = Object.values(currentCalendars || {}).find((c: any) => (calId && c.id === calId) || (c.name && c.name.toLowerCase() === calName.toLowerCase()) || (name && c.name && c.name.toLowerCase() === name.toLowerCase()))
            if (existingCal) {
                calId = existingCal.id
            }
        }

        if (!calId) {
            calId = uid()
        }

        const calendarColor = color || existingCal?.color || getAvailableColor(calId, currentEvents, assignedColors)

        calendars.update((a) => {
            if (!a[calId]) {
                a[calId] = {
                    id: calId,
                    name: calName,
                    color: calendarColor,
                    custom: false
                }
            } else {
                if (color) a[calId].color = color
                if (name && !a[calId].name) a[calId].name = calName
            }
            return a
        })

        const newEvents: Event[] = []
        const repeatingEventsQueue: { event: Event; exdates: string[] }[] = []

        icaEvents.forEach((event) => {
            const startKey: string = Object.keys(event).find((a) => a.startsWith("DTSTART")) || Object.keys(event).find((a) => a.includes("DTSTART")) || ""
            const endKey: string = Object.keys(event).find((a) => a.startsWith("DTEND")) || Object.keys(event).find((a) => a.includes("DTEND")) || ""

            const rawStartDate: string = (event as any)[startKey] || ""
            const rawEndDate: string = (event as any)[endKey] || ""

            const parsedStart = parseIcsDate(rawStartDate)
            let parsedEnd = parseIcsDate(rawEndDate)

            if (!parsedEnd.iso) {
                parsedEnd = parsedStart
            }

            const startDate = parsedStart.iso
            const endDate = parsedEnd.iso
            const hasTime = parsedStart.hasTime

            const exdateKey: string = Object.keys(event).find((a) => a.startsWith("EXDATE") || a.includes("EXDATE")) || ""
            const exdateVal: string = (event as any)[exdateKey] || ""
            const exdates = exdateVal
                ? exdateVal
                      .split(",")
                      .map((d) => {
                          const clean = d.trim()
                          return clean.length >= 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}` : ""
                      })
                      .filter(Boolean)
                : []

            const eventId = event.UID || uid()
            const group = eventId

            const newEvent: Event = {
                type: "event",
                name: event.SUMMARY || "",
                color: calendarColor,
                from: startDate,
                to: endDate,
                time: hasTime,
                repeat: false,
                notes: event.DESCRIPTION?.trim() || "",
                location: event.LOCATION || "",
                id: eventId,
                group,
                origin: calId
            }

            if (hasTime) {
                const fromDate = new Date(startDate)
                const toDate = new Date(endDate)
                if (!isNaN(fromDate.getTime())) {
                    newEvent.fromTime = addZero(fromDate.getHours()) + ":" + addZero(fromDate.getMinutes())
                }
                if (!isNaN(toDate.getTime())) {
                    newEvent.toTime = addZero(toDate.getHours()) + ":" + addZero(toDate.getMinutes())
                }
            }

            // get repeats
            if (event.RRULE) {
                const repeatData: { FREQ?: string; WKST?: "MO" | "SU"; UNTIL?: string; INTERVAL?: number; BYDAY?: string; COUNT?: string } = {}
                event.RRULE.split(";").forEach((rule) => {
                    const ruleData = rule.split("=")
                    repeatData[ruleData[0]] = ruleData[1]
                })

                let date: any = repeatData.UNTIL
                if (date) {
                    const parsedUntil = parseIcsDate(date)
                    date = parsedUntil.iso.substring(0, 10)
                }

                const types = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }
                if (types[repeatData.FREQ || ""]) {
                    let repeatTypes = [types[repeatData.FREQ || ""]]
                    const weeklyByDays =
                        repeatData.FREQ === "WEEKLY" && repeatData.BYDAY
                            ? Array.from(
                                  new Set(
                                      repeatData.BYDAY.split(",")
                                          .map((token) => token.trim().toUpperCase())
                                          .map((token) => token.match(/^(?:[-+]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/)?.[1] || "")
                                          .filter(Boolean)
                                  )
                              )
                            : []

                    if (repeatData.FREQ === "MONTHLY" && repeatData.BYDAY) {
                        const map: Record<string, string> = {
                            "1": "1st",
                            "+1": "1st",
                            "2": "2nd",
                            "+2": "2nd",
                            "3": "3rd",
                            "+3": "3rd",
                            "4": "4th",
                            "+4": "4th",
                            "-1": "last"
                        }
                        const resolvedTypes = repeatData.BYDAY.split(",")
                            .map((byday) => byday.match(/^([-+]?\d)([A-Z]{2})$/))
                            .map((m) => m && map[m[1]])
                            .filter(Boolean) as string[]
                        if (resolvedTypes.length > 0) {
                            repeatTypes = resolvedTypes
                        }
                    }

                    const enqueueRepeatedEvent = (ev: Event, repeatType: string) => {
                        ev.repeat = true
                        ev.repeatData = {
                            type: repeatType as "day" | "week" | "month" | "year",
                            ending: repeatData.UNTIL ? "date" : "after",
                            count: Number(repeatData.INTERVAL || 1),
                            endingDate: date || "",
                            afterRepeats: Number(repeatData.COUNT || 10)
                        }

                        newEvents.push(ev)
                        repeatingEventsQueue.push({ event: clone(ev), exdates })
                    }

                    if (repeatData.FREQ === "WEEKLY" && weeklyByDays.length > 0) {
                        const start = new Date(newEvent.from)
                        const end = new Date(newEvent.to)
                        const duration = end.getTime() - start.getTime()
                        const useUtc = newEvent.from.endsWith("Z")

                        weeklyByDays.forEach((dayCode, idx) => {
                            const weekday = WEEKDAY_INDEX[dayCode]
                            if (typeof weekday !== "number") return

                            const shiftedStart = shiftDateToWeekdayOnOrAfter(start, weekday, useUtc)
                            const shiftedEnd = new Date(shiftedStart.getTime() + duration)

                            const ev = clone(newEvent)
                            if (idx > 0) {
                                ev.id = uid()
                            }

                            ev.from = formatIsoDate(shiftedStart, hasTime, useUtc)
                            ev.to = formatIsoDate(shiftedEnd, hasTime, useUtc)

                            enqueueRepeatedEvent(ev, "week")
                        })
                    } else {
                        repeatTypes.forEach((repType, idx) => {
                            const ev = clone(newEvent)
                            if (idx > 0) {
                                ev.id = uid()
                            }
                            enqueueRepeatedEvent(ev, repType)
                        })
                    }
                } else {
                    newEvents.push(newEvent)
                }
            } else {
                newEvents.push(newEvent)
            }
        })

        // add events & overwrite existing events from the same origin to avoid duplicate imports
        events.update((a) => {
            Object.keys(a).forEach((k) => {
                const ev = a[k]
                if (!ev) return
                const matches = ev.origin === calId || (existingCal?.id && ev.origin === existingCal.id) || (calName && ev.origin === calName) || (name && ev.origin === name)
                if (matches) {
                    delete a[k]
                }
            })

            newEvents.forEach((event) => {
                const eventUid: string = event.id || uid()
                delete event.id
                a[eventUid] = event
            })
            return a
        })

        // create repeated events instances
        repeatingEventsQueue.forEach(({ event, exdates }) => {
            createRepeatedEvents(clone(event), true, exdates)
        })
    })
}

function convertToJSON(source: string): IcalObject {
    const output: IcalObject = {}
    const lines = source.split(NEW_LINE)

    let parentObj: IcalObject = {}
    let currentObj: IcalObject = output
    const parents: IcalObject[] = []

    let currentKey = ""

    for (const line of lines) {
        let currentValue = ""

        if (line.charAt(0) === SPACE || line.charAt(0) === "\t") {
            currentObj[currentKey] += line.substring(1)
        } else {
            const splitAt = line.indexOf(COLON)

            if (splitAt < 0) {
                continue
            }

            currentKey = line.substr(0, splitAt)
            currentValue = line.substr(splitAt + 1)

            switch (currentKey) {
                case "BEGIN":
                    parents.push(parentObj)
                    parentObj = currentObj
                    if (parentObj[currentValue] == null) {
                        parentObj[currentValue] = []
                    }
                    // Create a new object, store the reference for future uses
                    currentObj = {}
                    ;(parentObj[currentValue] as IcalObject[]).push(currentObj)
                    break
                case "END":
                    currentObj = parentObj
                    parentObj = parents.pop() as IcalObject
                    break
                default:
                    if (currentObj[currentKey]) {
                        if (!Array.isArray(currentObj[currentKey])) {
                            currentObj[currentKey] = [currentObj[currentKey]] as string[]
                        }
                        ;(currentObj[currentKey] as string[]).push(currentValue)
                    } else {
                        ;(currentObj[currentKey] as string) = currentValue
                    }
            }
        }
    }
    return output
}
