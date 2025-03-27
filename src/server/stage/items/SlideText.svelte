<script lang="ts">
    import { getStyleResolution } from "../../common/util/getStyleResolution"
    import Main from "../components/Main.svelte"
    import Textbox from "../components/Textbox.svelte"
    import Zoomed from "../components/Zoomed.svelte"

    export let slide: any
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

    $: itemNumber = Number(stageItem?.itemNumber || 0)
    $: reversedItems = !itemNumber && stageItem?.invertItems ? JSON.parse(JSON.stringify(slide?.items || [])) : JSON.parse(JSON.stringify(slide?.items || [])).reverse()
    $: items = style ? slide?.items || [] : combineSlideItems()

    function combineSlideItems() {
        let oneItem: any = null
        if (!slide?.items) return []

        reversedItems
            .filter((item: any) => (!item.type || item.type === "text") && (!item.bindings?.length || item.bindings.includes("stage")))
            .forEach((item: any, i: number) => {
                if (itemNumber && itemNumber - 1 !== i) return
                if (!itemNumber && (!item.lines || !item.lines.find((a: any) => a?.text?.[0]?.value?.length))) return

                if (!oneItem) oneItem = item
                else {
                    let EMPTY_LINE = { align: "", text: [{ style: "", value: "" }] }
                    oneItem.lines.push(EMPTY_LINE, ...item.lines)
                }
            })

        return oneItem ? [oneItem] : []
    }
</script>

{#if slide}
    {#if style}
        <Main let:width let:height>
            <Zoomed {show} style={getStyleResolution(resolution, width, height, "fit")} center>
                {#each items as item, i}
                    {#if !itemNumber || itemNumber - 1 === i}
                        <Textbox showId={slide.showId} {item} {style} customStyle={textStyle} {chords} {stageItem} maxLines={Number(stageItem.lineCount)} autoSize={item.auto && autoSize} {fontSize} {autoStage} />
                    {/if}
                {/each}
            </Zoomed>
        </Main>
    {:else}
        {#each items as item}
            <Textbox showId={slide.showId} {item} {style} customStyle={textStyle} {chords} {stageItem} maxLines={Number(stageItem.lineCount)} {autoSize} {fontSize} {autoStage} />
        {/each}
    {/if}
{/if}
