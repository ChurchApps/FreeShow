<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item, Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"

    export let value: string
    export let style: string
    export let conditions: any = {}
    export let isClearing = false
    export let outputId = ""
    export let transition: Transition

    $: noTransition = transition.type === "none" || transition.duration === 0

    // WIP metadata "auto size / align / etc." does not work

    $: showItemRef = { outputId, slideIndex: -1 }
    // $: videoTime = $videosTime[outputId] || 0 // WIP only update if the items text has a video dynamic value
    // $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let updater = 0
    const updaterInterval = setInterval(() => {
        if (isClearing) return
        if (conditions) updater++
    }, 500)
    onDestroy(() => clearInterval(updaterInterval))

    $: tempItem = { style: "", lines: [{ align: "", text: [{ value, style }] }], conditions } as Item
    $: shouldShow = shouldItemBeShown(tempItem, [tempItem], showItemRef, updater)
</script>

{#if shouldShow && !isClearing}
    {#if noTransition}
        <div class="meta" {style}>
            {@html value}
        </div>
    {:else}
        <div class="meta" transition:custom={transition} {style}>
            {@html value}
        </div>
    {/if}
{/if}

<style>
    .meta {
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;

        /* default style */
        color: white;
        font-size: 100px;
        font-family: unset;
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        paint-order: stroke fill;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;
    }
</style>
