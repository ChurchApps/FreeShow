<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { media } from "../../stores"
    import { enableSubtitle, encodeFilePath, isVideoSupported } from "../helpers/media"

    export let path: string
    export let video: any = null
    export let videoData: any
    export let videoTime: any
    export let startAt: number = 0

    export let mediaStyle: MediaStyle = {}
    export let animationStyle: string = ""
    export let mirror: boolean = false

    let dispatch: any = createEventDispatcher()

    let hasLoaded: boolean = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)
    }

    // custom end time
    $: endTime = (mediaStyle.toTime || 0) - (mediaStyle.fromTime || 0) > 0 ? mediaStyle.toTime : 0
    let endInterval: any = null
    $: if (endTime && !mirror && !endInterval) endInterval = setInterval(checkIfEnded, 1000 * playbackRate)
    function checkIfEnded() {
        if (!videoTime || !endTime) return
        if (videoTime >= endTime!) {
            if (videoData.loop) videoTime = mediaStyle.fromTime || 0
            else dispatch("ended")
        }
    }

    function playing() {
        if (!hasLoaded || mirror) return
        hasLoaded = false

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

    // path starting at "/" auto completes to app root, but should be file://
    $: if (path?.[0] === "/") path = `file://${path}`

    $: isVideoSupported(path)

    $: subtitle = $media[path]?.subtitle
    $: tracks = $media[path]?.tracks || []
    $: if (video && subtitle !== undefined) updateSubtitles()
    // don't change rapidly
    let subtitleChange: any = null
    function updateSubtitles() {
        if (subtitleChange) clearTimeout(subtitleChange)
        subtitleChange = setTimeout(() => {
            if (subtitle !== undefined) enableSubtitle(video, subtitle)
            subtitleChange = null
        }, 20)
    }
</script>

<div style="display: flex;width: 100%;height: 100%;place-content: center;{animationStyle}">
    <video
        class="media"
        style="width: 100%;height: 100%;object-fit: {mediaStyle.fit};filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});"
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
