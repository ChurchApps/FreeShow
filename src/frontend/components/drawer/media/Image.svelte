<script lang="ts">
    import { onMount } from "svelte"
    import { encodeFilePath } from "../../helpers/media"

    export let src: string
    export let updater: number = 0
    export let alt: string
    export let transition = true

    let loaded = false
    let image: HTMLImageElement | null = null

    onMount(() => {
        // double check loaded
        if (image?.complete) loaded = true
    })

    // retry on error
    let retryCount = 0
    $: if (src) retryCount = 0
    function reload(e: any) {
        e.target.style.display = "none"

        if (retryCount > 5) {
            loaded = true
            return
        }
        loaded = false

        let time = 500 * (retryCount + 1)
        setTimeout(() => {
            retryCount++
        }, time)
    }

    function hasLoaded(e: any) {
        e.target.style.display = null
        loaded = true
    }
</script>

{#key retryCount}
    <img style={$$props.style} src="{encodeFilePath(src)}{updater ? '?' + updater : ''}" {alt} draggable="false" class:loaded class:transition bind:this={image} on:load={hasLoaded} on:error={reload} />
{/key}

<style>
    img {
        opacity: 0;
    }

    .transition {
        transition: opacity 0.5s ease-out;
    }

    img.loaded {
        opacity: 1;
    }
</style>
