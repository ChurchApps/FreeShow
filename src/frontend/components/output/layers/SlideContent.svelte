<script lang="ts">
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
</script>

{#each currentSlide.items as item}
    <SlideItemTransition {preview} {transitionEnabled} slideTransition={transition} {item} {outSlide} {lines} let:customItem let:customLines let:customOut>
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
                ref={{ showId: customOut.id, slideId: currentSlide.id, id: currentSlide.id || "", layoutId: customOut.layout }}
                linesStart={customLines?.[currentLineId]?.start}
                linesEnd={customLines?.[currentLineId]?.end}
                outputStyle={currentStyle}
                {mirror}
                slideIndex={customOut.index}
            />
        {/if}
    </SlideItemTransition>
{/each}
