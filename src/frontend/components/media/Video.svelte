<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { media } from "../../stores"
    import { enableSubtitle, encodeFilePath, isVideoSupported } from "../helpers/media"

    export let path: string
    export let video: HTMLVideoElement | null = null
    export let videoData: any
    export let videoTime: number
    export let startAt = 0

    export let mediaStyle: MediaStyle = {}
    export let animationStyle = ""
    export let mirror = false

    let dispatch = createEventDispatcher()

    let hasLoaded = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)
    }

    // Pingback after 30 playing seconds on videos where tracking is required
    let pingbackTime: number = 0
    let pingbackInterval: NodeJS.Timeout | null = null
    $: if (path && !mirror) setupPingback()
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

        fetch(pingbackUrl, { method: "GET", mode: "no-cors" }).catch(() => {})
    }

    onDestroy(() => {
        if (endInterval) clearInterval(endInterval)
        if (pingbackInterval) clearInterval(pingbackInterval)
    })

    // custom end time
    $: endTime = (mediaStyle.toTime || 0) - (mediaStyle.fromTime || 0) > 0 ? mediaStyle.toTime : 0
    let endInterval: NodeJS.Timeout | null = null
    $: if (endTime && !mirror && !endInterval) endInterval = setInterval(checkIfEnded, 1000 * playbackRate)
    function checkIfEnded() {
        if (!videoTime || !endTime) return
        if (videoTime >= endTime) {
            if (videoData.loop) videoTime = mediaStyle.fromTime || 0
            else dispatch("ended")
        }
    }

    function playing() {
        if (!hasLoaded || mirror) return
        hasLoaded = false

        // has custom start time
        if (Math.max(startAt, mediaStyle.fromTime || 0) || 0 === 0) return

        // go to custom start time
        videoData.paused = true
        setTimeout(() => {
            videoTime = Math.max(startAt, mediaStyle.fromTime || 0) || 0
            videoData.paused = false
            startAt = 0
        }, 50)
    }

    $: playbackRate = Number(mediaStyle.speed) || 1
    // $: audioVolume = Math.max(0, Math.min(1, $volume ?? 1))

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

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let blurVideo: HTMLVideoElement | null = null
    $: if (blurVideo && (videoTime < blurVideo.currentTime - 0.1 || videoTime > blurVideo.currentTime + 0.1)) blurVideo.currentTime = videoTime
    $: if (!videoData.paused && blurVideo?.paused) blurVideo.play()
    $: blurPausedState = videoData.paused

    // some videos don't like high playback speed (above 5.9)
    // https://issues.chromium.org/issues/40167938
</script>

<div style="display: flex;width: 100%;height: 100%;place-content: center;{animationStyle}">
    {#if mediaStyle.fit === "blur"}
        <video class="media" style={mediaStyleBlurString} src={encodeFilePath(path)} bind:playbackRate bind:this={blurVideo} bind:paused={blurPausedState} muted loop={videoData.loop || false} />
    {/if}
    <video
        class="media"
        style={mediaStyleString}
        bind:this={video}
        on:loadedmetadata={loaded}
        on:playing={playing}
        on:ended
        on:error
        bind:playbackRate
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        muted={mirror ? true : (videoData.muted ?? true)}
        src={encodeFilePath(path)}
        autoplay
        loop={videoData.loop || false}
    >
        <!-- bind:volume={audioVolume} -->
        {#each tracks as track}
            <track label={track.name} srclang={track.lang} kind="subtitles" src="data:text/vtt;charset=utf-8,{encodeURI(track.vtt)}" />
        {/each}
    </video>
</div>
