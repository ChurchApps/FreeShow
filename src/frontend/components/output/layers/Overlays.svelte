<script lang="ts">
    import type { Overlays, Transition } from "../../../../types/Show"
    import Overlay from "./Overlay.svelte"

    export let outputId: string

    export let overlays: Overlays | null
    export let activeOverlays: string[]
    export let transition: Transition

    export let isKeyOutput = false
    export let mirror = false

    // SPAM PREVENTION

    // prevent spamming overlays as they get stuck due to Svelte bug
    // might still get stuck with some timings, but very unlikely
    let outputtedOverlays: string[] = []
    let clearingOverlays: string[] = []

    $: if (activeOverlays !== undefined) updateOverlays()
    let clearingTimeout: NodeJS.Timeout | null = null
    function updateOverlays() {
        ;[...activeOverlays, ...outputtedOverlays].forEach((id) => {
            if (clearingOverlays.includes(id)) return

            if (!activeOverlays.includes(id) && outputtedOverlays.includes(id)) {
                outputtedOverlays.splice(outputtedOverlays.indexOf(id), 1)
                clearingOverlays.push(id)
                outputtedOverlays = outputtedOverlays
            } else if (activeOverlays.includes(id) && !outputtedOverlays.includes(id)) {
                outputtedOverlays.push(id)
                outputtedOverlays = outputtedOverlays
            }
        })

        if (!clearingOverlays.length) return

        if (clearingTimeout) clearTimeout(clearingTimeout)
        clearingTimeout = setTimeout(clearingFinished, 220)
    }

    function clearingFinished() {
        clearingOverlays.forEach((id) => {
            if (activeOverlays.includes(id) && !outputtedOverlays.includes(id)) outputtedOverlays.push(id)
            outputtedOverlays = outputtedOverlays
        })
        clearingOverlays = []
    }
</script>

{#each outputtedOverlays as id (id)}
    {#if overlays?.[id]}
        <div class:key={isKeyOutput}>
            <Overlay {id} {outputId} {overlays} {mirror} {transition} />
        </div>
    {/if}
{/each}

<style>
    .key {
        filter: grayscale(1) brightness(1000) contrast(100);
    }
</style>
