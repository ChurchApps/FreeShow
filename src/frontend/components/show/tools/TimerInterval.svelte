<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activeTimers } from "../../../stores"
  import { send } from "../../../utils/request"

  let timeout: any = null
  $: if ($activeTimers.length && timeout === null) startTimer()

  const INTERVAL = 1000

  function startTimer() {
    if (!$activeTimers.filter((a) => a.paused !== true).length) {
      timeout = null
      return
    }

    timeout = setTimeout(() => {
      activeTimers.update((a) => {
        a = a.map(increment)
        return a
      })
      send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
      startTimer()
    }, INTERVAL)
  }

  function increment(timer: any) {
    if (timer.currentTime === timer.end || timer.paused) return timer
    if (timer.start < timer.end) timer.currentTime++
    else timer.currentTime--

    return timer
  }
</script>
