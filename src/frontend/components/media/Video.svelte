<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { currentWindow, media, renderGroups } from "../../stores"
    import { enableSubtitle, encodeFilePath, isVideoSupported } from "../helpers/media"
    import { findGroupRendererId, getMirrorVideo, MirrorCloneDrawer, MirrorRegistration, mirrorRegistryTick, mirrorVideoKey } from "./video/mirrorVideoRegistry"
    import { SoftLoopSync } from "./video/softLoop"
    import { clampPlaybackRate, syncVideoToAudio, videoSync } from "./video/videoSync"

    export let outputId: string
    export let path: string
    export let syncPath: string = ""
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

    // Follower mirrors paint renderer frames to canvas instead of redundant decoding
    $: groupRendererId = mirror && !$currentWindow ? findGroupRendererId($renderGroups, outputId) : null
    $: cloneSource = groupRendererId && $mirrorRegistryTick >= 0 ? getMirrorVideo(mirrorVideoKey(groupRendererId, path)) : null

    const mirrorRegistration = new MirrorRegistration()
    $: mirrorRegistration.update(mirror && !$currentWindow && video && !cloneSource ? mirrorVideoKey(outputId, path) : null, video, !!cloneSource)
    onDestroy(() => mirrorRegistration.destroy())

    let cloneCanvas: HTMLCanvasElement | null = null
    const cloneDrawer = new MirrorCloneDrawer()
    $: cloneDrawer.setFit(mediaStyle.fit)
    $: if (cloneCanvas && cloneSource) {
        cloneDrawer.start(cloneCanvas, cloneSource)
        loaded()
    } else cloneDrawer.stop()
    onDestroy(() => cloneDrawer.stop())

    let unsubscribeSync: (() => void) | null = null
    $: {
        unsubscribeSync?.()
        const targetPath = syncPath || path
        if (targetPath && outputId) {
            let lastSyncedTime: number | null = null
            unsubscribeSync = videoSync(targetPath, outputId, (data) => {
                const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
                syncVideoToAudio(video, data.currentTime, lastSyncedTime, isSoftLoop, targetPlaybackRate, data.isFadingOut, data.virtualClock)
                if (data.currentTime !== undefined) lastSyncedTime = data.currentTime

                if (videoData.loop !== data.loop) videoData.loop = data.loop
                if (videoData.paused !== data.paused) videoData.paused = data.paused

                if (data.softLoop !== undefined && videoData.softLoop !== data.softLoop) videoData.softLoop = data.softLoop
                if (data.softLoopOpacity !== undefined && softLoopOpacity !== data.softLoopOpacity) softLoopOpacity = data.softLoopOpacity
                softLoopAudioTime = data.currentTime
            })
        }
    }

    onMount(() => {
        if (!container) return

        const w = container.clientWidth
        const h = container.clientHeight
        containerAspect = w && h ? w / h : null
    })

    let hasLoaded = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)
    }

    // ensure that video state matches the store state
    $: if (video) {
        if (!videoData.paused && video.paused && !video.error) {
            video.play().catch((err) => {
                if (err.name !== "AbortError") {
                    console.warn("[Video.svelte] Play failed:", err)
                }
            })
        } else if (videoData.paused && !video.paused) {
            video.pause()
        }
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
        unsubscribeSync?.()
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

    function playing() {
        if (!hasLoaded || mirror) return
        hasLoaded = false

        // has custom start time
        const customStart = Math.max(startAt, mediaStyle.fromTime || 0) || 0
        if (customStart === 0) return

        // go to custom start time
        videoTime = customStart
        startAt = 0
    }

    $: targetPlaybackRate = Number(mediaStyle.speed) || 1
    // Apply the target rate reactively, but only when not mid-nudge (the sync function manages
    // the actual video.playbackRate during nudging; setting it here only when the rate changes
    // avoids fighting the nudge on every reactive tick).
    $: safeTargetPlaybackRate = clampPlaybackRate(targetPlaybackRate)
    let _lastAppliedRate = 1
    $: if (video && safeTargetPlaybackRate !== _lastAppliedRate) {
        // Only hard-apply if the difference is meaningful (not a nudge artifact)
        _lastAppliedRate = safeTargetPlaybackRate
        if (video.playbackRate !== safeTargetPlaybackRate) video.playbackRate = safeTargetPlaybackRate
    }
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
    $: if (blurVideo) {
        if (!videoData.paused && blurVideo.paused && !blurVideo.error) {
            blurVideo.play().catch(() => {})
        } else if (videoData.paused && !blurVideo.paused) {
            blurVideo.pause()
        }
    }
    $: if (blurVideo && blurVideo.playbackRate !== safeTargetPlaybackRate) blurVideo.playbackRate = safeTargetPlaybackRate

    // update computed aspects and determine whether the blurred video is necessary
    $: videoAspect = video && video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : null
    // 1% tolerance
    $: perfectFit = containerAspect && videoAspect ? Math.abs(containerAspect - videoAspect) <= 0.01 : false

    // Soft loop

    $: softLoopValue = videoData.softLoop ?? mediaStyle.softLoop ?? 0
    $: fromTime = mediaStyle.fromTime || 0
    $: toTime = mediaStyle.toTime || 0

    const softLoopSync = new SoftLoopSync()
    onDestroy(() => softLoopSync.destroy())

    let softLoopAudioTime: number | undefined
    $: effectiveSoftLoopOpacity = softLoopSync.update(softLoopOpacity, videoTime, fromTime, softLoopValue, video, softLoopVideo, videoData.paused, toTime, softLoopAudioTime)
    $: if (softLoopVideo && softLoopVideo.playbackRate !== safeTargetPlaybackRate) softLoopVideo.playbackRate = safeTargetPlaybackRate
</script>

<div bind:this={container} style="display: flex;width: 100%;height: 100%;place-content: center;{animationStyle}">
    {#if cloneSource}
        <canvas class="media" style="width: 100%;height: 100%;filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});" bind:this={cloneCanvas} />
    {:else}
        {#if mediaStyle.fit === "blur" && !perfectFit}
            <video class="media" style={mediaStyleBlurString} src={encodeFilePath(path)} bind:this={blurVideo} muted loop={videoData.loop} />
        {/if}
        <video class="media" style={mediaStyleString} bind:this={video} on:loadedmetadata={loaded} on:playing={playing} on:error bind:currentTime={videoTime} muted src={encodeFilePath(path)} loop={videoData.loop}>
            {#each tracks as track}
                <track label={track.name} srclang={track.lang} kind="subtitles" src="data:text/vtt;charset=utf-8,{encodeURI(track.vtt)}" />
            {/each}
        </video>
        {#if softLoopValue > 0 && videoData.loop}
            <video class="media" style="{mediaStyleString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: {effectiveSoftLoopOpacity};pointer-events: none;" bind:this={softLoopVideo} src={encodeFilePath(path)} muted loop={videoData.loop} />
        {/if}
    {/if}
</div>
