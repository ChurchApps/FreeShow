import { get } from "svelte/store"
import { uid } from "uid"
import type { Timer } from "../../../../types/Show"
import { activeProject, activeTimers, events, projects, timers } from "../../../stores"
import { clone, removeDuplicates } from "../../helpers/array"
import { _show } from "../../helpers/shows"
import { showsCache } from "./../../../stores"

export async function getShowTimers(showRef: any) {
    let list: string[] = []

    if (showRef.type !== undefined && showRef.type !== "show") return []
    if (!get(showsCache)[showRef.id]) return [] // await loadShows([showRef.id])

    let timers = (_show(showRef.id).slides().items().get() || [[]]).flat().filter((a: any) => a.type === "timer")

    if (timers.length) list = timers.map((a) => a.timerId)

    return list
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
                .find((a) => a.timer?.id === ref.id)?.timer || {}
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

    showsCache.update((a) => {
        if (!a[showId]?.slides) return a

        Object.keys(a[showId].slides).forEach(checkSlide)
        function checkSlide(slideId) {
            let items: any[] = a[showId!].slides[slideId].items

            // TODO: "backup" global timer to show item.timer

            let timerIndex = items.findIndex((a) => !a.timerId && a.timer)
            while (timerIndex >= 0) {
                let globalTimerId = uid()
                a[showId!].slides[slideId].items[timerIndex].timerId = globalTimerId

                timers.update((t) => {
                    let globalTimer = clone(a[showId!].slides[slideId].items[timerIndex].timer)
                    globalTimer.name = a[showId!].name
                    delete globalTimer.id

                    // pre 0.5.3
                    if (globalTimer.type === "countdown") globalTimer.type = "counter"

                    t[globalTimerId] = globalTimer
                    return t
                })

                timerIndex = items.findIndex((a) => !a.timerId && a.timer)
            }
        }

        return a
    })
}

// function getSlideWithTimer(ref: any) {
//   let slide: any = _show(ref.showId).get().slide[ref.slideId]
//   let itemIndex: number | null = null

//   Object.entries(slides).forEach(([id, slide]: any) => {
//     if (itemIndex === null) {
//       console.log(slide)
//       let index = slide.items.findIndex((a: any) => a.timer?.id === ref.id)
//       if (index > -1) {
//         slideId = id
//         itemIndex = index
//       }
//     }
//   })

//   return { id: slideId, itemIndex }
// }

// get all timers in project
export async function loadProjectTimers(projectShows = get(projects)[get(activeProject)!]?.shows || []) {
    let list: any[] = []

    await Promise.all(
        projectShows.map(async (a) => {
            let timers: any[] = await getShowTimers(a)
            if (timers) list.push(...timers)
        })
    )

    // remove duplicates
    list = removeDuplicates(list)
    return list
}

export function getCurrentTimerValue(timer: Timer, ref: any, today: Date, updater = get(activeTimers)) {
    let currentTime: number = 0
    if (timer.type === "counter") {
        currentTime = updater.filter((a) => a.id === ref.id)[0]?.currentTime
        if (typeof currentTime !== "number") currentTime = timer.start!
    } else if (timer.type === "clock") {
        let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
        currentTime = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
    } else if (timer.type === "event") {
        let eventTime = new Date(get(events)[timer.event!]?.from)?.getTime() || 0
        currentTime = eventTime > today.getTime() ? (eventTime - today.getTime()) / 1000 : 0
    }

    // console.log(currentTime)
    return currentTime
}

// ACTIONS

export function playPauseGlobal(id: any, timer: any, forcePlay: boolean = false) {
    let index = get(activeTimers).findIndex((a) => a.id === id)

    activeTimers.update((a) => {
        if (index < 0) a.push({ ...timer, id, currentTime: timer?.start || 0, paused: false })
        else a[index].paused = forcePlay ? false : !a[index].paused
        return a
    })

    // send(OUTPUT, ["ACTIVE_TIMERS"], get(activeTimers))
}

export function createNewTimer(name: string = "") {
    let timerId = uid()

    timers.update((a) => {
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
    let active = get(activeTimers).findIndex((a) => a.id === id)
    if (active > -1) {
        activeTimers.update((a) => {
            a.splice(active, 1)
            return a
        })
    }

    timers.update((a) => {
        delete a[id]
        return a
    })
}
