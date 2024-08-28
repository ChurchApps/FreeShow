<script lang="ts">
    import type { Transition } from "../../../../types/Show"
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
