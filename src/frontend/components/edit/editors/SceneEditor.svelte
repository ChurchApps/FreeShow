<script lang="ts">
    import { activeEdit, outputs, scenes, styles } from "../../../stores"
    import ScenePreview from "../../drawer/pages/ScenePreview.svelte"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"
    import { centerZoom } from "../scripts/zoom"

    $: currentId = $activeEdit.id!
    $: scene = $scenes[currentId]

    $: sceneStyleId = scene?.content?.style

    let width = 0
    let height = 0
    $: resolution = getResolution(null, { $outputs, $styles }, false, "", sceneStyleId)

    let scrollElem: HTMLDivElement | undefined
    let zoom = 1
    let zoomOrigin: { x: number; y: number } | null = null

    function updateZoom(e: any) {
        zoom = e.detail
        const origin = zoomOrigin
        zoomOrigin = null
        centerZoom(origin, scrollElem, ".scene-preview-container")
    }

    $: widthOrHeight = getStyleResolution(resolution, width, height, "fit", { zoom })
</script>

<div class="editArea">
    <div class="parent" bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if scene}
            <div class="scene-preview-container">
                <Zoomed background="transparent" border {resolution} styleIdOverride={sceneStyleId} style={widthOrHeight} center>
                    <ScenePreview {scene} />
                </Zoomed>
            </div>
        {:else}
            <Center size={2} faded>
                <T id="empty.general" />
            </Center>
        {/if}
    </div>

    <FloatingInputs side="left">
        <MaterialZoom columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} on:change={updateZoom} on:origin={(e) => (zoomOrigin = e.detail)} />
    </FloatingInputs>
</div>

<style>
    .editArea {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
    }

    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: auto;
    }

    .scene-preview-container {
        width: 100%;
        height: 100%;
        display: flex;
    }
</style>
