<script lang="ts">
    import { activeProject, activeShow, playerVideos, projects } from "../../stores"
    import Vimeo from "../drawer/player/Vimeo.svelte"
    import YouTube from "../drawer/player/YouTube.svelte"

    export let id: string
    export let outputId = ""
    export let preview = false

    let data: { type: "youtube" | "vimeo"; id: string; name?: string } | null = null
    $: if ($activeShow && !$playerVideos[id]) getProjectData()
    function getProjectData() {
        data = $projects[$activeProject || ""]?.shows.find((a) => a.index === $activeShow?.index)?.data || null
    }

    $: video = $playerVideos[id] || data

    export let videoData = { muted: true, paused: false, loop: false, duration: 0 }
    export let videoTime = 0
    export let startAt = 0

    // TODO: looping player videos does not work!

    // YouTube needs to refresh properly when changing video
    let shouldLoad = true
    let previousId = ""
    $: if (video?.id && previousId) {
        shouldLoad = false
        previousId = video.id
        setTimeout(() => (shouldLoad = true), 3000)
    } else previousId = video?.id || ""
</script>

{#if video?.type === "youtube"}
    {#if shouldLoad}
        <YouTube {outputId} id={video.id} bind:videoData bind:videoTime {startAt} {preview} on:loaded on:ended />
    {/if}
{:else if video?.type === "vimeo"}
    <Vimeo {outputId} id={video.id} bind:videoData bind:videoTime {startAt} {preview} on:loaded />
{/if}
