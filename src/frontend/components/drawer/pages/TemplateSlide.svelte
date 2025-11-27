<script lang="ts">
    import type { Template } from "../../../../types/Show"
    import { activeEdit, outputs, overlays, styles } from "../../../stores"
    import Editbox from "../../edit/editbox/Editbox.svelte"
    import { loadThumbnail, mediaSize } from "../../helpers/media"
    import { getResolution } from "../../helpers/output"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Snaplines from "../../system/Snaplines.svelte"
    import MediaLoader from "../media/MediaLoader.svelte"

    export let templateId: string
    export let template: Template

    export let width = 0
    export let height = 0
    export let zoom = 1
    export let ratio = 1
    export let preview = false

    export let edit = false
    let lines: [string, number][] = []
    let mouse: any = null
    export let newStyles: { [key: string]: string | number } = {}
    $: active = $activeEdit.items

    // $: currentOutput = getFirstActiveOutput($outputs)
    // $: transparentOutput = !!currentOutput?.transparent
    // $: currentStyle = $styles[currentOutput?.style || ""] || {}

    // RESOLUTION
    // template?.settings?.resolution
    $: resolution = getResolution(null, { $outputs, $styles })

    // LOAD BACKGROUND
    $: bgPath = template?.settings?.backgroundPath || ""
    $: loadBackground(bgPath)
    let thumbnailPath = ""
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

    // $: styleTemplate = getStyleTemplate(null, currentStyle)
    // || styleTemplate.settings?.backgroundColor

    // let backgroundColor: string = ""
    // $: if (!edit && !template.items?.length) backgroundColor = template.color || "transparent"
    // else backgroundColor = template.settings?.backgroundColor || currentStyle.background || "black"

    $: checkered = (!preview || template.items?.length > 0) && !template.settings?.backgroundColor && !thumbnailPath
</script>

<!-- background={transparentOutput && template.items?.length ? "transparent" : backgroundColor}
checkered={template.items?.length > 0 && transparentOutput} -->
<Zoomed background={!preview || template.items?.length ? template.settings?.backgroundColor || (preview ? "var(--primary);" : "transparent") : template.color || "var(--primary);"} {checkered} border={!preview && checkered} {resolution} style={width && height ? getStyleResolution(resolution, width, height, "fit", { zoom }) : ""} bind:ratio hideOverflow={!edit} center={edit ? zoom >= 1 : false}>
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
            <Textbox backdropFilter={template["backdrop-filter"] || ""} {item} ref={{ type: "template", id: templateId }} dynamicValues={false} isTemplatePreview />
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
