<script lang="ts">
    import { activeEdit, effects, outputs, styles } from "../../../stores"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Effect from "../../output/effects/Effect.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"

    $: currentId = $activeEdit.id!

    $: effect = { id: currentId, ...$effects[currentId] }

    let width = 0
    let height = 0
    $: resolution = getResolution(null, { $outputs, $styles })

    let zoom = 1
</script>

<div class="editArea">
    <div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if effect?.items}
            <Zoomed background="transparent" checkered border style={getStyleResolution(resolution, width, height, "fit", { zoom })} hideOverflow={false} center>
                <Effect {effect} edit />
            </Zoomed>
        {:else}
            <Center size={2} faded>
                <T id="empty.general" />
            </Center>
        {/if}
    </div>
</div>

<style>
    .editArea {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: auto;
    }

    .parent :global(.slide) {
        display: flex;
    }
</style>
