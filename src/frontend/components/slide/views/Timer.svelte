<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeDrawerTab, activeTimers, drawer, timers } from "../../../stores"
    import { getCurrentTimerValue } from "../../drawer/timers/timers"
    import { setDrawerTabData } from "../../helpers/historyHelpers"
    import { getStyles } from "../../helpers/style"
    // import { blur } from "svelte/transition"
    import { joinTimeBig } from "../../helpers/time"

    export let item: null | Item = null
    // export let timer: any = item?.timer
    // export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
    export let id: string
    export let today: Date
    export let style = ""
    export let edit = false

    $: ref = { id }
    $: timer = $timers[id] || {}

    let timeValue = "00:00"
    let currentTime: number
    // $: currentTime = getCurrentTime()
    $: timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0, item?.timer?.showHours !== false)

    $: if (Object.keys(timer).length) currentTime = getCurrentTimerValue(timer, ref, today, $activeTimers)
    else currentTime = 0

    $: min = Math.min(timer.start || 0, timer.end || 0)
    $: max = Math.max(timer.start || 0, timer.end || 0)
    $: percentage = Math.max(0, Math.min(100, ((currentTime - min) / (max - min)) * 100))
    $: itemColor = getStyles(item?.style)?.color || "#ffffff"

    $: overflow = getTimerOverflow(currentTime)
    $: negative = (timer?.start || 0) > (timer?.end || 0) || currentTime < 0
    function getTimerOverflow(time: number, offset = 0) {
        if (!timer.overflow) return false

        if (currentTime < 0) return true
        if (timer.type !== "counter") return false

        let start: number = timer.start!
        let end: number = timer.end!

        if (start < end) {
            if (time + offset > end) return true
            return false
        }

        if (time - offset < end) return true
        return false
    }

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("functions", "timer")
        activeDrawerTab.set("functions")

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }

    // BLINKING WHEN OVERFLOWING

    // don't blink if paused?
    let blinkingInterval: NodeJS.Timeout | null = null
    $: blinkingOverflow = getTimerOverflow(currentTime, timer.overflowBlinkOffset || 0)
    $: if (blinkingOverflow && timer.overflowBlink) startBlinking()
    else stopBlinking()
    onDestroy(stopBlinking)

    const INTERVAL = 1200
    let blinkingOff = false
    function startBlinking() {
        if (blinkingInterval) return
        blinkingInterval = setInterval(() => {
            blinkingOff = true
            setTimeout(() => {
                blinkingOff = false
            }, INTERVAL * 0.2)
        }, INTERVAL)
    }

    function stopBlinking() {
        if (blinkingInterval) clearInterval(blinkingInterval)
        blinkingInterval = null
    }
</script>

{#if item?.timer?.viewType === "line"}
    <div class="line" style="width: {percentage}%;background-color: {itemColor};" on:dblclick={openInDrawer} />
{:else if item?.timer?.viewType === "circle"}
    <div class="circle" class:mask={item?.timer?.circleMask} style="--percentage: {percentage};--color: {itemColor};" on:dblclick={openInDrawer} />
{:else}
    <div class="align autoFontSize" style="{style}{(item?.align || '').replaceAll('text-align', 'justify-content')}" on:dblclick={openInDrawer}>
        <div style="display: flex;white-space: nowrap;{overflow ? 'color: ' + (timer.overflowColor || 'red') + ';' : ''}">
            {#if !blinkingOverflow || !blinkingOff}
                {#if overflow && negative}
                    <span>-</span>
                {/if}

                {timeValue}
            {/if}
        </div>
    </div>
{/if}

<style>
    .align {
        display: flex;
        justify-content: center;
        height: 100%;
        align-items: center;
    }

    .line {
        height: 100%;
        background-color: white;
        transition: 1s width linear;
    }

    .circle {
        --percentage: 100;
        --lineWidth: 22px;
        --color: white;

        height: 100%;
        width: 100%;
    }

    /* https://stackoverflow.com/a/6542623 */
    /* @property --percentage {
        initial-value: 100;
        inherits: false;
        syntax: "<*>";
    } */

    .circle:before {
        content: "";
        position: absolute;
        /* transition: 0.5s --percentage; */
        /* border-radius: 50%; */

        inset: 0;
        background:
            radial-gradient(farthest-side, var(--color) 98%, #0000) top/var(--lineWidth) var(--lineWidth) no-repeat,
            conic-gradient(var(--color) calc(var(--percentage) * 1%), #0000 0);
        background-size:
            0 0,
            auto;
    }
    .circle.mask:before {
        -webkit-mask: radial-gradient(farthest-side, #0000 calc(99% - var(--lineWidth)), #000 calc(100% - var(--lineWidth)));
        mask: radial-gradient(farthest-side, #0000 calc(99% - var(--lineWidth)), #000 calc(100% - var(--lineWidth)));
    }
</style>
