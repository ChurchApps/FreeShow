<script lang="ts">
    import type { Item, Line, OutSlide } from "../../../types/Show"
    import { getStyleResolution } from "../../common/util/getStyleResolution"
    import { clone } from "../../common/util/helpers"
    import Main from "../components/Main.svelte"
    import Textbox from "../components/Textbox.svelte"
    import Zoomed from "../components/Zoomed.svelte"
    import { getLayoutRef } from "../helpers/show"
    import { getItemText } from "../helpers/textStyle"
    import { showsCache } from "../util/stores"

    export let currentSlide: OutSlide
    export let slideOffset: number = 0
    export let stageItem: any

    // current slide zooming
    export let show: any = {}
    export let resolution: any = {}

    // export let parent: any
    export let chords: boolean = false
    export let autoSize: boolean = false
    export let autoStage: boolean = true
    export let fontSize: number = 0

    export let style: boolean = false
    export let textStyle: string = ""

    $: showRef = currentSlide ? getLayoutRef(currentSlide.id, currentSlide.layout, $showsCache) : []

    // GET CORRECT INDEX OFFSET, EXCLUDING DISABLED SLIDES
    $: slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    let customOffset: number | null = null
    $: if (slideOffset > 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled < slideOffset && layoutOffset <= showRef.length) {
            layoutOffset++
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled++
        }
        customOffset = layoutOffset
    } else if (slideOffset < 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled > slideOffset && layoutOffset >= 0) {
            layoutOffset--
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled--
        }
        customOffset = layoutOffset
    }

    $: slideId = (customOffset !== null || slideIndex !== null) && showRef ? showRef[(customOffset ?? slideIndex)!]?.id || null : null
    $: slide = currentSlide?.id === "temp" ? getTempSlides(slideOffset) : currentSlide && slideId ? $showsCache[currentSlide?.id]?.slides?.[slideId] : null

    function getTempSlides(slideOffset: number) {
        if (slideOffset < 0) {
            let includeLength = (currentSlide.previousSlides || [])?.length
            return { items: currentSlide.previousSlides?.[includeLength - (slideOffset + 1 + includeLength)] }
        }
        if (slideOffset > 0) {
            return { items: currentSlide.nextSlides?.[slideOffset - 1] }
        }
        return { items: currentSlide.tempItems }
    }

    $: itemNumber = Number(stageItem?.itemNumber || 0)
    $: reversedItems = !itemNumber && stageItem?.invertItems ? clone(slide?.items || []) : clone(slide?.items || []).reverse()
    $: items = style ? clone(slide?.items || []) : combineSlideItems(reversedItems)

    function combineSlideItems(items: Item[]) {
        let oneItem: Item | null = null // merge all textbox items into one
        if (!items.length) return []

        items
            .filter(item => (item.type || "text") === "text" && (!item.bindings?.length || item.bindings.includes("stage")))
            .forEach((item, i) => {
                if (itemNumber && itemNumber - 1 !== i) return

                let text = getItemText(item)
                if (itemNumber || text.length) {
                    if (!oneItem) oneItem = item
                    else {
                        let EMPTY_LINE: Line = { align: "", text: [{ style: "", value: "" }] }
                        oneItem.lines!.push(EMPTY_LINE, ...(item.lines || []))
                    }
                }
            })

        return oneItem ? [oneItem as Item] : []
    }

    $: clickRevealed = slideOffset === 0 && !!currentSlide?.itemClickReveal
    $: revealed = slideOffset === 0 ? (currentSlide?.revealCount || 0) - 1 : -1
</script>

{#if slide}
    {#if style}
        <Main let:width let:height>
            <Zoomed {show} style={getStyleResolution(resolution, width, height, "fit")} center>
                {#each items as item, i}
                    {#if !itemNumber || itemNumber - 1 === i}
                        <Textbox showId={currentSlide.id} {item} customStyle={textStyle} {chords} {stageItem} maxLines={Number(stageItem.lineCount)} autoSize={item.auto && autoSize} {fontSize} {autoStage} {clickRevealed} {revealed} />
                    {/if}
                {/each}
            </Zoomed>
        </Main>
    {:else}
        {#each items as item}
            <Textbox showId={currentSlide.id} {item} style={false} customStyle={textStyle} {chords} {stageItem} maxLines={Number(stageItem.lineCount)} {autoSize} {fontSize} {autoStage} {clickRevealed} {revealed} />
        {/each}
    {/if}
{/if}
