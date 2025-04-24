<script lang="ts">
    import type { Item, Line, OutSlide } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { showsCache } from "../../../stores"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { clone } from "../../helpers/array"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Main from "../../system/Main.svelte"
    import { getStageTextLayoutOffset } from "../stage"

    export let currentSlide: OutSlide
    export let slideOffset = 0
    export let chords = false
    export let style = false
    export let textStyle = ""
    export let autoSize = false
    export let fontSize = 0
    export let stageItem: StageItem
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        id: string
    }

    $: showRef = currentSlide ? getLayoutRef(currentSlide.id) : []

    $: slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    $: customOffset = getStageTextLayoutOffset(showRef, slideOffset, slideIndex)

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
            .filter((item) => (item.type || "text") === "text" && (!item.bindings?.length || item.bindings.includes("stage")))
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

        if (!oneItem) return []
        // WIP remove "empty" items
        return [oneItem as Item]
    }

    // PRE LOAD SLIDE ITEMS (AUTO SIZE)

    let firstActive = false
    let items1: Item[] = []
    let items2: Item[] = []

    const waitDuration = 200 // approximate auto size time
    let timeout: NodeJS.Timeout | null = null
    $: if (items) preloadItems()
    function preloadItems() {
        // don't update if exact same (not needed)
        // if (JSON.stringify(firstActive ? items1 : items2) === JSON.stringify(items)) return

        if (firstActive) items2 = clone(items)
        else items1 = clone(items)

        let currentlyLoading = !firstActive

        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => timeoutFinished(currentlyLoading), items?.length && stageItem?.auto !== false ? waitDuration : 0)
    }

    function timeoutFinished(newActive: boolean) {
        timeout = null
        firstActive = newActive

        if (firstActive) items2 = []
        else items1 = []
    }
</script>

{#if style}
    {#if slide}
        <Main let:resolution let:width let:height>
            <Zoomed background="transparent" style={getStyleResolution(resolution, width, height, "fit")} center>
                <div class:loading={items1 && !firstActive}>
                    {#each items1 as item, i}
                        {#if !itemNumber || itemNumber - 1 === i}
                            <Textbox {item} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(slideOffset !== 0 && stageItem.lineCount)} maxLinesInvert={slideOffset < 0} stageAutoSize={item.auto && autoSize} {fontSize} isStage />
                        {/if}
                        <!-- (style ? item.auto && item.textFit === "growToFit" : item.auto) -->
                    {/each}
                </div>
                <div class:loading={items2 && firstActive}>
                    {#each items2 as item, i}
                        {#if !itemNumber || itemNumber - 1 === i}
                            <Textbox {item} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(slideOffset !== 0 && stageItem.lineCount)} maxLinesInvert={slideOffset < 0} stageAutoSize={item.auto && autoSize} {fontSize} isStage />
                        {/if}
                    {/each}
                    <!-- (style ? item.auto && (item.textFit || "shrinkToFit") === "growToFit" : item.auto) -->
                </div>
            </Zoomed>
        </Main>
    {/if}
{:else}
    <div class:loading={items1 && !firstActive}>
        {#each items1 as item}
            <Textbox {item} style={false} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(slideOffset !== 0 && stageItem.lineCount)} maxLinesInvert={slideOffset < 0} stageAutoSize={autoSize} {fontSize} isStage />
        {/each}
    </div>
    <div class:loading={items2 && firstActive}>
        {#each items2 as item}
            <Textbox {item} style={false} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(slideOffset !== 0 && stageItem.lineCount)} maxLinesInvert={slideOffset < 0} stageAutoSize={autoSize} {fontSize} isStage />
        {/each}
    </div>
{/if}

<style>
    div {
        width: 100%;
        height: 100%;
    }

    .loading {
        position: absolute;
        opacity: 0;
        top: 0;
        inset-inline-start: 0;
        pointer-events: none;
    }
</style>
