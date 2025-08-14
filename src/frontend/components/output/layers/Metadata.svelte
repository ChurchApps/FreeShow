<script lang="ts">
    import type { Transition, Item } from "../../../../types/Show"
    import { activeTimers, playingAudio, playingAudioPaths, variables, videosTime } from "../../../stores"
    import { custom } from "../../../utils/transitions"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"

    export let value: string
    export let style: string
    export let conditions: any = {}
    export let isClearing: boolean = false
    export let outputId: string = ""
    export let transition: Transition
    export let isKeyOutput = false

    $: noTransition = transition.type === "none" || transition.duration === 0

    // WIP metadata "auto size / align / etc." does not work

    $: showItemRef = { outputId, slideIndex: -1 }
    $: videoTime = $videosTime[outputId] || 0 // WIP only update if the items text has a video dynamic value
    $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let update = 0
    function updateValues() {
        if (isClearing) return
        update++
    }

    $: tempItem = { style: "", lines: [{ align: "", text: [{ value, style }] }], conditions } as Item
    $: shouldShow = shouldItemBeShown(tempItem, [tempItem], showItemRef, update)
    $: console.log(shouldShow, tempItem, update)
</script>

{#if shouldShow}
    {#if noTransition}
        <div class="meta" {style} class:key={isKeyOutput}>
            {@html value}
        </div>
    {:else}
        <div class="meta" transition:custom={transition} {style} class:key={isKeyOutput}>
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
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;
    }
</style>
