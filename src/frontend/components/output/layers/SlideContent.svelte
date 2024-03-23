<script lang="ts">
    import Textbox from "../../slide/Textbox.svelte"

    export let outputId: string
    export let outSlide: any

    export let slideData: any
    export let slideClone: any
    export let currentStyle: any

    export let animationData: any
    export let currentLineId: any
    export let lines: any

    export let ratio: number
    export let mirror: boolean = false
    export let transitionEnabled: boolean = false
    export let isKeyOutput: boolean = false
</script>

{#if slideClone?.items}
    {#each slideClone.items as item}
        {#if !item.bindings?.length || item.bindings.includes(outputId)}
            <Textbox
                filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                key={isKeyOutput}
                disableListTransition={mirror}
                chords={item.chords?.enabled}
                animationStyle={animationData.style || {}}
                {item}
                {ratio}
                ref={{ showId: outSlide.id, slideId: slideClone.id, id: slideClone.id, layoutId: outSlide.layout }}
                linesStart={lines[currentLineId]?.start}
                linesEnd={lines[currentLineId]?.end}
                {transitionEnabled}
                outputStyle={currentStyle}
                {mirror}
                slideIndex={outSlide.index}
            />
        {/if}
    {/each}
{/if}
