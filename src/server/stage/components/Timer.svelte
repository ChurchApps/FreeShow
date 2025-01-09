<script lang="ts">
    import type { Item } from "../../../types/Show"
    import { secondsToTime } from "../../common/util/time"
    import { activeTimers, events } from "../store"

    export let item: null | Item = null
    export let timer: any = item?.timer
    export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
    export let today: Date
    export let style: string

    let timeValue: string = "00:00"
    let currentTime: number
    $: numberToText(typeof currentTime === "number" ? currentTime : 0, item?.timer?.showHours)

    $: {
        if (timer.type === "counter") {
            if (item) currentTime = $activeTimers.filter((a) => a.showId === ref.showId && a.slideId === ref.slideId && a.id === ref.id)[0]?.currentTime
            else currentTime = $activeTimers.filter((a) => a.id === ref.id)[0]?.currentTime
            console.log(timer, currentTime, $activeTimers, ref)
            if (typeof currentTime !== "number") currentTime = timer.start
        } else if (timer.type === "clock") {
            let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
            currentTime = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
        } else if (timer.type === "event") {
            let eventTime = new Date($events[timer.event]?.from)?.getTime() || 0
            currentTime = eventTime > today.getTime() ? (eventTime - today.getTime()) / 1000 : 0
        } else {
            currentTime = 0
        }
    }

    $: overflow = getTimerOverflow(currentTime)
    $: negative = timer?.start! > timer?.end!

    function getTimerOverflow(time: number) {
        if (!timer.overflow || timer.type !== "counter") return false
        if (!timer.overflow) return false
        let start: number = timer.start!
        let end: number = timer.end!

        if (start < end) {
            if (time > end) return true
            return false
        }

        if (time < end) return true
        return false
    }

    function numberToText(time: number, showHours: boolean = true) {
        let allTimes: any = secondsToTime(time)

        let days = allTimes.d === 0 ? "" : allTimes.d + ", "
        let hours = showHours ? (allTimes.h === "00" ? "" : allTimes.h) : ""
        let minutes = padString(Number(allTimes.m) + (showHours ? 0 : Number(allTimes.h) * 60))
        timeValue = days + [hours, minutes, allTimes.s].join(":")

        while (timeValue[0] === ":") timeValue = timeValue.slice(1, timeValue.length)
        timeValue = timeValue.replace(" :", " ")
    }
    export const padString = (a: number) => a.toString().padStart(2, "0")
</script>

<div class="align autoFontSize" style="{style}{item?.align || ''}">
    <div style="display: flex;white-space: nowrap;{overflow ? 'color: ' + (timer.overflowColor || 'red') + ';' : ''}">
        {#if overflow && negative}
            <span>-</span>
        {/if}

        {timeValue}
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
