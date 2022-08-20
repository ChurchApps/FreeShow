import { get } from "svelte/store"
import { OUTPUT, STAGE } from "../../../types/Channels"
import { activeTimers } from "../../stores"
import { send } from "../../utils/request"

let timeout: any = null
const INTERVAL = 1000

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
