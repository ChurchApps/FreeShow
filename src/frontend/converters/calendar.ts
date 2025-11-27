import { uid } from "uid"
import type { Event } from "../../types/Calendar"
import { splitDate } from "../components/helpers/time"
import { events } from "../stores"
import { createRepeatedEvents } from "../components/drawer/calendar/event"
import { clone } from "../components/helpers/array"

// https://github.com/adrianlee44/ical2json/blob/main/src/ical2json.ts
const NEW_LINE = /\r\n|\n|\r/
const COLON = ":"
const SPACE = " "

interface IcalObject {
    [key: string]: string | string[] | IcalObject[]
}

interface VEvent {
    CLASS?: string
    CREATED: string
    DESCRIPTION: string
    "DTEND;VALUE=DATE"?: string
    "DTEND;TZID=Europe/Oslo"?: string
    DTEND?: string
    RRULE?: string // FREQ=WEEKLY;WKST=MO;UNTIL={DATE};INTERVAL={NUMBER};BYDAY={WEEKDAY}
    EXDATE?: string
    DTSTAMP: string
    DTSTART?: string
    "DTSTART;VALUE=DATE"?: string
    "LAST-MODIFIED": string
    LOCATION: string
    SEQUENCE: string
    STATUS: string
    SUMMARY: string
    TRANSP: string
    UID: string
}

export function convertCalendar(data: any) {
    data.forEach(({ content }: any) => {
        const object: any = convertToJSON(content)
        // TODO: convert timezone

        const icaEvents: VEvent[] = object.VCALENDAR?.[0]?.VEVENT || []
        if (!icaEvents.length) return

        const newEvents: Event[] = icaEvents.map(event => {
            let fullDay = false
            const startKey: string = Object.keys(event).find(a => a.includes("DTSTART")) || ""
            const endKey: string = Object.keys(event).find(a => a.includes("DTEND")) || ""

            let startDate: string = event[startKey] || ""
            let endDate: string = event[endKey] || ""

            // YYYY-MM-DDTHH:mm:ss.sssZ
            if (startDate.length >= 8) {
                if (startDate.length >= 15) {
                    fullDay = true
                    startDate = addCharAtPos(startDate, ":", 11)
                    startDate = addCharAtPos(startDate, ":", 14)
                    endDate = addCharAtPos(endDate, ":", 11)
                    endDate = addCharAtPos(endDate, ":", 14)
                }
                startDate = addCharAtPos(startDate, "-", 6)
                startDate = addCharAtPos(startDate, "-", 4)
                endDate = addCharAtPos(endDate, "-", 6)
                endDate = addCharAtPos(endDate, "-", 4)
            }

            const from = splitDate(new Date(startDate))
            const to = splitDate(new Date(endDate))

            const newEvent: Event = {
                type: "event",
                name: event.SUMMARY,
                color: "#FF5733",
                from: startDate,
                to: endDate,
                time: startDate.length > 10 || fullDay,
                repeat: false,
                notes: event.DESCRIPTION?.trim() || "",
                location: event.LOCATION || "",
                id: event.UID
            }
            if (!fullDay) {
                newEvent.fromTime = from.hours.toString() + ":" + from.minutes.toString()
                newEvent.toTime = to.hours.toString() + ":" + to.minutes.toString()
            }

            // get repeats
            if (event.RRULE) {
                const repeatData: { FREQ?: string; WKST?: "MO" | "SU"; UNTIL?: string; INTERVAL?: number; BYDAY?: string; COUNT?: string } = {}
                event.RRULE.split(";").forEach(rule => {
                    const ruleData = rule.split("=")
                    repeatData[ruleData[0]] = ruleData[1]
                })

                let date: any = repeatData.UNTIL
                if (date) {
                    date = date.slice(0, 8)
                    date = addCharAtPos(date, "-", 6)
                    date = addCharAtPos(date, "-", 4)
                    date = new Date(date).toISOString().substring(0, 10)
                }

                const types = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }
                if (types[repeatData.FREQ || ""]) {
                    newEvent.repeat = true
                    newEvent.repeatData = {
                        type: types[repeatData.FREQ || ""],
                        // weekday: weekdays[BYDAY], // MO TU WE TH FR SA SU 4SU
                        ending: repeatData.UNTIL ? "date" : "after",
                        count: Number(repeatData.INTERVAL || 1),
                        endingDate: date || "",
                        afterRepeats: Number(repeatData.COUNT || 10)
                    }

                    // create repeated events
                    // WIP this does not account for "deleted" repeating events
                    setTimeout(() => {
                        createRepeatedEvents(clone(newEvent), true)
                    }, 100)
                }
            }

            return newEvent
        })

        // add events
        // TODO: history ?
        events.update(a => {
            newEvents.forEach(event => {
                const id: string = event.id || uid()
                delete event.id
                a[id] = event
            })
            return a
        })
    })
}

function addCharAtPos(value: string, char: string, pos: number) {
    return [value.slice(0, pos), char, value.slice(pos)].join("")
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

        if (line.charAt(0) === SPACE) {
            currentObj[currentKey] += line.substr(1)
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
