<script lang="ts">
    import { playerVideos } from "../../stores"
    import Vimeo from "../drawer/player/Vimeo.svelte"
    import YouTube from "../drawer/player/YouTube.svelte"

    export let id: string
    export let outputId = ""
    export let preview = false

    $: video = $playerVideos[id]

    export let videoData = { muted: true, paused: false, loop: false, duration: 0 }
    export let videoTime = 0
    export let title = ""
    export let startAt = 0

    // TODO: looping player videos does not work!
</script>

{#if video?.type === "youtube"}
    <YouTube {outputId} playerId={id} id={video.id} bind:videoData bind:videoTime bind:title {startAt} {preview} on:loaded on:ended />
{:else if video?.type === "vimeo"}
    <Vimeo {outputId} id={video.id} bind:videoData bind:videoTime bind:title {startAt} {preview} on:loaded />
{/if}
