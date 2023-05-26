<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { timers } from "../../../stores"
    import { getCurrentTimerValue } from "../../drawer/timers/timers"
    // import { blur } from "svelte/transition"
    import { secondsToTime } from "../../helpers/time"

    export let item: null | Item = null
    // export let timer: any = item?.timer
    // export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
    export let id: string
    export let today: Date
    export let style: string = ""

    $: ref = { id }
    $: timer = $timers[id] || {}

    // TODO: timer stops when leaving window...
    // TODO: update timer type (in editor)

    let times: string[] = []
    let timeValue: string = "00:00"
    let currentTime: number
    // $: currentTime = getCurrentTime()
    $: numberToText(typeof currentTime === "number" ? currentTime : 0)

    $: if (timer) currentTime = getCurrentTimerValue(timer, ref, today)

    function numberToText(time: number) {
        let allTimes: any = secondsToTime(time)

        timeValue = (allTimes.d === 0 ? "" : allTimes.d + ", ") + [allTimes.h === "00" ? "" : allTimes.h, allTimes.m, allTimes.s].join(":")
        while (timeValue[0] === ":") timeValue = timeValue.slice(1, timeValue.length)

        timeValue = timeValue.replace(" :", " ")
    }

    $: overflow = getTimerOverflow(currentTime)
    $: negative = timer?.start! > timer?.end!
    function getTimerOverflow(time) {
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
</script>

<div class="align" style="{style}{item?.align || ''}">
    <div style="display: flex;white-space: nowrap;{overflow ? 'color: ' + (timer.overflowColor || 'red') + ';' : ''}">
        {#if overflow && negative}
            <span>-</span>
        {/if}
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
