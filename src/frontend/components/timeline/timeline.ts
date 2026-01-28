import { get } from "svelte/store"
import type { Timeline, TimelineAction } from "../../../types/Show"
import { showsCache } from "../../stores"
import { loadShows } from "../helpers/setShow"

// SECTIONS

type TimelineSection = { name: string; icon: string; hasData: boolean }
export const timelineSections = {
    show: {
        action: { name: "tabs.actions", icon: "actions", hasData: false },
        slide: { name: "tools.slide", icon: "slide", hasData: false },
        audio: { name: "tabs.audio", icon: "audio", hasData: false }
    },
    project: {
        action: { name: "tabs.actions", icon: "actions", hasData: false },
        show: { name: "formats.show", icon: "slide", hasData: false },
        audio: { name: "tabs.audio", icon: "audio", hasData: false }
    }
}

export const TIMELINE_SECTION_TOP = 25
export const TIMELINE_SECTION_HEIGHT = 55
export const TIMELINE_SECTION_GAP = 12

export function getTimelineSections(sections: Record<string, TimelineSection>, actions: TimelineAction[]) {
    const tabIds = Object.keys(sections)
    tabIds.forEach((tabId) => {
        sections[tabId].hasData = actions.some((a) => a.type === tabId)
    })

    return tabIds.sort((a, b) => {
        const hasActionsA = sections[a].hasData ? 1 : 0
        const hasActionsB = sections[b].hasData ? 1 : 0
        if (hasActionsA === hasActionsB) return 0
        return hasActionsA > hasActionsB ? -1 : 1
    })
}

// TIME

export function getTickInterval(zoom: number) {
    const minSpacing = 80 // minimum pixels between ticks
    const target = minSpacing / zoom
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60]
    return steps.find((s) => s >= target) || 60
}

export function formatTime(ms: number): string {
    const offsetMs = ms // + 3600000 // Start at 01:00:00;00
    const totalSeconds = Math.floor(offsetMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    // Use centiseconds (0-99) to look like frames/decimal
    const centiseconds = Math.floor((offsetMs % 1000) / 10)

    const h = hours.toString().padStart(2, "0")
    const m = minutes.toString().padStart(2, "0")
    const s = seconds.toString().padStart(2, "0")
    const cs = centiseconds.toString().padStart(2, "0")

    return `${h}:${m}:${s};${cs}`
}

export function parseTime(str: string): number {
    // Split Centiseconds
    let cs = 0
    let main = str
    if (str.includes(";")) {
        const parts = str.split(";")
        main = parts[0]
        cs = parseInt(parts[1]) || 0
    } else if (str.includes(".")) {
        const parts = str.split(".")
        main = parts[0]
        cs = parseInt(parts[1]) || 0
    }

    const parts = main
        .split(":")
        .reverse()
        .map((p) => parseInt(p) || 0)
    let s = parts[0] || 0
    let m = parts[1] || 0
    let h = parts[2] || 0

    // calculate total ms
    let ms = (h * 3600 + m * 60 + s) * 1000 + cs * 10

    // Offset logic
    // If >= 1 hour (start offset), assume absolute. Subtract offset.
    // If < 1 hour, assume relative (offset from start of show).
    // const offset = 3600000
    // if (ms >= offset) return ms - offset

    return ms
}

// ACTIONS

export function getActionsAtPosition(e: MouseEvent, trackWrapper: HTMLElement, actions: TimelineAction[], actionOrder: string[], zoomLevel: number, box: { x: number; y: number; w: number; h: number } | null = null, projectShowDurations: Record<string, number> = {}): string[] {
    if (!trackWrapper) return []

    const rect = trackWrapper.getBoundingClientRect()
    const offsetX = e.clientX - rect.left + trackWrapper.scrollLeft
    const offsetY = e.clientY - rect.top + trackWrapper.scrollTop

    const currentActionIds: string[] = []
    for (const action of actions) {
        let ax = (action.time / 1000) * zoomLevel
        let baseY = getActionBaseY(action)
        let ay = baseY
        let aw = 0
        let ah = 60 // default clip H

        const duration = action.duration || projectShowDurations[action.data?.id || ""] || 0
        if (duration) {
            aw = duration * zoomLevel
        } else {
            ay = baseY + 5
            ax -= 7 // centered
            aw = 18
            ah = 18
        }

        if (box) {
            // check if box touches action rect
            if (box.x < ax + aw && box.x + box.w > ax && box.y < ay + ah && box.y + box.h > ay) {
                currentActionIds.push(action.id)
            }
        } else {
            // check if point is inside action rect
            if (offsetX >= ax && offsetX <= ax + aw && offsetY >= ay && offsetY <= ay + ah) {
                currentActionIds.push(action.id)
            }
        }
    }

    return currentActionIds

    function getActionBaseY(action: TimelineAction): number {
        return TIMELINE_SECTION_TOP + actionOrder.indexOf(action.type) * (TIMELINE_SECTION_HEIGHT + TIMELINE_SECTION_GAP)
    }
}

// PROJECT TIMELINE

export function getProjectShowDurations(actions: TimelineAction[], _updater: any = null) {
    const durations: Record<string, number> = {}
    const showActions = actions.filter((a) => a.type === "show") || []

    let shouldLoad: string[] = []
    for (const item of showActions) {
        const showId = item.data?.id
        if (!showId) continue

        const show = get(showsCache)[showId]
        if (!show) {
            // load if not already
            shouldLoad.push(showId)
            continue
        }

        const layoutId = item.data.layoutId || ""
        const showTimeline = show.layouts?.[layoutId]?.timeline
        if (!showTimeline?.actions?.length) continue

        durations[showId] = getTimelineDuration(showTimeline)
    }

    if (shouldLoad.length) loadShows(shouldLoad)

    return durations
}

function getTimelineDuration(timeline: Timeline) {
    const lastActionTime = timeline.actions.length > 0 ? Math.max(...timeline.actions.map((a) => a.time + (a.duration || 0) * 1000)) : 0
    return lastActionTime / 1000
}

// INPUTS

const MIN_ZOOM = 6
const MAX_ZOOM = 1000
export async function timelineZoom(e: WheelEvent, zoomLevel: number) {
    e.preventDefault()

    const ZOOM_SPEED = e.altKey ? 0.4 : 0.1
    const newZoom = zoomLevel - Math.sign(e.deltaY) * zoomLevel * ZOOM_SPEED

    return Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM))
}
