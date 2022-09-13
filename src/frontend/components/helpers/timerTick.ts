import { get } from "svelte/store"
import type { Event } from "../../../types/Calendar"
import { OUTPUT, STAGE } from "../../../types/Channels"
import { activePopup, activeTimers, alertMessage, events, shows } from "../../stores"
import { send } from "../../utils/request"
import { setOutput } from "./output"
import { loadShows } from "./setShow"
import { _show } from "./shows"

const INTERVAL = 1000
const TEN_SECONDS = 1000 * 10
const ONE_MINUTE = 1000 * 60

let timeout: any = null
export function startTimer() {
  if (!get(activeTimers).filter((a) => a.paused !== true).length || timeout) return

  timeout = setTimeout(() => {
    activeTimers.update((a) => {
      a = a.map(increment)
      return a
    })
    send(OUTPUT, ["ACTIVE_TIMERS"], get(activeTimers))
    send(STAGE, ["ACTIVE_TIMERS"], get(activeTimers))
    timeout = null
    startTimer()
  }, INTERVAL)
}

function increment(timer: any) {
  if (timer.currentTime === timer.end || timer.paused) return timer
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

      // less than 1 minute
      let timeLeft: number = eventTime.getTime() - currentTime.getTime()
      if (timeLeft <= ONE_MINUTE && timeLeft > ONE_MINUTE - INTERVAL) {
        // only alert at exactly one minute left
        alertMessage.set("Starting show " + get(shows)[event.show!].name + " in less than a minute")
        console.log("Starting show " + get(shows)[event.show!].name + " in less than a minute")
        activePopup.set("alert")
      }
      // less than 10 seconds
      if (timeLeft <= TEN_SECONDS && timeLeft > TEN_SECONDS - INTERVAL) {
        alertMessage.set("Starting show " + get(shows)[event.show!].name + " in less than 10 seconds")
        console.log("Starting show " + get(shows)[event.show!].name + " in less than 10 seconds")
        activePopup.set("alert")
        loadShows([event.show!])
      }
      // start show
      if (timeLeft <= 0 && timeLeft > 0 - INTERVAL) {
        let activeLayout = _show(event.show).get("settings.activeLayout")
        setOutput("slide", { id: event.show, layout: activeLayout, index: 0, line: 0 })
      }
    })

    showTimeout = null
    startEventTimer()
  }, INTERVAL)
}
