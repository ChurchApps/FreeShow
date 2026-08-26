import { get } from "svelte/store"
import { uid } from "uid"
import type { Event } from "../../../../types/Calendar"
import { convertCalendar } from "../../../converters/calendar"
import { alertMessage, calendars, events, special } from "../../../stores"
import { translateText } from "../../../utils/language"
import { confirmCustom } from "../../../utils/popup"

export interface CalendarData {
    id: string
    name: string
    color: string
    url?: string
    lastSynced?: number
    hidden?: boolean
    custom?: boolean
}

export function isCalendarImported(cal?: CalendarData | null): boolean {
    if (!cal) return false
    return !!cal.url || !cal.custom
}

export function createCustomCalendar(name: string, color?: string): string {
    const id = uid()
    const calColor = color || getAvailableColor(id, get(events), new Map())
    const trimmedName = name.trim() || translateText("calendar.calendar")

    calendars.update((s) => {
        s[id] = {
            id,
            name: trimmedName,
            color: calColor,
            custom: true
        }
        return s
    })

    return id
}

export interface IcsCalendar extends CalendarData {
    count: number
    unassigned?: boolean
}

export const CALENDAR_COLORS = [
    "#FF5733", // Coral/Orange
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F43F5E", // Rose
    "#84CC16", // Lime
    "#6366F1", // Indigo
    "#14B8A6", // Teal
    "#E11D48" // Crimson
]
export function getAvailableColor(calId: string, allEvents: Record<string, Event>, assignedInBatch: Map<string, string>): string {
    if (assignedInBatch.has(calId)) return assignedInBatch.get(calId)!

    const currentCalendars = get(calendars)

    // Check existing explicit assignments (Calendars config or existing events)
    const existingColor = currentCalendars?.[calId]?.color || Object.values(allEvents).find((ev) => ev.origin === calId && ev.color)?.color

    if (existingColor) {
        assignedInBatch.set(calId, existingColor)
        return existingColor
    }

    // Collect all currently used colors across sources
    const usedColors = new Set<string>([
        ...assignedInBatch.values(),
        ...Object.values(currentCalendars || {})
            .map((c: any) => c.color)
            .filter(Boolean),
        ...Object.values(allEvents)
            .map((ev) => ev.color)
            .filter(Boolean)
    ])

    // Pick first unused color, or fallback to cycling through palette
    const color = CALENDAR_COLORS.find((c) => !usedColors.has(c)) ?? CALENDAR_COLORS[usedColors.size % CALENDAR_COLORS.length]

    assignedInBatch.set(calId, color)
    return color
}

export function isCalendarHidden(calendarsMap: Record<string, any> = {}, hideUnlabeled = false, originId?: string): boolean {
    return originId ? !!calendarsMap[originId]?.hidden : !!hideUnlabeled
}

export function toggleCalendarHidden(id: string) {
    if (id === "unlabeled") {
        special.update((state) => {
            state.hideUnlabeledCalendar = !state.hideUnlabeledCalendar
            return state
        })
    } else {
        calendars.update((state) => {
            if (state[id]) state[id].hidden = !state[id].hidden
            return state
        })
    }
}

export function getIcsCalendars(allEvents: Record<string, any>, calendarsMap: Record<string, any> = {}): IcsCalendar[] {
    const counts: Record<string, number> = {}
    let unlabeledCount = 0

    Object.values(allEvents).forEach((event) => {
        if (!event.origin) unlabeledCount++
        else counts[event.origin] = (counts[event.origin] || 0) + 1
    })

    const list: IcsCalendar[] = Object.values(calendarsMap)
        .map((cal: any) => ({
            id: cal.id,
            name: cal.name || "Calendar",
            color: cal.color || "#FF5733",
            count: counts[cal.id] || 0,
            url: cal.url,
            lastSynced: cal.lastSynced,
            hidden: cal.hidden
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

    if (unlabeledCount > 0) {
        list.push({
            id: "unlabeled",
            name: translateText("category.unlabeled"),
            color: "",
            count: unlabeledCount,
            unassigned: true
        })
    }

    return list
}

export function setCalendarColor(id: string, color: string) {
    if (!id) return
    calendars.update((s) => {
        if (s[id]) s[id].color = color
        return s
    })
    events.update((e) => {
        Object.values(e).forEach((ev) => {
            if (ev.origin === id) ev.color = color
        })
        return e
    })
}

export function renameCalendar(id: string, newName: string) {
    if (!id || !newName) return
    calendars.update((s) => {
        if (s[id]) s[id].name = newName
        return s
    })
}

function parseCalendarName(content: string, url: string): string {
    const match = content.match(/X-WR-CALNAME:(.+)/i)
    if (match?.[1]?.trim()) return match[1].trim()

    try {
        const parsed = new URL(url)
        const lastPath = parsed.pathname.split("/").filter(Boolean).pop()
        if (lastPath?.toLowerCase().endsWith(".ics")) {
            return decodeURIComponent(lastPath.replace(/\.ics$/i, ""))
        }
        return parsed.hostname.replace(/^www\./i, "")
    } catch {
        return "Calendar"
    }
}

export async function fetchAndImportIcs(url: string, existingId?: string): Promise<boolean> {
    const normalized = url.trim().replace(/^(webcal:\/\/|(?!https?:\/\/))/, "https://")

    let response: Response
    try {
        response = await fetch(normalized)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (err: any) {
        alertMessage.set(`Failed to fetch calendar: ${err?.message || err}`)
        return false
    }

    const content = await response.text()
    if (!content.includes("BEGIN:VCALENDAR")) {
        alertMessage.set("Invalid calendar format: Not an iCalendar / ICS feed")
        return false
    }

    const currentCalendars = get(calendars)
    const existingCal = existingId ? currentCalendars?.[existingId] : (Object.values(currentCalendars || {}).find((c: any) => c.url === normalized) as any)

    const calId = existingCal?.id || uid()
    const resolvedName = existingCal?.name || parseCalendarName(content, normalized)
    const assignedColor = existingCal?.color || getAvailableColor(calId, get(events), new Map())

    calendars.update((s) => {
        s[calId] = {
            id: calId,
            name: resolvedName,
            color: assignedColor,
            url: normalized,
            lastSynced: Date.now(),
            hidden: existingCal?.hidden || false,
            custom: false
        }
        return s
    })

    convertCalendar([{ content, name: resolvedName, id: calId, color: assignedColor }])
    return true
}

export async function deleteCalendarEvents(id: string): Promise<boolean> {
    if (!(await confirmCustom(translateText("calendar.delete_confirmation")))) return false

    const isUnlabeled = id === "unlabeled"
    const currentCal = get(calendars)?.[id]

    events.update((evs) => {
        return Object.fromEntries(
            Object.entries(evs).filter(([_, ev]) => {
                if (isUnlabeled) return !!ev.origin
                return ev.origin !== id && ev.origin !== currentCal?.name
            })
        )
    })

    if (!isUnlabeled) {
        calendars.update((s) => {
            delete s[id]
            return s
        })
    }

    return true
}
