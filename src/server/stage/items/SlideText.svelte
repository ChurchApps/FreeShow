<script lang="ts">
    import Main from "../components/Main.svelte"
    import Textbox from "../components/Textbox.svelte"
    import Zoomed from "../components/Zoomed.svelte"
    import { getStyleResolution } from "../helpers/getStyleResolution"
    // import { getAutoSize } from "../helpers/autoSize"

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

    // $: stageAutoSize = autoSize ? (slide ? getAutoSize(slide.items[0], parent) : 1) : fontSize
    // $: stageAutoSize = autoSize ? (getCustomAutoSize()) : fontSize

    $: reversedItems = JSON.parse(JSON.stringify(slide?.items || [])).reverse()
    $: items = style ? slide?.items || [] : combineSlideItems()

    function combineSlideItems() {
        let oneItem: any = null
        if (!slide?.items) return []
        reversedItems
            .filter((item: any) => (!item.type || item.type === "text") && (!item.bindings?.length || item.bindings.includes("stage")))
            .forEach((item: any) => {
                if (!item.lines || !item.lines[0]?.text?.[0]?.value?.length) return

                if (!oneItem) oneItem = item
                else oneItem.lines.push(...item.lines)
            })

        return oneItem ? [oneItem] : []
    }
</script>

{#if slide}
    {#if style}
        <Main let:width let:height>
            <Zoomed {show} style={getStyleResolution(resolution, width, height, "fit")} center>
                {#each items as item}
                    <Textbox {item} {style} {chords} {stageItem} autoSize={item.auto && autoSize} {fontSize} {autoStage} />
                {/each}
            </Zoomed>
        </Main>
    {:else}
        {#each items as item}
            <Textbox {item} {style} {chords} {stageItem} {autoSize} {fontSize} {autoStage} />
        {/each}
    {/if}
{/if}
