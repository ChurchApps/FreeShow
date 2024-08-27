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
    export let customTemplate: string = ""
    export let transition: any = {}
    export let transitionEnabled: boolean = false
    export let isKeyOutput: boolean = false

    // timeout so it can start fading out right before (so svelte don't removes the element right away)
    let currentItems: Item[] = []
    let show: boolean = false
    $: if (currentSlide.items !== undefined) updateItems()
    let timeout: any = null
    function updateItems() {
        // let hideDuration = 0 * 1000
        // // hideDuration += // + 40 // + 10

        // get any items with no transition between the two slides
        // WIP showing/clearing an item with no transition....
        let oldItemTransition = currentItems.find((a) => a.actions?.transition)?.actions?.transition
        let newItemTransition = currentSlide.items.find((a) => a.actions?.transition)?.actions?.transition
        let itemTransitionDuration: number | null = null
        if (oldItemTransition && JSON.stringify(oldItemTransition) === JSON.stringify(newItemTransition)) {
            itemTransitionDuration = oldItemTransition.duration ?? null
            if (oldItemTransition.type === "none") itemTransitionDuration = 0
            // find any item that should have no transition!
            else if (currentSlide.items.find((a) => a.actions?.transition?.duration === 0 || a.actions?.transition?.type === "none")) itemTransitionDuration = 0
        }

        // WIP get slide transition
        console.log(oldItemTransition, newItemTransition, itemTransitionDuration)

        let currentTransition = transitionEnabled ? itemTransitionDuration ?? transition?.duration ?? 0 : 0

        let waitToShow = currentTransition * 0.5
        console.log(waitToShow)

        show = false

        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
            currentItems = clone(currentSlide.items || [])
            console.log(currentItems)

            timeout = setTimeout(() => {
                show = true
            }, waitToShow)
        })
    }

    // WIP wait to hide not working...
    // WIP use svelte transition "delay" to show & hide
</script>

{#key show}
    {#each currentItems as item}
        {#if show}
            <SlideItemTransition {preview} {transitionEnabled} globalTransition={transition} {currentSlide} {item} {outSlide} {lines} {customTemplate} let:customSlide let:customItem let:customLines let:customOut>
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
                        slideIndex={customOut.index}
                    />
                {/if}
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
