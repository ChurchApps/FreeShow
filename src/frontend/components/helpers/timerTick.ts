import { get } from "svelte/store"
import type { Event } from "../../../types/Calendar"
import { OUTPUT, STAGE } from "../../../types/Channels"
import { activeTimers, currentWindow, dictionary, events, shows } from "../../stores"
import { newToast } from "../../utils/messages"
import { send } from "../../utils/request"
import { setOutput } from "./output"
import { loadShows } from "./setShow"
import { _show } from "./shows"
import { clone } from "./array"
import { updateOut } from "./showActions"

const INTERVAL = 1000
const TEN_SECONDS = 1000 * 10
const ONE_MINUTE = 1000 * 60

let timeout: any = null
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
    }, INTERVAL)
}

function increment(timer: any) {
    if ((timer.currentTime === timer.end && !timer.overflow) || timer.paused) return timer
    if (timer.start < timer.end) timer.currentTime++
    else timer.currentTime--

    return timer
}

let showTimeout: any = null
export function startEventTimer() {
    let currentTime: Date = new Date()
    let showEvents: Event[] = Object.values(get(events)).filter((a) => {
        let eventTime: Date = new Date(a.from)
        return a.type === "show" && currentTime.getTime() - INTERVAL < eventTime.getTime()
    })
    if (!showEvents.length || showTimeout) return

    showTimeout = setTimeout(() => {
        showEvents.forEach((event) => {
            let eventTime: Date = new Date(event.from)
            let toast = get(dictionary).toast || {}
            let showId = event.show || ""
            let show = get(shows)[showId]
            if (!show) return

            // less than 1 minute
            let timeLeft: number = eventTime.getTime() - currentTime.getTime()
            if (timeLeft <= ONE_MINUTE && timeLeft > ONE_MINUTE - INTERVAL) {
                newToast(`${toast.starting_show} ${show.name} ${toast.less_than_minute}`)
            }
            // less than 30 seconds
            if (timeLeft <= ONE_MINUTE / 2 && timeLeft > ONE_MINUTE / 2 - INTERVAL) {
                newToast(`${toast.starting_show} ${show.name} ${toast.less_than_seconds.replace("{}", "30")}`)
            }
            // less than 10 seconds
            if (timeLeft <= TEN_SECONDS && timeLeft > TEN_SECONDS - INTERVAL) {
                newToast(`${toast.starting_show} ${show.name} ${toast.less_than_seconds.replace("{}", "10")}`)
                loadShows([showId])
            }
            // start show
            if (timeLeft <= 0 && timeLeft > 0 - INTERVAL) {
                newToast(`${toast.starting_show} ${show.name} ${toast.now}`)
                loadShows([showId])
                let activeLayout = _show(event.show).get("settings.activeLayout")

                // slideClick() - Slides.svelte
                let slideRef: any = _show(showId).layouts("active").ref()[0]
                updateOut(showId, 0, slideRef)
                setOutput("slide", { id: showId, layout: activeLayout, index: 0, line: 0 })
            }
        })

        showTimeout = null
        startEventTimer()
    }, INTERVAL)
}
