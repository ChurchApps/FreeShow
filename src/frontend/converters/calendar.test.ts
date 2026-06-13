import { describe, it, expect, vi } from "vitest"
import { get } from "svelte/store"

vi.mock("../components/helpers/array", () => ({ clone: <T>(x: T): T => structuredClone(x) }))
vi.mock("../components/drawer/calendar/event", () => ({ createRepeatedEvents: () => {} }))
vi.mock("../components/helpers/time", () => ({ splitDate: (d: Date) => ({ date: d.getDate(), month: d.getMonth(), year: d.getFullYear(), hours: d.getHours(), minutes: d.getMinutes() }) }))

import { convertCalendar } from "./calendar"
import { events } from "../stores"

function run(content: string) {
    events.set({} as any)
    vi.useFakeTimers()
    convertCalendar([{ content }])
    vi.runAllTimers()
    vi.useRealTimers()
    return get(events) as any
}

describe("convertCalendar", () => {
    it("parses a VEVENT into a stored event", () => {
        const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:evt1", "SUMMARY:Sunday Service", "DTSTART:20210207T100000", "DTEND:20210207T113000", "DESCRIPTION:Weekly service", "LOCATION:Main Hall", "END:VEVENT", "END:VCALENDAR"].join("\n")
        const evs = run(ics)
        expect(evs.evt1).toMatchObject({
            type: "event",
            name: "Sunday Service",
            from: "2021-02-07T10:00:00",
            to: "2021-02-07T11:30:00",
            notes: "Weekly service",
            location: "Main Hall",
            repeat: false
        })
    })

    it("parses an RRULE into repeat data", () => {
        const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:evt2", "SUMMARY:Weekly", "DTSTART:20210207T100000", "DTEND:20210207T113000", "RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20211231T000000", "END:VEVENT", "END:VCALENDAR"].join("\n")
        const evs = run(ics)
        expect(evs.evt2.repeat).toBe(true)
        expect(evs.evt2.repeatData).toMatchObject({ type: "week", count: 1, ending: "date", endingDate: "2021-12-31" })
    })
})
