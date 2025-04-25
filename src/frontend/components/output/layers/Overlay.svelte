<script lang="ts">
    import type { Item, Overlay, Transition } from "../../../../types/Show"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import SlideItemTransition from "../transitions/SlideItemTransition.svelte"

    export let outputId: string

    export let id: string
    export let overlays: { [key: string]: Overlay }
    export let mirror = false
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
</script>

{#key show}
    {#each currentItems as item}
        {#if show}
            <SlideItemTransition {transitionEnabled} globalTransition={transition} {item} let:customItem>
                {#if !item.bindings?.length || item.bindings.includes(outputId)}
                    <Textbox item={customItem} ref={{ type: "overlay", id }} {mirror} {outputId} />
                {/if}
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
