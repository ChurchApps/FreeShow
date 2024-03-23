<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"
    import Overlay from "./Overlay.svelte"

    export let outputId: string

    export let overlays: any
    export let activeOverlays: string[]
    export let transition: Transition

    export let isKeyOutput: boolean = false
    export let mirror: boolean = false

    $: noTransition = transition.type === "none"
</script>

{#each activeOverlays as id}
    {#if overlays[id]}
        {#if noTransition}
            <div class:key={isKeyOutput}>
                <Overlay {id} {outputId} {overlays} {mirror} />
            </div>
        {:else}
            <div transition:custom={transition} class:key={isKeyOutput}>
                <Overlay {id} {outputId} {overlays} {mirror} transitionEnabled />
            </div>
        {/if}
    {/if}
{/each}

<style>
    .key {
        filter: grayscale(1) brightness(1000) contrast(100);
    }
</style>
