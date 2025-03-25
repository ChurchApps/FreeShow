<script lang="ts">
    import { onMount } from "svelte"
    import { encodeFilePath } from "../../helpers/media"

    export let src: string
    export let alt: string
    export let transition: boolean = true

    let loaded: boolean = false
    let image: HTMLImageElement | null = null

    onMount(() => {
        // double check loaded
        if (image?.complete) loaded = true
    })

    // retry on error
    let retryCount = 0
    $: if (src) retryCount = 0
    function reload() {
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
</script>

{#key retryCount}
    <img style={$$props.style} src={encodeFilePath(src)} {alt} draggable="false" class:loaded class:transition bind:this={image} on:load={() => (loaded = true)} on:error={reload} />
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
