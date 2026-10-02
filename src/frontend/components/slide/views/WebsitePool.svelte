<script lang="ts">
    import PooledWebsite from "./PooledWebsite.svelte"
    import type { WebsitePool } from "./websitePool"

    // websites stay loaded here between slides (see websitePool.ts)
    export let pool: WebsitePool
    export let outputId = ""
    export let ratio = 1

    $: slots = pool.slots

    let container: HTMLElement | undefined
</script>

<div class="pool" bind:this={container}>
    {#each Object.values($slots) as website (website.src)}
        <PooledWebsite {website} {container} {outputId} {ratio} />
    {/each}
</div>

<style>
    .pool {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }
</style>
