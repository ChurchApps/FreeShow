<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { variables } from "../../../stores"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"
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
    let current: any = {}
    let show: boolean = false

    $: filteredItems = currentItems.filter((item) => shouldItemBeShown(item, currentItems, outputId, $variables))

    // WIP conditions does not remove items when filteredItems updates

    // do not update if only line has changed
    $: currentOutSlide = "{}"
    $: if (outSlide) {
        let newOutSlide = clone(outSlide)
        delete newOutSlide.line
        let outSlideString = JSON.stringify(newOutSlide)
        if (outSlideString !== currentOutSlide) currentOutSlide = outSlideString
    }
    // do not update if lines has no changes for this output
    $: currentLines = "{}"
    $: if (lines) {
        let outLinesString = JSON.stringify(lines)
        if (outLinesString !== currentLines) currentLines = outLinesString
    }

    $: if (currentSlide?.items !== undefined || currentOutSlide || currentLines) updateItems()
    let timeout: NodeJS.Timeout | null = null

    // if anything is outputted & changing to something that's outputted
    let transitioningBetween: boolean = false

    function updateItems() {
        if (!currentSlide?.items?.length) {
            currentItems = []
            filteredItems = [] // this has to be updated here due to Svelte $ not updating properly
            current = {
                outSlide: clone(outSlide),
                slideData: clone(slideData),
                currentSlide: clone(currentSlide),
                lines: clone(lines),
                currentStyle: clone(currentStyle),
            }
            return
        }

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
                current = {
                    outSlide: clone(outSlide),
                    slideData: clone(slideData),
                    currentSlide: clone(currentSlide),
                    lines: clone(lines),
                    currentStyle: clone(currentStyle),
                }

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
    {#each filteredItems as item}
        {#if show}
            <SlideItemTransition
                {preview}
                {transitionEnabled}
                {transitioningBetween}
                globalTransition={transition}
                currentSlide={current.currentSlide}
                {item}
                outSlide={current.outSlide}
                lines={current.lines}
                currentStyle={current.currentStyle}
                let:customSlide
                let:customItem
                let:customLines
                let:customOut
            >
                <Textbox
                    filter={current.slideData?.filterEnabled?.includes("foreground") ? current.slideData?.filter : ""}
                    backdropFilter={current.slideData?.filterEnabled?.includes("foreground") ? current.slideData?.["backdrop-filter"] : ""}
                    key={isKeyOutput}
                    disableListTransition={mirror}
                    chords={customItem.chords?.enabled}
                    animationStyle={animationData.style || {}}
                    item={customItem}
                    {ratio}
                    {outputId}
                    ref={{ showId: customOut?.id, slideId: customSlide?.id, id: customSlide?.id || "", layoutId: customOut?.layout }}
                    linesStart={customLines?.[currentLineId]?.start}
                    linesEnd={customLines?.[currentLineId]?.end}
                    outputStyle={current.currentStyle}
                    {mirror}
                    {preview}
                    slideIndex={customOut?.index}
                />
            </SlideItemTransition>
        {/if}
    {/each}
{/key}
