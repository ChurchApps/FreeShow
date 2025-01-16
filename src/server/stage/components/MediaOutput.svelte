<script lang="ts">
    export let path: string
    export let mediaStyle: any = {}

    let errorLoading = false
    $: if (path) errorLoading = false
    function error() {
        errorLoading = true
    }

    // path starting at "/" auto completes to app root, but should be file://
    $: if (path?.[0] === "/") path = `file://${path}`
</script>

{#key path}
    <div style="height: 100%;object-fit: {mediaStyle.fit || 'contain'};filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});">
        {#if !errorLoading}
            <img src={path} on:error={error} />
        {/if}
    </div>
{/key}

<style>
    div {
        /* position: relative; */
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    }

    img {
        height: 100%;
        width: 100%;

        /* STAGE */
        object-fit: contain;
    }
</style>
