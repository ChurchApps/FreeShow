<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { OutBackground } from "../../../../types/Show"
    import { getExtension, getMediaType } from "../../helpers/media"
    import Image from "../../media/Image.svelte"
    import Video from "../../media/Video.svelte"

    export let path: string
    export let data: OutBackground = {}

    export let animationStyle: string = ""
    export let mediaStyle: MediaStyle = {}
    export let mirror: boolean = false

    export let video: any = null
    export let videoData: any = { paused: false, muted: true, duration: 0, loop: false }
    export let videoTime: number = 0

    $: extension = getExtension(path)
    $: type = data.type || getMediaType(extension)

    // retry on error
    let retryCount = 0
    $: if (path) retryCount = 0
    let timeout: any = null
    function reload() {
        if (retryCount > 3 || timeout) return

        timeout = setTimeout(() => {
            if (!path || !type) return
            retryCount++
            timeout = null
        }, 100)
    }
</script>

{#key retryCount}
    {#if type === "video"}
        <div class="video">
            <Video {path} bind:video bind:videoData bind:videoTime startAt={data.startAt} {mediaStyle} {animationStyle} {mirror} on:loaded on:ended on:error={reload} />
        </div>
    {:else if type === "image"}
        <div class="image" style="height: 100%;{animationStyle}">
            <Image {path} {mediaStyle} on:error={reload} on:loaded />
        </div>
    {/if}
{/key}

<style>
    .video {
        height: 100%;
        transition: opacity 0.5s;
    }

    .image {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
    }
</style>
