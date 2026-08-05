<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { currentWindow, media } from "../../stores"
    import { waitUntilValueIsDefined } from "../../utils/common"
    import { enableSubtitle, encodeFilePath, isVideoSupported } from "../helpers/media"
    import { shouldSyncVideoTime, videoSync } from "./video/videoSync"
    import { SoftLoopSync } from "./video/softLoop"

    export let outputId: string
    export let path: string
    export let video: HTMLVideoElement | null = null
    export let videoData: any = { paused: false, loop: false, softLoop: 0 }
    export let videoTime: number = 0
    export let startAt = 0

    export let mediaStyle: MediaStyle = {}
    export let animationStyle = ""
    export let mirror = false

    let dispatch = createEventDispatcher()

    // values for deciding whether we need the blurred video overlay
    let container: HTMLDivElement | null = null
    let containerAspect: number | null = null
    let videoAspect: number | null = null
    let perfectFit = false

    let softLoopVideo: HTMLVideoElement | null = null
    let softLoopOpacity = 0

    onMount(async () => {
        await waitUntilValueIsDefined(() => ready)

        let lastSyncedTime: number | null = null

        const unsubscribe = videoSync(path, outputId, (data) => {
            const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
            if (shouldSyncVideoTime(video, data.currentTime, lastSyncedTime, isSoftLoop)) {
                video!.currentTime = data.currentTime
            }
            if (data.currentTime !== undefined) lastSyncedTime = data.currentTime

            videoData.loop = data.loop
            videoData.paused = data.paused

            if (data.softLoop !== undefined) videoData.softLoop = data.softLoop
            if (data.softLoopOpacity !== undefined) softLoopOpacity = data.softLoopOpacity
        })

        if (!container) return

        const w = container.clientWidth
        const h = container.clientHeight
        containerAspect = w && h ? w / h : null

        return () => {
            unsubscribe?.()
        }
    })

    let hasLoaded = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)
    }

    // Pingback after 30 playing seconds on videos where tracking is required
    let pingbackTime = 0
    let pingbackInterval: NodeJS.Timeout | null = null
    $: if (path && !$currentWindow) setupPingback()
    function setupPingback() {
        pingbackTime = 0
        if (pingbackInterval) clearInterval(pingbackInterval)

        pingbackInterval = setInterval(() => {
            if (videoData.paused) return

            pingbackTime++
            if (pingbackTime < 30) return

            if (pingbackInterval) clearInterval(pingbackInterval)
            sendPingback()
        }, 1000)
    }
    function sendPingback() {
        const pingbackUrl = $media[path]?.pingbackUrl
        if (!pingbackUrl) return

        console.log(`[Provider] Sending pingback after 30s playback:`, { url: pingbackUrl, method: "GET", path: path })
        fetch(pingbackUrl, { method: "GET", mode: "no-cors" })
            .then(() => console.log(`[Provider] Pingback sent successfully to: ${pingbackUrl}`))
            .catch((error) => {
                console.error(`[Provider] Pingback failed:`, error)
            })
    }

    onDestroy(() => {
        // if (endInterval) clearInterval(endInterval)
        if (pingbackInterval) clearInterval(pingbackInterval)

        const cleanupVideo = (el: HTMLVideoElement | null | undefined) => {
            if (!el) return
            try {
                el.pause()
                el.removeAttribute("src")
                el.load()
            } catch (e) {
                console.error("Error cleaning up video element:", e)
            }
        }

        cleanupVideo(video)
        cleanupVideo(blurVideo)
        cleanupVideo(softLoopVideo)
    })

    let ready = false
    function playing() {
        ready = true

        if (!hasLoaded || mirror) return
        hasLoaded = false

        // has custom start time
        if ((Math.max(startAt, mediaStyle.fromTime || 0) || 0) === 0) return

        // go to custom start time
        const alreadyPaused = videoData.paused
        if (!alreadyPaused) videoData.paused = true
        setTimeout(() => {
            videoTime = Math.max(startAt, mediaStyle.fromTime || 0) || 0
            if (!alreadyPaused) videoData.paused = false
            startAt = 0
        }, 50)
    }

    $: playbackRate = Number(mediaStyle.speed) || 1
    $: if (video) video.preservesPitch = true

    $: isVideoSupported(path)

    $: subtitle = $media[path]?.subtitle
    $: tracks = $media[path]?.tracks || []
    $: if (video && subtitle !== undefined) updateSubtitles()
    // don't change rapidly
    let subtitleChange: NodeJS.Timeout | null = null
    function updateSubtitles() {
        if (subtitleChange) clearTimeout(subtitleChange)
        subtitleChange = setTimeout(() => {
            if (subtitle !== undefined && video) enableSubtitle(video, subtitle)
            subtitleChange = null
        }, 20)
    }

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});mix-blend-mode: ${mediaStyle.blend || "normal"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let blurVideo: HTMLVideoElement | null = null
    $: if (blurVideo && (videoTime < blurVideo.currentTime - 0.1 || videoTime > blurVideo.currentTime + 0.1)) blurVideo.currentTime = videoTime
    $: if (!videoData.paused && blurVideo?.paused) blurVideo.play()
    $: blurPausedState = videoData.paused

    // update computed aspects and determine whether the blurred video is necessary
    $: videoAspect = video && video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : null
    // 1% tolerance
    $: perfectFit = containerAspect && videoAspect ? Math.abs(containerAspect - videoAspect) <= 0.01 : false

    // Soft loop

    $: softLoopValue = videoData.softLoop ?? mediaStyle.softLoop ?? 0
    $: fromTime = mediaStyle.fromTime || 0

    const softLoopSync = new SoftLoopSync()
    onDestroy(() => softLoopSync.destroy())

    $: effectiveSoftLoopOpacity = softLoopSync.update(softLoopOpacity, videoTime, fromTime, softLoopValue, video, softLoopVideo, videoData.paused)
</script>

<div bind:this={container} style="display: flex;width: 100%;height: 100%;place-content: center;{animationStyle}">
    {#if mediaStyle.fit === "blur" && !perfectFit}
        <video class="media" style={mediaStyleBlurString} src={encodeFilePath(path)} bind:playbackRate bind:this={blurVideo} bind:paused={blurPausedState} muted loop={videoData.loop || false} />
    {/if}
    <video class="media" style={mediaStyleString} bind:this={video} on:loadedmetadata={loaded} on:playing={playing} on:error bind:playbackRate bind:currentTime={videoTime} bind:paused={videoData.paused} muted src={encodeFilePath(path)} autoplay loop={videoData.loop}>
        {#each tracks as track}
            <track label={track.name} srclang={track.lang} kind="subtitles" src="data:text/vtt;charset=utf-8,{encodeURI(track.vtt)}" />
        {/each}
    </video>
    {#if softLoopValue > 0 && videoData.loop}
        <video class="media" style="{mediaStyleString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: {effectiveSoftLoopOpacity};pointer-events: none;" bind:this={softLoopVideo} src={encodeFilePath(path)} muted loop={videoData.loop} bind:playbackRate />
    {/if}
</div>
