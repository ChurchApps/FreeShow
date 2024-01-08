<script lang="ts">
    import { showsCache } from "../../../stores"
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
    export let autoSize: boolean = false
    export let fontSize: number = 0
    export let stageItem: any
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        id: string
    }

    $: index = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index + (next ? 1 : 0) : null
    $: slideId = index !== null && currentSlide ? _show(currentSlide.id).layouts("active").ref()[0][index!]?.id || null : null
    $: slide = currentSlide.id === "temp" && !next ? { items: currentSlide.tempItems } : currentSlide && slideId ? $showsCache[currentSlide.id].slides[slideId] : null

    // $: stageAutoSize = autoSize ? (items[0] ? getAutoSize(items[0], parent) : 0) : fontSize

    $: reversedItems = clone(slide?.items || []).reverse()
    $: items = style ? slide?.items || [] : combineSlideItems()

    function combineSlideItems() {
        let oneItem: any = null
        if (!slide?.items) return []
        reversedItems
            .filter((item) => (!item.type || item.type === "text") && (!item.bindings?.length || item.bindings.includes("stage")))
            .forEach((item: any) => {
                if (item.lines && item.lines[0]?.text?.[0]?.value?.length) {
                    if (!oneItem) oneItem = item
                    else oneItem.lines.push(...item.lines)
                }
            })

        return oneItem ? [oneItem] : []
    }
</script>

{#if slide}
    {#if style}
        <Main let:resolution let:width let:height>
            <Zoomed background="transparent" style={getStyleResolution(resolution, width, height, "fit")} center>
                {#each items as item}
                    <Textbox {item} {style} {stageItem} {chords} {ref} stageAutoSize={item.auto && autoSize} {fontSize} addDefaultItemStyle={style} />
                {/each}
            </Zoomed>
        </Main>
    {:else}
        {#each items as item}
            <Textbox {item} {style} {stageItem} {chords} {ref} stageAutoSize={autoSize} {fontSize} addDefaultItemStyle={style} />
        {/each}
    {/if}
{/if}
