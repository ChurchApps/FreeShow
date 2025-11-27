<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item, Overlay, Transition } from "../../../../types/Show"
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

    // WIP similar to SlideContent.svelte
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
    // $: videoTime = $videosTime[outputId] || 0
    // $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let updater = 0
    const updaterInterval = setInterval(() => {
        if (isClearing) return
        if (currentItems.find(a => a.conditions)) updater++
    }, 300)
    onDestroy(() => clearInterval(updaterInterval))
</script>

{#key show}
    {#each currentItems as item}
        {#if show && shouldItemBeShown(item, currentItems, showItemRef, updater)}
            <SlideItemTransition {transitionEnabled} globalTransition={transition} {item} let:customItem>
                <Textbox item={customItem} ref={{ type: "overlay", id }} {mirror} {preview} {outputId} />
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
