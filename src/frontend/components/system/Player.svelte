<script lang="ts">
    import { onMount } from "svelte"
    import { activeProject, activeShow, playerVideos, projects } from "../../stores"
    import Vimeo from "../drawer/player/Vimeo.svelte"
    import YouTube from "../drawer/player/YouTube.svelte"
    import { _show } from "../helpers/shows"
    import { videoSync } from "../media/video/videoSync"

    export let id: string
    export let outputId = ""
    export let preview = false

    let data: { type: "youtube" | "vimeo"; id: string; name?: string } | null = null
    $: if ($activeShow && !$playerVideos[id]) getProjectData()
    function getProjectData() {
        const showMedia = _show($activeShow?.id || "").get("media")?.[id]
        if ((showMedia as any)?.data) data = (showMedia as any).data
        else if (showMedia?.type === "youtube" || showMedia?.type === "vimeo") data = { type: showMedia.type, id: showMedia.id || showMedia.path || id, name: showMedia.name }
        else data = $projects[$activeProject || ""]?.shows.find((a) => a.index === $activeShow?.index)?.data || null
    }

    $: video = $playerVideos[id] || data

    let videoData = { muted: true, paused: false, loop: false, duration: 0 }
    let videoTime = 0

    // TODO: looping player videos does not work!

    let actualVideoTime = 0
    let previousTime = 0
    onMount(() => {
        // sync state listener
        const unsubscribe = videoSync(id, outputId, (data) => {
            if (!video) return

            // more than 2s difference, update video time
            if (data.currentTime !== undefined && (actualVideoTime !== previousTime || data.paused) && Math.abs(actualVideoTime - data.currentTime) > 2) {
                previousTime = actualVideoTime
                videoTime = data.currentTime
            }

            videoData.loop = data.loop
            videoData.paused = data.paused
            videoData.muted = data.muted
        })

        return () => {
            unsubscribe?.()
        }
    })

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
        <YouTube id={video.id} bind:videoData bind:videoTime bind:actualVideoTime {preview} on:loaded on:ended />
    {/if}
{:else if video?.type === "vimeo"}
    <Vimeo id={video.id} bind:videoData bind:videoTime bind:actualVideoTime {preview} on:loaded />
{/if}
