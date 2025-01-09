<script lang="ts">
    import type { Line } from "../../../../types/Show"
    import { showsCache } from "../../../stores"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { clone } from "../../helpers/array"
    import { _show } from "../../helpers/shows"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Main from "../../system/Main.svelte"

    export let currentSlide: any
    export let next: boolean = false
    export let chords: boolean = false
    export let style: boolean = false
    export let textStyle: string = ""
    export let autoSize: boolean = false
    export let fontSize: number = 0
    export let stageItem: any
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        id: string
    }

    $: index = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index + (next ? 1 : 0) : null
    $: showRef = currentSlide ? _show(currentSlide.id).layouts("active").ref()[0] : []
    $: while (next && showRef && showRef[index]?.data?.disabled && index <= showRef.length) index++
    $: slideId = index !== null && showRef ? showRef[index!]?.id || null : null
    $: slide = currentSlide?.id === "temp" && !next ? { items: currentSlide.tempItems } : currentSlide && slideId ? $showsCache[currentSlide?.id]?.slides?.[slideId] : null

    $: reversedItems = stageItem?.invertItems ? clone(slide?.items || []) : clone(slide?.items || []).reverse()
    $: items = style ? clone(slide?.items || []) : combineSlideItems(reversedItems)

    function combineSlideItems(items: any[]) {
        let oneItem: any = null // merge all textbox items into one
        if (!items.length) return []

        items
            .filter((item) => (item.type || "text") === "text" && (!item.bindings?.length || item.bindings.includes("stage")))
            .forEach((item: any) => {
                let text = getItemText(item)
                if (text.length) {
                    if (!oneItem) oneItem = item
                    else {
                        let EMPTY_LINE: Line = { align: "", text: [{ style: "", value: "" }] }
                        oneItem.lines.push(EMPTY_LINE, ...item.lines)
                    }
                }
            })

        return oneItem ? [oneItem] : []
    }

    // PRE LOAD SLIDE ITEMS (AUTO SIZE)

    let firstActive: boolean = false
    let items1: any[] = []
    let items2: any[] = []

    const waitDuration = 200 // approximate auto size time
    let timeout: any = null
    $: if (items) preloadItems()
    function preloadItems() {
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
                    {#each items1 as item}
                        <Textbox {item} {style} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(next && stageItem.lineCount)} stageAutoSize={item.auto && autoSize} {fontSize} addDefaultItemStyle={style} isStage />
                        <!-- (style ? item.auto && item.textFit === "growToFit" : item.auto) -->
                    {/each}
                </div>
                <div class:loading={items2 && firstActive}>
                    {#each items2 as item}
                        <Textbox {item} {style} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(next && stageItem.lineCount)} stageAutoSize={item.auto && autoSize} {fontSize} addDefaultItemStyle={style} isStage />
                    {/each}
                    <!-- (style ? item.auto && (item.textFit || "shrinkToFit") === "growToFit" : item.auto) -->
                </div>
            </Zoomed>
        </Main>
    {/if}
{:else}
    <div class:loading={items1 && !firstActive}>
        {#each items1 as item}
            <Textbox {item} {style} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(next && stageItem.lineCount)} stageAutoSize={autoSize} {fontSize} addDefaultItemStyle={style} isStage />
        {/each}
    </div>
    <div class:loading={items2 && firstActive}>
        {#each items2 as item}
            <Textbox {item} {style} customStyle={textStyle} {stageItem} {chords} {ref} maxLines={Number(next && stageItem.lineCount)} stageAutoSize={autoSize} {fontSize} addDefaultItemStyle={style} isStage />
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
        left: 0;
        pointer-events: none;
    }
</style>
