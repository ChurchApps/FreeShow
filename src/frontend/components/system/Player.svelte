<script lang="ts">
    import { activeProject, activeShow, playerVideos, projects } from "../../stores"
    import Vimeo from "../drawer/player/Vimeo.svelte"
    import YouTube from "../drawer/player/YouTube.svelte"

    export let id: string
    export let outputId = ""
    export let preview = false

    let data: { type: "youtube" | "vimeo"; id: string; name?: string } | null = null
    $: if (!$playerVideos[id]) getProjectData()
    function getProjectData() {
        data = $projects[$activeProject || ""]?.shows.find((a) => a.index === $activeShow?.index)?.data || null
    }

    $: video = $playerVideos[id] || data

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
