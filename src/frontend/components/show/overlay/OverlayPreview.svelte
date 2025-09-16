<script lang="ts">
    import { dictionary, outLocked, outputs, overlays } from "../../../stores"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"

    import Overlay from "../../output/layers/Overlay.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"

    export let show: any

    $: isOutputted = findMatchingOut(show.id, $outputs) !== null

    const outputId = getActiveOutputs($outputs, true, true, true)[0]
</script>

<div class="overlayPreview context #overlay_preview">
    <HoverButton
        icon={isOutputted ? "clear" : "play"}
        size={isOutputted ? 8 : 10}
        on:click={() => {
            if (!$outLocked) setOutput("overlays", show.id, true)
        }}
        title={$dictionary.media?.play}
    >
        <Zoomed background="transparent" checkered center mirror>
            <Overlay id={show.id} {outputId} overlays={$overlays} mirror transition={{ type: "none", duration: 0, easing: "" }} />
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
