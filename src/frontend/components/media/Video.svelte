<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { volume } from "../../stores"

    export let path: any
    export let video: any
    export let videoData: any
    export let videoTime: any

    export let startAt: number = 0
    export let mirror: boolean = false

    export let mediaStyle: MediaStyle = {}

    export let animationStyle: string = ""

    let dispatch: any = createEventDispatcher()

    let hasLoaded: boolean = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)

        // if (!video) return

        // this don't work because video audio goes through audio context
        // if (!$special.audioOutput) return
        // try {
        //     video.setSinkId($special.audioOutput)
        // } catch (err) {
        //     console.error(err)
        // }
    }

    $: endTime = (mediaStyle.toTime || 0) - (mediaStyle.fromTime || 0) > 0 ? mediaStyle.toTime : 0
    $: if (endTime) setInterval(checkIfEnded, 1000)
    function checkIfEnded() {
        if (!video) return
        console.log(video.currentTime, video.currentTime >= endTime!)
        if (video.currentTime >= endTime!) dispatch("ended")
    }
    // $: if (endTime && videoTime >= endTime) endVideo()
    // function endVideo() {
    //     dispatch("ended")
    // }

    function playing() {
        if (!hasLoaded || mirror) return
        hasLoaded = false
        dispatch("playing", true)

        videoData.paused = true
        setTimeout(() => {
            videoTime = Math.max(startAt, mediaStyle.fromTime || 0) || 0
            videoData.paused = false
            startAt = 0
        }, 50)
    }

    $: if (mediaStyle.speed && video) video.playbackRate = Number(mediaStyle.speed)

    $: audioVolume = Math.max(0, Math.min(1, $volume ?? 1))
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
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        bind:volume={audioVolume}
        muted={mirror ? true : videoData.muted ?? true}
        src={path}
        autoplay
        loop={videoData.loop || false}
    >
        <track kind="captions" />
    </video>
</div>
