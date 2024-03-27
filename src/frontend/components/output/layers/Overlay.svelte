<script lang="ts">
    import type { Overlay } from "../../../../types/Show"
    import Textbox from "../../slide/Textbox.svelte"

    export let outputId: string

    export let id: string
    export let overlays: { [key: string]: Overlay }
    export let mirror: boolean = false
    export let transitionEnabled: boolean = false
</script>

{#each overlays[id].items || [] as item}
    {#if !item.bindings?.length || item.bindings.includes(outputId)}
        <Textbox {item} ref={{ type: "overlay", id }} {mirror} {transitionEnabled} />
    {/if}
{/each}
