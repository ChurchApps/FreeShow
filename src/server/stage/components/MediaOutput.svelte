<script lang="ts">
    import { onDestroy } from "svelte"

    export let path: string
    export let mediaStyle: any = {}

    $: isNowPlaying = path?.includes("NowPlayingCover")

    let updater = 0
    let updateInterval: any = null
    $: if (isNowPlaying && !updateInterval) {
        updateInterval = setInterval(() => (updater = Date.now()), 1000)
    }
    onDestroy(() => clearInterval(updateInterval))

    let loaded = false

    $: src = isNowPlaying ? `/nowplayingcover?${updater}` : path?.[0] === "/" ? `file://${path}` : path
    $: mediaStyleString = `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});mix-blend-mode: ${mediaStyle.blend || "normal"};`
</script>

{#key path}
    <div style="height: 100%;">
        {#if src}
            <img {src} on:load={() => (loaded = true)} on:error={() => (loaded = false)} class:loaded style={mediaStyleString} alt="" />
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
        opacity: 0;
    }

    img.loaded {
        opacity: 1;
    }
</style>
