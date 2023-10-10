<script lang="ts">
    import type { MediaFit } from "../../../types/Main"
    import type { Transition } from "../../../types/Show"
    import { activeEdit, activeShow, media, playingVideos } from "../../stores"
    import { custom } from "../../utils/transitions"
    import { clone } from "../helpers/array"
    import { getExtension, getMediaType } from "../helpers/media"
    import { setOutput } from "../helpers/output"
    import Image from "./Image.svelte"
    import MediaControls from "./MediaControls.svelte"
    import Video from "./Video.svelte"

    export let path: string
    export let currentStyle: any = {}
    export let animationStyle: string = ""
    export let controls: boolean = false
    export let transition: Transition = { type: "none", duration: 0, easing: "linear" }

    export let filter: string = ""
    export let flipped: boolean = false
    export let fit: MediaFit = "contain"
    export let speed: string = "1"

    export let video: any = null
    export let videoData: any = { paused: false, muted: true, duration: 0, loop: false }
    export let videoTime: number = 0
    export let startAt: number = 0
    export let mirror: boolean = false

    // TODO: this will override preview, if play without filters is active and editing media:
    // get styling
    $: mediaId = $activeEdit.id && $activeEdit.type === "media" ? $activeEdit.id : $activeShow?.id && ($activeShow.type === "image" || $activeShow.type === "video") ? $activeShow.id : ""
    $: if (mediaId && ($media[mediaId] || currentStyle)) {
        filter = $media[mediaId]?.filter || ""
        flipped = $media[mediaId]?.flipped || false
        fit = currentStyle?.fit || $media[mediaId]?.fit || "contain"
        speed = $media[mediaId]?.speed || "1"
    }

    $: extension = getExtension(path)
    $: type = getMediaType(extension)

    let video1: any = {}
    let video2: any = {}
    let videoTime1: number = 0
    let videoTime2: number = 0

    // initialize
    resetData()
    function resetData() {
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

    $: if (type === "video" && path && !noTransitions) startVideoTransition()
    else resetData()

    function resetVideos() {
        // WIP console.log("PREVIEW RESET")
        if (videoData.loop) return
        let currentBackgroundId = path

        resetData()

        setTimeout(() => {
            // TODO: this is clearing when going from video to video sometimes
            console.log("PATH", currentBackgroundId, path)
            if (type === "video" && path && currentBackgroundId !== path) return
            playingVideos.set([])

            videoTime = 0
            videoTime1 = 0
            videoTime2 = 0

            if (path) return

            // preview tools Media.svelte
            setOutput("background", null)
            // videoTime = 0
            // send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: 0 })
            // if (currentOutput.keyOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: currentOutput.keyOutput, time: 0 })

            // videoData = {
            //     duration: 0,
            //     paused: true,
            //     muted: false,
            //     loop: false,
            // }

            // clearPlayingVideo()
        }, 500)
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
    $: if (video1.video || video2.video) {
        if (!path && video === null) resetData()
        else video = video1.active ? video1.video : video2.video
    }

    $: if (video1.data || video2.data) updateData("data")
    function updateData(key) {
        if (video1.active) {
            if (!Object.keys(video1.data).length) return
            if (key === "data") videoData = video1.data
            // if (key === "time") videoTime = videoTime1
        } else {
            if (!Object.keys(video2.data).length) return
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
            resetData()
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

    $: noTransitions = transition.type === "none" && mirror

    // change images
    let img1 = { active: true, path: "" }
    let img2 = { active: false, path: "" }
    let removeTimeout: any = null
    $: if (path && type !== "video") changeImage()
    else {
        img1 = { active: true, path: "" }
        img2 = { active: false, path: "" }
    }

    function changeImage() {
        if (removeTimeout) clearTimeout(removeTimeout)

        if (img1.active) {
            img1.active = false
            img2 = { active: true, path }
        } else {
            img2.active = false
            img1 = { active: true, path }
        }

        removeTimeout = setTimeout(
            () => {
                removeTimeout = null
            },
            transition.type === "none" ? 0 : transition.duration
        )
    }

    function imageLoaded() {
        if (img1.active) img2.path = ""
        else img1.path = ""
    }
</script>

{#if type === "video"}
    <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
    {#key retryCount}
        {#if noTransitions}
            {#if path}
                <div class="video">
                    <Video {path} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} {speed} {animationStyle} on:playing on:loaded on:ended={() => resetVideos()} on:error={reload} />
                </div>
            {/if}
        {:else}
            {#if video1.active && video1.path}
                <div class="video" class:change transition:custom={transition}>
                    <Video
                        path={video1.path}
                        bind:video={video1.video}
                        bind:videoData={video1.data}
                        bind:videoTime={videoTime1}
                        {startAt}
                        {mirror}
                        {filter}
                        {flipped}
                        {fit}
                        {speed}
                        {animationStyle}
                        on:playing
                        on:loaded
                        on:ended={() => resetVideos()}
                        on:error={reload}
                    />
                </div>
            {/if}
            {#if video2.active && video2.path}
                <div class="video" class:change transition:custom={transition}>
                    <Video
                        path={video2.path}
                        bind:video={video2.video}
                        bind:videoData={video2.data}
                        bind:videoTime={videoTime2}
                        {startAt}
                        {mirror}
                        {filter}
                        {flipped}
                        {fit}
                        {speed}
                        {animationStyle}
                        on:playing
                        on:loaded
                        on:ended={() => resetVideos()}
                        on:error={reload}
                    />
                </div>
            {/if}
        {/if}
    {/key}

    {#if controls}
        <MediaControls bind:videoData bind:videoTime />
    {/if}
{:else}
    {#key retryCount}
        <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
        {#if noTransitions}
            {#if path}
                <div style="height: 100%;{animationStyle}">
                    <Image {path} {filter} {flipped} {fit} on:error={reload} />
                </div>
            {/if}
        {:else}
            {#if img1.path}
                <div class="change">
                    <div style="height: 100%;{animationStyle}" transition:custom={transition}>
                        <Image path={img1.path} {filter} {flipped} {fit} on:error={reload} on:load={imageLoaded} />
                    </div>
                </div>
            {/if}
            {#if img2.path}
                <div class="change">
                    <div style="height: 100%;{animationStyle}" transition:custom={transition}>
                        <Image path={img2.path} {filter} {flipped} {fit} on:error={reload} on:load={imageLoaded} />
                    </div>
                </div>
            {/if}
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

    /* .hide {
        opacity: 0;
    } */
</style>
