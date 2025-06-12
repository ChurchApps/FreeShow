<script lang="ts">
    import type { Item, Overlay, Transition } from "../../../../types/Show"
    import { activeTimers, playingAudio, playingAudioPaths, variables, videosTime } from "../../../stores"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import SlideItemTransition from "../transitions/SlideItemTransition.svelte"

    export let outputId: string
    export let isClearing = false

    export let id: string
    export let overlays: { [key: string]: Overlay }
    export let mirror = false
    export let preview = false
    export let transition: Transition

    $: transitionEnabled = !!((transition.type !== "none" && transition.duration) || transition.in || transition.out)

    let currentItems: Item[] = []
    let show = false

    $: if (overlays[id]?.items !== undefined) updateItems()

    // WIP simular to SlideContent.svelte
    let timeout: NodeJS.Timeout | null = null
    function updateItems() {
        show = false

        // wait for previous items to start fading out (svelte will keep them until the transition is done!)
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
            currentItems = clone(overlays[id].items || [])
            show = true
        })
    }

    const showItemRef = { outputId, type: "default" }
    $: videoTime = $videosTime[outputId] || 0
    $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let update = 0
    function updateValues() {
        if (isClearing) return
        update++
    }
</script>

{#key show}
    {#each currentItems as item}
        {#if show && (!item.bindings?.length || item.bindings.includes(outputId)) && shouldItemBeShown(item, currentItems, showItemRef, update)}
            <SlideItemTransition {transitionEnabled} globalTransition={transition} {item} let:customItem>
                <Textbox item={customItem} ref={{ type: "overlay", id }} {mirror} {preview} {outputId} />
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
