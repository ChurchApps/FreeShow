<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeTimers, events } from "../../../stores"
  // import { blur } from "svelte/transition"
  import { secondsToTime } from "../../helpers/time"

  export let item: null | Item = null
  export let timer: any = item?.timer
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }
  export let today: Date

  // TODO: timer stops when leaving window...

  let times: string[] = []
  let timeValue: string = "00:00"
  let currentTime: number
  // $: currentTime = getCurrentTime()
  $: numberToText(currentTime || timer?.start)

  $: {
    if (item) currentTime = $activeTimers.filter((a) => a.showId === ref.showId && a.slideId === ref.id && a.id === timer?.id)[0]?.currentTime
    else if (timer.type === "counter") currentTime = timer.start
    else if (timer.type === "clock") {
      let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
      currentTime = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
    } else if (timer.type === "event") {
      let eventTime = new Date($events[timer.event]?.from)?.getTime() || 0
      currentTime = eventTime > today.getTime() ? (eventTime - today.getTime()) / 1000 : 0
    }
  }

  function numberToText(time: number) {
    // let allTimes: any = secondsToTimes(time)
    // console.log(allTimes)

    // let t: string[] = []
    // if (timer?.format) timer?.format.split(":").forEach((a: string) => t.push(format(a, allTimes)))
    // else {
    let allTimes: any = secondsToTime(time)
    timeValue = (allTimes.d === 0 ? "" : allTimes.d + ", ") + [allTimes.h === "00" ? "" : allTimes.h, allTimes.m, allTimes.s].join(":")
    while (timeValue[0] === ":") timeValue = timeValue.slice(1, timeValue.length)
    timeValue = timeValue.replace(" :", " ")
    // console.log(time, allTimes, timeValue)
    // }
    // times = t
  }
</script>

<div class="align" style={item?.align || ""}>
  <div style="display: flex;white-space: nowrap;">
    {#if times.length}
      {#each times as ti, i}
        <div style="position: relative;display: flex;">
          {#each ti as t}
            <div>
              {#key t}
                <span style="position: absolute;">{t}</span>
                <!-- <span transition:blur={{ duration: 500 }} style="position: absolute;">{t}</span> -->
              {/key}
              <span style:opacity={0}>{t}</span>
            </div>
          {/each}
          <!-- style="margin: 0 10px;" -->
          {#if i % 2 === 0 && i < times.length}<span>:</span>{/if}
        </div>
      {/each}
    {:else}
      {timeValue}
    {/if}
  </div>
</div>
