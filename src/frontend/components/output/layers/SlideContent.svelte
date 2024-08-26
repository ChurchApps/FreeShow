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

    console.log(customTemplate, preview)

    // timeout so it can start fading out right before (so svelte don't removes the element right away)
    let currentItems: Item[] = []
    $: if (currentSlide.items !== undefined) updateItems()
    function updateItems() {
        setTimeout(() => {
            currentItems = clone(currentSlide.items || [])
        })
    }

    // WIP this should not update the array, but change a custom object like SlideItemTransition
    // currently it's removed right away
</script>

{#each currentItems as item}
    <SlideItemTransition {preview} {transitionEnabled} slideTransition={transition} {currentSlide} {item} {outSlide} {lines} let:customSlide let:customItem let:customLines let:customOut>
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
{/each}
