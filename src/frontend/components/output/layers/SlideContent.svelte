<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import SlideItemTransition from "../transitions/SlideItemTransition.svelte"

    export let outputId: string
    export let outSlide: any

    export let slideData: any
    export let currentSlide: any
    export let currentStyle: any

    export let animationData: any
    export let currentLineId: any
    export let lines: any

    export let ratio: number
    export let mirror: boolean = false
    export let preview: boolean = false
    export let transition: any = {}
    export let transitionEnabled: boolean = false
    export let isKeyOutput: boolean = false

    let currentItems: Item[] = []
    let show: boolean = false

    $: if (currentSlide.items !== undefined || outSlide) updateItems()
    let timeout: any = null

    // if anything is outputted & changing to something that's outputted
    let transitioningBetween: boolean = false

    function updateItems() {
        // get any items with no transition between the two slides
        let oldItemTransition = currentItems.find((a) => a.actions?.transition)?.actions?.transition
        let newItemTransition = currentSlide.items.find((a) => a.actions?.transition)?.actions?.transition
        let itemTransitionDuration: number | null = null
        if (oldItemTransition && JSON.stringify(oldItemTransition) === JSON.stringify(newItemTransition)) {
            itemTransitionDuration = oldItemTransition.duration ?? null
            if (oldItemTransition.type === "none") itemTransitionDuration = 0
            // find any item that should have no transition!
            else if (currentSlide.items.find((a) => a.actions?.transition?.duration === 0 || a.actions?.transition?.type === "none")) itemTransitionDuration = 0
        }

        let currentTransition = transition.between || transition.in || transition
        if (currentTransition?.type === "none") currentTransition.duration = 0

        let currentTransitionDuration = transitionEnabled ? (itemTransitionDuration ?? currentTransition?.duration ?? 0) : 0
        let waitToShow = currentTransitionDuration * 0.5

        // between
        if (currentItems.length && currentSlide.items.length) transitioningBetween = true

        if (timeout) clearTimeout(timeout)

        // wait for between to update out transition
        timeout = setTimeout(() => {
            show = false

            // wait for previous items to start fading out (svelte will keep them until the transition is done!)
            timeout = setTimeout(() => {
                currentItems = clone(currentSlide.items || [])

                // wait until half transition duration of previous items have passed as it looks better visually
                timeout = setTimeout(() => {
                    show = true

                    // wait for between to set in transition
                    timeout = setTimeout(() => {
                        transitioningBetween = false
                    })
                }, waitToShow)
            })
        })
    }
</script>

<!-- Updating this with another "store" causes svelte transition bug! -->
{#key show}
    {#each currentItems as item}
        {#if show}
            <SlideItemTransition {preview} {transitionEnabled} {transitioningBetween} globalTransition={transition} {currentSlide} {item} {outSlide} {lines} {currentStyle} let:customSlide let:customItem let:customLines let:customOut>
                {#if !customItem.bindings?.length || customItem.bindings.includes(outputId)}
                    <Textbox
                        filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                        backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                        key={isKeyOutput}
                        disableListTransition={mirror}
                        chords={customItem.chords?.enabled}
                        animationStyle={animationData.style || {}}
                        item={customItem}
                        {ratio}
                        ref={{ showId: customOut.id, slideId: customSlide.id, id: customSlide.id || "", layoutId: customOut.layout }}
                        linesStart={customLines?.[currentLineId]?.start}
                        linesEnd={customLines?.[currentLineId]?.end}
                        outputStyle={currentStyle}
                        {mirror}
                        {preview}
                        slideIndex={customOut.index}
                    />
                {/if}
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
