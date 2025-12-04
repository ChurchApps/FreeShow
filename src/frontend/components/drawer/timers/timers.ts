import { get } from "svelte/store"
import { uid } from "uid"
import type { Timer } from "../../../../types/Show"
import { activeTimers, events, timers } from "../../../stores"
import { clone, keysToID, sortByName } from "../../helpers/array"
import { _show } from "../../helpers/shows"
import { showsCache } from "./../../../stores"
import { customActionActivation } from "../../actions/actions"
import { joinTimeBig } from "../../helpers/time"

const typeOrder = { counter: 1, clock: 2, event: 3 }
export function getSortedTimers(updater = get(timers), options: { showHours?: boolean; firstActive?: boolean }) {
    const today = new Date()

    let timersList = sortByName(keysToID(updater), "name", true)
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
        .map(a => {
            const currentTime = getCurrentTimerValue(a, { id: a.id }, today)
            const timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0, options.showHours)
            return { id: a.id, name: a.name, extraInfo: timeValue }
        })
    if (options.firstActive) timersList = [{ id: "", name: "stage.first_active_timer", extraInfo: "" }, ...timersList]

    return timersList
}

export function getTimer(ref: any) {
    let timer: any = {}
    if (!ref.id) return timer

    if (ref.showId) {
        timer =
            _show(ref.showId)
                .slides()
                .items()
                .get()
                .flat()
                .find(a => a.timer?.id === ref.id)?.timer || {}
        // && a.type === "timer"

        // older versions (pre 0.5.3)
        if ((timer.type as string) === "countdown") timer.type = "counter"
    } else {
        timer = get(timers)[ref.id]
    }

    return clone(timer || {})
}

export function createGlobalTimerFromLocalTimer(showId: string | undefined) {
    if (!showId) return

    const currentShow = _show(showId).get()
    if (!currentShow?.slides) return

    let timerCreated = false

    Object.keys(currentShow.slides).forEach(checkSlide)
    function checkSlide(slideId) {
        const items: any[] = currentShow.slides[slideId].items
        if (!Array.isArray(items)) return

        // TODO: "backup" global timer to show item.timer

        let timerIndex = items.findIndex(a => !a?.timerId && a?.timer)
        while (timerIndex >= 0) {
            timerCreated = true
            const globalTimerId = uid()
            currentShow.slides[slideId].items[timerIndex].timerId = globalTimerId

            timers.update(t => {
                const globalTimer = clone(currentShow.slides[slideId].items[timerIndex].timer)
                globalTimer.name = currentShow.name
                delete globalTimer.id

                // pre 0.5.3
                if (globalTimer.type === "countdown") globalTimer.type = "counter"

                t[globalTimerId] = globalTimer
                return t
            })

            timerIndex = items.findIndex(a => !a.timerId && a.timer)
        }
    }

    if (!timerCreated) return

    showsCache.update(a => {
        a[showId] = currentShow
        return a
    })
}

const ONE_HOUR = 3600000 // 60 * 60 * 1000
export function getCurrentTimerValue(timer: Timer, ref: any, today: Date, updater = get(activeTimers)) {
    let currentTime = 0
    if (!timer) return currentTime

    if (timer.type === "counter") {
        currentTime = updater.filter(a => a.id === ref.id)[0]?.currentTime
        if (typeof currentTime !== "number") currentTime = timer.start!
    } else if (timer.type === "clock") {
        currentTime = getTimeUntilClock(timer.time!, today)
    } else if (timer.type === "event") {
        let currentEvent = get(events)[timer.event || ""] || {}
        // if repeating event & has passed more than an hour ago
        if (currentEvent.group && (new Date(currentEvent.from)?.getTime() || 0) < today.getTime() - ONE_HOUR) {
            const newEvent = getClosestUpcommingEvent(currentEvent.group)
            if (newEvent) currentEvent = newEvent
        }

        const eventTime = new Date(currentEvent.from)?.getTime() || 0
        currentTime = (eventTime - today.getTime()) / 1000
    }

    if (currentTime < 0 && !timer.overflow) currentTime = 0

    return currentTime
}

function getClosestUpcommingEvent(eventGroup: string) {
    const eventsList = keysToID(get(events)).filter(a => a.group === eventGroup)
    if (!eventsList.length) return null

    const today = Date.now()

    let closestTime = 0
    let closestId = ""
    eventsList.forEach(a => {
        const currentTime = new Date(a?.from)?.getTime() || 0
        if (currentTime > today && (!closestTime || currentTime < closestTime)) {
            closestTime = currentTime
            closestId = a.id
        }
    })

    return get(events)[closestId]
}

export function getTimeUntilClock(time: string, today: Date = new Date(), _updater: any = null) {
    const todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), time].join(" "))
    return (todayTime.getTime() - today.getTime()) / 1000
}

// ACTIONS

export function pauseAllTimers() {
    activeTimers.update(active => {
        active.forEach(a => (a.paused = true))
        return active
    })
}

export function playPauseGlobal(id: any, timer: any, forcePlay = false, pausedState: boolean | null = null) {
    if (get(timers)[id]?.type !== "counter") return
    const index = get(activeTimers).findIndex(a => a.id === id)

    activeTimers.update(a => {
        if (index < 0) a.push({ ...timer, id, currentTime: timer?.start || 0, paused: pausedState === null ? false : pausedState })
        else {
            if (pausedState === null) a[index].paused = forcePlay ? false : !a[index].paused
            else a[index].paused = pausedState
            delete a[index].startTime
        }

        return a
    })

    if (index < 0) customActionActivation("timer_start", id)

    // send(OUTPUT, ["ACTIVE_TIMERS"], get(activeTimers))
}

export function createNewTimer(name = "") {
    const timerId = uid()

    timers.update(a => {
        a[timerId] = { name, type: "counter" }
        return a
    })

    return timerId
}

export function resetTimer(id: string) {
    activeTimers.set(get(activeTimers).filter((a: any) => a.id !== id))
    // send(OUTPUT, ["ACTIVE_TIMERS"], get(activeTimers))
}

export function deleteTimer(id: string) {
    const active = get(activeTimers).findIndex(a => a.id === id)
    if (active > -1) {
        activeTimers.update(a => {
            a.splice(active, 1)
            return a
        })
    }

    timers.update(a => {
        delete a[id]
        return a
    })
}
