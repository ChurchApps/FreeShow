<script lang="ts">
    import type { MediaFit } from "../../../types/Main"
    import type { Transition } from "../../../types/Show"
    import { activeEdit, activeShow, media } from "../../stores"
    import { custom } from "../../utils/transitions"
    import { clone } from "../helpers/array"
    import { getExtension, getMediaType } from "../helpers/media"
    import Image from "./Image.svelte"
    import MediaControls from "./MediaControls.svelte"
    import Video from "./Video.svelte"

    export let path: string
    export let controls: boolean = false
    export let transition: Transition = { type: "none", duration: 0, easing: "linear" }

    export let filter: string = ""
    export let flipped: boolean = false
    export let fit: MediaFit = "contain"

    export let video: any = null
    export let videoData: any = { paused: false, muted: true, duration: 0, loop: false }
    export let videoTime: number = 0
    export let startAt: number = 0
    export let mirror: boolean = false

    // get styling
    $: mediaId = $activeEdit.id || $activeShow?.id
    $: if (mediaId && $media[mediaId]) {
        // TODO: get local show styles?!
        filter = $media[mediaId]?.filter || ""
        flipped = $media[mediaId]?.flipped || false
        fit = $media[mediaId]?.fit || "contain"
    }

    $: extension = getExtension(path)
    $: type = getMediaType(extension)

    let video1: any = {}
    let video2: any = {}
    let videoTime1: number = 0
    let videoTime2: number = 0
    resetVideos()

    $: if (type === "video" && path) startVideoTransition()
    else resetVideos()

    function resetVideos() {
        video = null
        video1 = {
            active: false,
            video: null,
            path: "",
            data: {},
        }
        video2 = clone(video1)
        video1.active = true
    }

    $: if (videoData) updateVideo("data")
    function updateVideo(key) {
        if (video1.active) {
            if (key === "data") video1.data = videoData
            if (key === "time") videoTime1 = videoTime
        } else {
            if (key === "data") video2.data = videoData
            if (key === "time") videoTime2 = videoTime
        }
    }

    $: if (videoData.paused && videoTime !== undefined) updateVideo("time")
    $: video = video1.video || video2.video

    $: if (video1.data || video2.data) updateData("data")
    function updateData(key) {
        if (video1.active) {
            if (key === "data") videoData = video1.data
            // if (key === "time") videoTime = videoTime1
        } else {
            if (key === "data") videoData = video2.data
            // if (key === "time") videoTime = videoTime2
        }
    }
    // (videoTime1 !== undefined|| videoTime2 !== undefined)
    $: if (!videoData.paused) videoTime = video1.active ? videoTime1 : videoTime2
    let change: boolean = false

    async function startVideoTransition() {
        let playingVideo = video1.active ? video1 : video2

        let duration = transition.duration
        if (!duration || (!playingVideo.path && !playingVideo.video)) {
            resetVideos()
            video1.path = path
            video = video1.video
            return
        }

        let newVideo = video1.active ? video2 : video1
        newVideo.path = path
        // videoData.paused = true

        playingVideo.active = false
        newVideo.active = true
        change = true
        video = newVideo.video

        // await clearPlayingVideo(false)
        // videoData
        // if (video) video = null
        // videoData.paused = true

        setTimeout(() => {
            if (video1.active) {
                video2.path = ""
                videoTime2 = 0
            } else {
                video1.path = ""
                videoTime1 = 0
            }

            change = false
        }, duration + 100)
    }
</script>

{#if type === "video"}
    <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
    {#if transition.type === "none" && mirror}
        <div class="video">
            <Video {path} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} on:playing on:loaded />
        </div>
    {:else}
        {#if video1.active}
            <div class="video" class:change transition:custom={transition}>
                <Video path={video1.path} bind:video={video1.video} bind:videoData={video1.data} bind:videoTime={videoTime1} {startAt} {mirror} {filter} {flipped} {fit} on:playing on:loaded />
            </div>
        {/if}
        {#if video2.active}
            <div class="video" class:change transition:custom={transition}>
                <Video path={video2.path} bind:video={video2.video} bind:videoData={video2.data} bind:videoTime={videoTime2} {startAt} {mirror} {filter} {flipped} {fit} on:playing on:loaded />
            </div>
        {/if}
    {/if}
    {#if controls}
        <MediaControls bind:videoData bind:videoTime />
    {/if}
{:else}
    {#key path}
        <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
        {#if transition.type === "none"}
            <div style="height: 100%;">
                <Image {path} {filter} {flipped} {fit} />
            </div>
        {:else}
            <div style="height: 100%;" transition:custom={transition}>
                <Image {path} {filter} {flipped} {fit} />
            </div>
        {/if}
    {/key}
{/if}

<style>
    .video {
        height: 100%;
        transition: opacity 0.5s;
    }
    .change {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
    }
</style>
