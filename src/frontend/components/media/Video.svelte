<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { MediaFit } from "../../../types/Main"
    import { volume } from "../../stores"
    import { getStyleResolution } from "../slide/getStyleResolution"

    export let path: any
    export let video: any
    export let videoData: any
    export let videoTime: any

    export let startAt: number = 0
    export let mirror: boolean = false

    export let filter: string = ""
    export let flipped: boolean = false
    export let fit: MediaFit = "contain"
    export let speed: string = "1"

    let dispatch: any = createEventDispatcher()
    let width: number = 0
    let height: number = 0

    let hasLoaded: boolean = false
    function loaded() {
        hasLoaded = true
        dispatch("loaded", true)
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

    $: if (speed && video) video.playbackRate = Number(speed)
</script>

<div style="display: flex;width: 100%;height: 100%;place-content: center;" bind:clientWidth={width} bind:clientHeight={height}>
    <video
        class="media"
        style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, fit)};filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}"
        bind:this={video}
        on:loadedmetadata={loaded}
        on:playing={playing}
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        bind:volume={$volume}
        muted={mirror ? true : videoData.muted}
        src={path}
        autoplay
        loop={videoData.loop || false}
    >
        <track kind="captions" />
    </video>
</div>
