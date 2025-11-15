<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item, Overlay } from "../../../../types/Show"
    import { clone } from "../../../common/util/helpers"
    import Textbox from "./Textbox.svelte"

    export let id: string
    export let overlays: { [key: string]: Overlay }

    let currentItems: Item[] = []
    let show: boolean = false

    $: if (overlays[id]?.items !== undefined) updateItems()

    let timeout: NodeJS.Timeout | null = null
    function updateItems() {
        show = false

        // wait for previous items to start fading out (svelte will keep them until the transition is done!)
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
            currentItems = clone(overlays[id].items || [])
            show = true
        })
    }

    onDestroy(() => {
        if (timeout) clearTimeout(timeout)
    })
</script>

{#key show}
    {#each currentItems as item}
        {#if show}
            <Textbox {item} />
        {/if}
    {/each}
{/key}
