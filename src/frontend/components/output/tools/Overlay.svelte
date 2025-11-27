<script lang="ts">
    import type { Output } from "../../../../types/Output"
    import { effects, outLocked, overlays } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"

    export let currentOutput: Output

    // $: if (!currentOutput?.out?.overlays?.length) {
    //   // get all overlays
    //   let outs = getAllActiveOutputs()
    //   currentOutput = outs.find((output) => output.out?.overlays)
    // }

    $: activeEffects = currentOutput?.out?.effects?.map(id => ({ id, ...$effects[id] })) || []
    $: activeOverlays = currentOutput?.out?.overlays?.map(id => ({ id, ...$overlays[id] })) || []

    function removeEffect(id: string) {
        if ($outLocked || !currentOutput.out?.effects) return

        setOutput(
            "effects",
            currentOutput.out.effects.filter(a => a !== id)
        )
    }

    function removeOverlay(id: string) {
        if ($outLocked || !currentOutput.out?.overlays) return

        setOutput(
            "overlays",
            currentOutput.out.overlays.filter(a => a !== id)
        )
    }

    // function setLocked(id: string, setLocked: boolean) {
    //     overlays.update((a) => {
    //         a[id].locked = setLocked
    //         return a
    //     })
    // }
</script>

{#if currentOutput?.out?.overlays?.length || currentOutput?.out?.effects?.length}
    <span class="name" style="justify-content: space-between;">
        {#each activeEffects as effect}
            <div class="overlay">
                <Button style="flex: 1;" disabled={$outLocked} on:click={() => removeEffect(effect.id)} center red>
                    <Icon id="effects" right />
                    <p>{effect.name || "—"}</p>
                </Button>
            </div>
        {/each}
        {#each activeOverlays as overlay}
            <!-- {@const locked = $overlays[overlay.id]?.locked} -->
            <div class="overlay">
                <!-- disabled={locked} red={!locked} -->
                <Button style="flex: 1;" disabled={$outLocked} on:click={() => removeOverlay(overlay.id)} center red>
                    <p>{overlay.name || "—"}</p>
                </Button>
                <!-- <Button on:click={() => setLocked(overlay.id, !locked)} title={locked ? $dictionary.preview?.unlock : $dictionary.preview?.lock} red={locked}>
                    <Icon id={locked ? "locked" : "unlocked"} />
                </Button> -->
            </div>
        {/each}
    </span>
{/if}

<style>
    .name {
        display: flex;
        flex-direction: column;
        justify-content: center;
        max-height: 60px;
        overflow-y: auto;
    }

    .overlay {
        display: flex;
    }
</style>
