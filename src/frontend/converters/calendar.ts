import { uid } from "uid"
import type { Event } from "../../types/Calendar"
import { splitDate } from "../components/helpers/time"
import { events } from "../stores"

// https://github.com/adrianlee44/ical2json/blob/main/src/ical2json.ts
const NEW_LINE = /\r\n|\n|\r/
const COLON = ":"
const SPACE = " "

interface IcalObject {
    [key: string]: string | string[] | IcalObject[]
}

interface VEvent {
    CREATED: string
    DESCRIPTION: string
    "DTEND;VALUE=DATE"?: string
    "DTEND;TZID=Europe/Oslo"?: string
    DTEND?: string
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
        let object: any = convertToJSON(content)
        // TODO: convert timezone
        console.log(content)

        let icaEvents: VEvent[] = object.VCALENDAR?.[0]?.VEVENT || []
        if (!icaEvents.length) return
        console.log(icaEvents)

        let newEvents: Event[] = icaEvents.map((event) => {
            let fullDay: boolean = false
            let startKey: string = Object.keys(event).find((a) => a.includes("DTSTART")) || ""
            let endKey: string = Object.keys(event).find((a) => a.includes("DTEND")) || ""

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

            let from = splitDate(new Date(startDate))
            let to = splitDate(new Date(endDate))

            let newEvent: Event = {
                type: "event",
                name: event.SUMMARY,
                color: null,
                from: startDate,
                to: endDate,
                time: !fullDay,
                repeat: false,
                notes: event.DESCRIPTION?.trim() || "",
                location: event.LOCATION || "",
            }
            if (!fullDay) {
                newEvent.fromTime = from.hours + ":" + from.minutes
                newEvent.toTime = to.hours + ":" + to.minutes
            }
            return newEvent
        })

        console.log(newEvents)
        // add events
        // TODO: history ?
        events.update((a) => {
            newEvents.forEach((event) => {
                a[uid()] = event
            })
            return a
        })
    })
}

function addCharAtPos(string: string, char: string, pos: number) {
    return [string.slice(0, pos), char, string.slice(pos)].join("")
}

function convertToJSON(source: string): IcalObject {
    const output: IcalObject = {}
    const lines = source.split(NEW_LINE)

    let parentObj: IcalObject = {}
    let currentObj: IcalObject = output
    const parents: IcalObject[] = []

    let currentKey = ""

    for (let i = 0; i < lines.length; i++) {
        let currentValue = ""

        const line = lines[i]
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
