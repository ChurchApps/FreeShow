<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { activeEdit, outputs, overlays, styles } from "../../stores"
    import { history } from "../helpers/history"
    import { getResolution } from "../helpers/output"
    import { getStyles } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import Zoomed from "../slide/Zoomed.svelte"
    import Center from "../system/Center.svelte"
    import Snaplines from "../system/Snaplines.svelte"
    import Editbox from "./Editbox.svelte"
    import { autoSize } from "./scripts/autoSize"

    // TODO: overlay editor

    $: currentId = $activeEdit.id!
    $: Slide = $overlays[currentId]
    overlays.subscribe((a) => (Slide = a[currentId]))

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: any = {}
    $: active = $activeEdit.items

    let width: number = 0
    let height: number = 0
    $: resolution = getResolution(null, { $outputs, $styles })

    let ratio: number = 1

    $: {
        if (active.length) updateStyles()
        else newStyles = {}
    }

    function updateStyles() {
        if (!Object.keys(newStyles).length) return

        let items = Slide.items
        let values: any[] = []
        active.forEach((id) => {
            let item = items[id]
            let styles: any = getStyles(item.style)
            let textStyles: string = ""

            Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))
            Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

            // TODO: move multiple!
            values.push(textStyles)
        })

        let override = "overlay_items#" + $activeEdit.id + "indexes#" + active.join(",")
        history({ id: "UPDATE", newData: { key: "items", indexes: active, subkey: "style", data: values }, oldData: { id: $activeEdit.id }, location: { page: "edit", id: "overlay_items", override } })
        window.api.send(OUTPUT, { channel: "OVERLAY", data: $overlays })
    }

    $: if (Object.keys(newStyles).length && $overlays[$activeEdit.id!] && active.length) {
        let items = Slide.items
        if (items) autoSize(active, items)
    }
</script>

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if Slide}
        <Zoomed style={getStyleResolution(resolution, width, height, "fit")} bind:ratio hideOverflow={false} center>
            <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
            {#each Slide.items as item, index}
                <Editbox ref={{ type: "overlay", id: currentId }} {item} {index} {ratio} bind:mouse />
            {/each}
        </Zoomed>
    {:else}
        <Center size={2} faded>
            <T id="empty.slide" />
        </Center>
    {/if}
</div>

<style>
    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* padding: 10px; */
        overflow: auto;
    }
</style>
