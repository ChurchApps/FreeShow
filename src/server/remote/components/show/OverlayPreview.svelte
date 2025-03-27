<script lang="ts">
    import HoverButton from "../../../common/components/HoverButton.svelte"
    import { send } from "../../util/socket"
    import { dictionary, overlays } from "../../util/stores"
    import Overlay from "./Overlay.svelte"
    import Zoomed from "./Zoomed.svelte"

    export let show: any

    // let width: number = 0
    // let height: number = 0
    // let resolution: Resolution = $styleRes || { width: 1920, height: 1080 }
    let resolution = { width: 1920, height: 1080 }
</script>

<!-- bind:offsetWidth={width} bind:offsetHeight={height} -->
<div class="overlayPreview context #overlay_preview">
    <HoverButton
        icon="play"
        size={10}
        on:click={() => {
            send("API:id_select_overlay", { id: show.id })
            send("API:get_cleared")
        }}
        title={$dictionary.media?.play}
    >
        <!-- WIP width overflow -->
        <!-- style={getStyleResolution(resolution, width, height)} -->
        <Zoomed background="transparent" {resolution} checkered center mirror>
            <Overlay id={show.id} overlays={$overlays} />
        </Zoomed>
    </HoverButton>
</div>

<style>
    .overlayPreview {
        width: 100%;
        height: 100%;
    }

    .overlayPreview :global(.slide:not(.landscape)) {
        height: 100%;
    }
    .overlayPreview :global(.slide.landscape) {
        width: 100%;
    }
</style>
