<script lang="ts">
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
    export let style: string = ""
    export let edit: boolean = false

    $: ref = { id }
    $: timer = $timers[id] || {}

    // TODO: timer stops when leaving window...
    // TODO: update timer type (in editor)

    let times: string[] = []
    let timeValue: string = "00:00"
    let currentTime: number
    // $: currentTime = getCurrentTime()
    $: timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0)

    $: if (Object.keys(timer).length) currentTime = getCurrentTimerValue(timer, ref, today, $activeTimers)
    else currentTime = 0

    $: min = Math.min(timer.start || 0, timer.end || 0)
    $: max = Math.max(timer.start || 0, timer.end || 0)
    $: percentage = Math.max(0, Math.min(100, ((currentTime - min) / (max - min)) * 100))
    $: itemColor = getStyles(item?.style)?.color || "white"

    $: overflow = getTimerOverflow(currentTime)
    $: negative = timer?.start! > timer?.end! || currentTime < 0
    function getTimerOverflow(time) {
        if (!timer.overflow) return false

        if (currentTime < 0) return true
        if (timer.type !== "counter") return false

        let start: number = timer.start!
        let end: number = timer.end!

        if (start < end) {
            if (time > end) return true
            return false
        }

        if (time < end) return true
        return false
    }

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("functions", "timer")
        activeDrawerTab.set("functions")

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }
</script>

{#if item?.timer?.viewType === "line"}
    <div class="line" style="width: {percentage}%;background-color: {itemColor};" on:dblclick={openInDrawer} />
{:else if item?.timer?.viewType === "circle"}
    <div class="circle" class:mask={item?.timer?.circleMask} style="--percentage: {percentage};--color: {itemColor};" on:dblclick={openInDrawer} />
{:else}
    <div class="align" style="{style}{(item?.align || '').replaceAll('text-align', 'justify-content')}" on:dblclick={openInDrawer}>
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
