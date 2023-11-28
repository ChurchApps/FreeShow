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

    function playing() {
        if (!hasLoaded || mirror) return
        hasLoaded = false
        dispatch("playing", true)

        videoData.paused = true
        setTimeout(() => {
            videoTime = startAt || 0
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
        style="width: 100%;height: 100%;object-fit: {mediaStyle.fit};filter: {mediaStyle.filter || ''};{mediaStyle.flipped ? 'transform: scaleX(-1);' : ''}"
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
