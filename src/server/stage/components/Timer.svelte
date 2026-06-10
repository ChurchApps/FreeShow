<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item } from "../../../types/Show"
    import { getStyles } from "../../common/util/style"
    import { getCurrentTimerValue, joinTimeBig } from "../../common/util/time"
    import { activeTimers, timers } from "../util/stores"

    export let item: null | Item = null
    // export let timer: any = item?.timer
    // export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
    export let id: string
    export let today: Date
    export let style: string = ""

    $: ref = { id }
    $: timer = $timers[id] || {}

    let timeValue: string = "00:00"
    let currentTime: number
    // $: currentTime = getCurrentTime()
    $: timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0, item?.timer?.showHours !== false)

    $: if (timer?.type) currentTime = getCurrentTimerValue(timer, ref, today, $activeTimers)
    else currentTime = 0

    $: min = Math.min(timer.start || 0, timer.end || 0)
    $: max = Math.max(timer.start || 0, timer.end || 0)
    $: percentage = Math.max(0, Math.min(100, ((currentTime - min) / (max - min)) * 100))
    $: itemColor = getStyles(item?.style)?.color || "#ffffff"

    $: overflow = !!timer.overflow && getTimerOverflow(currentTime)
    $: negative = (timer?.start || 0) > (timer?.end || 0) || currentTime < 0

    function getTimerOverflow(time: number, offset = 0) {
        if (currentTime < 0) return true
        if (timer.type !== "counter") return false

        let start = timer.start || 0
        let end = timer.end || 0

        if (start < end) return time + offset > end
        return time - offset < end
    }

    $: shouldWarn = !!timer.warn && getTimerOverflow(currentTime, (timer.warnOffset || 30) + 1)

    // BLINKING WHEN OVERFLOWING

    // don't blink if paused?
    let blinkingInterval: NodeJS.Timeout | null = null
    $: if (shouldWarn && !overflow && timer.warnFlash) startBlinking()
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
    <div class="line" style="width: {percentage}%;background-color: {itemColor};"></div>
{:else if item?.timer?.viewType === "circle"}
    <div class="circle" class:mask={item?.timer?.circleMask} style="--percentage: {percentage};--color: {itemColor};"></div>
{:else}
    <div class="align autoFontSize" style="{style}{(item?.align || '').replaceAll('text-align', 'justify-content')}">
        <div style="display: flex;white-space: nowrap;{overflow ? 'color: ' + (timer.overflowColor || '#FF4136') + ';' : shouldWarn ? 'color: ' + (timer.warnColor || '#FF8000') + ';' : ''}">
            {#if !blinkingOff}
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
        transition: 0.5s width;
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
