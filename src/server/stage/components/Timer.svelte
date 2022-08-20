<script lang="ts">
  import type { Item } from "../../../types/Show"
  import { secondsToTime } from "../../remote/helpers/time"
  import { activeTimers, events } from "../store"

  export let item: null | Item = null
  export let timer: any = item?.timer
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
  export let today: Date
  export let style: string

  // TODO: timer stops when leaving window...

  let times: string[] = []
  let timeValue: string = "00:00"
  let currentTime: number
  // $: currentTime = getCurrentTime()
  $: numberToText(typeof currentTime === "number" ? currentTime : 0)

  $: {
    if (timer.type === "counter") {
      if (item) currentTime = $activeTimers.filter((a) => a.showId === ref.showId && a.slideId === ref.slideId && a.id === ref.id)[0]?.currentTime
      else currentTime = $activeTimers.filter((a) => a.id === ref.id)[0]?.currentTime
      if (typeof currentTime !== "number") currentTime = timer.start
    } else if (timer.type === "clock") {
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

<div class="align" style="{style}{item?.align || ''}">
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

<style>
  .align {
    display: flex;
    justify-content: center;
    height: 100%;
    align-items: center;
  }
</style>
