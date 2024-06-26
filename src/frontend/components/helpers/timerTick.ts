import { get } from "svelte/store"
import type { Event } from "../../../types/Calendar"
import { OUTPUT, STAGE } from "../../../types/Channels"
import { activeTimers, currentWindow, dictionary, events, nextActionEventPaused, nextActionEventStart } from "../../stores"
import { newToast } from "../../utils/common"
import { translate } from "../../utils/language"
import { send } from "../../utils/request"
import { actionData } from "../actions/actionData"
import { customActionActivation, runAction } from "../actions/actions"
import { clone, sortByTime } from "./array"
import { loadShows } from "./setShow"
import { checkNextAfterMedia } from "./showActions"

const INTERVAL = 1000
const TEN_SECONDS = 1000 * 10
const ONE_MINUTE = 1000 * 60

let timeout: any = null
let customInterval = INTERVAL
export function startTimer() {
    if (get(currentWindow)) return
    if (!get(activeTimers).filter((a) => a.paused !== true).length || timeout) return

    timeout = setTimeout(() => {
        let newActiveTimers = clone(get(activeTimers)).map(increment)

        send(OUTPUT, ["ACTIVE_TIMERS"], newActiveTimers)
        send(STAGE, ["ACTIVE_TIMERS"], newActiveTimers)
        activeTimers.set(newActiveTimers)

        timeout = null
        startTimer()
    }, customInterval)
}

export function stopTimers() {
    activeTimers.set([])
    customInterval = INTERVAL
}

function increment(timer: any, i: number) {
    if (timer.start < timer.end ? timer.currentTime >= timer.end : timer.currentTime <= timer.end) {
        // ended
        checkNextAfterMedia(timer.id, "timer")
        customActionActivation("timer_end")
    }

    if ((timer.currentTime === timer.end && !timer.overflow) || timer.paused) return timer

    let currentTime = Date.now()
    // store timer start time (for accuracy)
    if (!timer.startTime) {
        let timerIs = timer.currentTime - timer.start
        let timerShouldBe = timerIs * 1000 // - 1
        if (timer.start < timer.end) timer.startTime = currentTime - timerShouldBe
        else timer.startTime = currentTime + timerShouldBe
    }

    let difference = currentTime - timer.startTime
    let timerShouldBe = Math.floor(difference / 1000) + 1

    // prevent interval time increasing more and more
    if (i === 0) {
        let preciseTime = (timerShouldBe - 1) * 1000
        let differenceMs = difference - preciseTime
        customInterval = Math.max(500, INTERVAL - differenceMs)
    }

    if (timer.start < timer.end) timer.currentTime = timer.start + timerShouldBe
    else timer.currentTime = timer.start - timerShouldBe

    return timer
}

// convert "show" to "action" <= 1.1.7
function convertShowToAction() {
    events.update((a) => {
        Object.keys(a).forEach((eventId) => {
            let event = a[eventId]
            if (event.type === "show") {
                event.type = "action"
                event.action = { id: "start_show", data: { id: event.show } }
            }
        })
        return a
    })
}

let actionTimeout: any = null
let initialized: boolean = false
export function startEventTimer() {
    if (actionTimeout) return
    actionTimeout = true

    if (!initialized) {
        initialized = true
        convertShowToAction()
    }

    let currentTime: Date = new Date()
    let actionEvents: Event[] = Object.values(get(events)).filter((a) => {
        let eventTime: Date = new Date(a.from)
        return a.type === "action" && currentTime.getTime() - INTERVAL < eventTime.getTime()
    })

    if (!actionEvents.length) nextActionEventStart.set({})

    actionEvents = actionEvents.sort(sortByTime)

    actionTimeout = setTimeout(() => {
        actionEvents.forEach((event, i) => {
            if (!event.action) return

            let eventTime: Date = new Date(event.from)
            let toast = get(dictionary).toast || {}
            if (get(nextActionEventPaused)) return

            let actionId = event.action.id
            let actionName = translate(actionData[actionId]?.name)

            let timeLeft: number = eventTime.getTime() - currentTime.getTime()
            if (i === 0) nextActionEventStart.set({ name: actionName, timeLeft })

            // less than 1 minute
            if (i < 4 && timeLeft <= ONE_MINUTE && timeLeft > ONE_MINUTE - INTERVAL) {
                newToast(`${toast.starting_action} "${actionName}" ${toast.less_than_minute}`)
                return
            }
            // less than 30 seconds
            if (i < 4 && timeLeft <= ONE_MINUTE / 2 && timeLeft > ONE_MINUTE / 2 - INTERVAL) {
                newToast(`${toast.starting_action} "${actionName}" ${toast.less_than_seconds.replace("{}", "30")}`)
                return
            }
            // less than 10 seconds
            if (i < 4 && timeLeft <= TEN_SECONDS && timeLeft > TEN_SECONDS - INTERVAL) {
                newToast(`${toast.starting_action} "${actionName}" ${toast.less_than_seconds.replace("{}", "10")}`)

                // preload data
                if (actionId === "start_show") loadShows([event.action.data?.id])
                return
            }

            // start action
            if (timeLeft <= 0 && timeLeft > 0 - INTERVAL) {
                newToast(`${toast.starting_action} "${actionName}" ${toast.now}`)

                runAction(convertEventAction(event.action))
            }
        })

        actionTimeout = null
        startEventTimer()
    }, INTERVAL)
}

function convertEventAction(action) {
    return { triggers: [action.id], actionValues: { [action.id]: action.data || {} } }
}
