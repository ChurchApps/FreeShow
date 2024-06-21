<script lang="ts">
    import type { Template } from "../../../../types/Show"
    import { activeEdit, outputs, overlays, styles } from "../../../stores"
    import Editbox from "../../edit/editbox/Editbox.svelte"
    import { loadThumbnail, mediaSize } from "../../helpers/media"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Snaplines from "../../system/Snaplines.svelte"
    import MediaLoader from "../media/MediaLoader.svelte"

    export let templateId: string
    export let template: Template

    export let width: number = 0
    export let height: number = 0
    export let zoom: number = 1
    export let ratio: number = 1

    export let edit: boolean = false
    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: any = {}
    $: active = $activeEdit.items

    $: currentStyle = $styles[$outputs[getActiveOutputs()[0]].style || ""] || {}

    // RESOLUTION
    $: resolution = getResolution(template?.settings?.resolution, { $outputs, $styles })

    // LOAD BACKGROUND
    $: bgPath = template?.settings?.backgroundPath || ""
    $: loadBackground(bgPath)
    let thumbnailPath: string = ""
    async function loadBackground(path: string) {
        if (!path) {
            thumbnailPath = ""
            return
        }

        let newPath = await loadThumbnail(bgPath, mediaSize.slideSize)
        if (newPath) thumbnailPath = newPath
    }

    // OVERLAY
    $: overlayId = template.settings?.overlayId || ""
    $: overlay = $overlays[overlayId] || null

    let backgroundColor: string = ""
    $: if (!edit && !template.items?.length) backgroundColor = "transparent"
    else backgroundColor = template.settings?.backgroundColor || currentStyle.background || "black"
</script>

<Zoomed background={backgroundColor} {resolution} style={width && height ? getStyleResolution(resolution, width, height, "fit", { zoom }) : ""} bind:ratio hideOverflow={!edit} center={edit ? zoom >= 1 : false}>
    <!-- background -->
    <!-- WIP !altKeyPressed &&  -->
    {#if thumbnailPath}
        <div class="background" style="zoom: {1 / ratio};opacity: 0.5;height: 100%;width: 100%;">
            <MediaLoader path={bgPath} {thumbnailPath} />
        </div>
    {/if}

    <!-- slide content -->
    {#if edit}
        <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
        {#each template.items as item, index}
            <Editbox ref={{ type: "template", id: templateId }} {item} {index} {ratio} bind:mouse />
        {/each}
    {:else}
        {#each template.items as item}
            <Textbox {item} ref={{ type: "template", id: templateId }} dynamicValues={false} />
        {/each}
    {/if}

    <!-- overlay -->
    <!-- WIP !altKeyPressed &&  -->
    {#if overlay?.items}
        <div style={edit ? "opacity: 0.5;pointer-events: none;" : ""}>
            {#each overlay.items as item}
                <Textbox {item} ref={{ type: "overlay", id: overlayId }} />
            {/each}
        </div>
    {/if}
</Zoomed>
