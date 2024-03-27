<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import OutputTransition from "./OutputTransition.svelte"
    import Overlay from "./Overlay.svelte"

    export let outputId: string

    export let overlays: any
    export let activeOverlays: string[]
    export let transition: Transition

    export let isKeyOutput: boolean = false
    export let mirror: boolean = false
</script>

{#each activeOverlays as id}
    {#if overlays[id]}
        <OutputTransition {transition}>
            <div class:key={isKeyOutput}>
                <Overlay {id} {outputId} {overlays} {mirror} transitionEnabled={transition.type !== "none" && !!transition.duration} />
            </div>
        </OutputTransition>
    {/if}
{/each}

<style>
    .key {
        filter: grayscale(1) brightness(1000) contrast(100);
    }
</style>
