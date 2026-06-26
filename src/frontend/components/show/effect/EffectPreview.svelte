<script lang="ts">
    import { effects, outLocked, outputs } from "../../../stores"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"

    import Effect from "../../output/effects/Effect.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"

    export let show: any

    $: isOutputted = findMatchingOut(show.id, $outputs) !== null
</script>

<div class="effectPreview context #effect_preview">
    <HoverButton
        icon={isOutputted ? "clear" : "play"}
        size={isOutputted ? 8 : 10}
        on:click={() => {
            if (!$outLocked) setOutput("effects", show.id, true)
        }}
    >
        <Zoomed background="transparent" checkered center mirror zoom={false}>
            <Effect effect={$effects[show.id]} preview={false} />
        </Zoomed>
    </HoverButton>
</div>

<style>
    .effectPreview {
        width: 100%;
        height: 100%;
    }

    .effectPreview :global(.slide:not(.landscape)) {
        height: 100%;
    }
    .effectPreview :global(.slide.landscape) {
        width: 100%;
    }

    .effectPreview :global(canvas) {
        max-width: 100%;
        max-height: 100%;
        align-self: center;
    }
</style>
