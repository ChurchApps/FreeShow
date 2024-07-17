<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { Resolution } from "../../../../types/Settings"
    import type { MediaType, ShowType } from "../../../../types/Show"

    import { outputs, styles, videoExtensions } from "../../../stores"
    import { getExtension } from "../../helpers/media"
    import { getResolution } from "../../helpers/output"
    import Camera from "../../output/Camera.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Capture from "../live/Capture.svelte"

    export let name: any = ""
    export let path: string
    export let thumbnailPath: string = ""
    export let loadFullImage: boolean = false
    export let cameraGroup: string = ""
    export let mediaStyle: MediaStyle = {}
    export let type: null | MediaType | ShowType = null
    export let hover: boolean = false
    export let loaded: boolean = false
    export let resolution: Resolution | null = null
    export let duration: number = 0
    export let getDuration: boolean = false
    export let videoElem: any = null

    $: if (path) loaded = false

    let width: number = 0
    let height: number = 0

    // type
    $: if (!type && path) {
        const extension = getExtension(path)
        if ($videoExtensions.includes(extension)) type = "video"
    }

    $: customResolution = resolution || getResolution(null, { $outputs, $styles })

    $: if (mediaStyle.speed && videoElem) videoElem.playbackRate = mediaStyle.speed

    $: if (!videoElem) duration = 0
    function getCurrentDuration() {
        if (!videoElem || duration) return

        duration = videoElem.duration

        // set video time
        if (hover || !useOriginal) return
        videoElem.currentTime = duration / 2
    }

    // retry on error
    let retryCount = 0
    $: if (path || thumbnailPath) retryCount = 0
    function reload() {
        if (retryCount > 5) {
            loaded = true
            return
        }
        loaded = false

        let time = 500 * (retryCount + 1)
        setTimeout(() => {
            retryCount++
        }, time)
    }

    // path starting at "/" auto completes to app root, but should be file://
    $: if (path[0] === "/") path = `file://${path}`

    $: useOriginal = hover || loadFullImage || retryCount > 5 || !thumbnailPath

    // get duration
    $: if (getDuration && type === "video" && thumbnailPath) getVideoDuration()
    function getVideoDuration() {
        setTimeout(() => {
            let video = document.createElement("video")
            video.onloadeddata = () => {
                duration = video.duration || 0
                // video.pause()
                video.src = ""
            }
            video.src = path
        }, 20)
    }

    $: mediaStyleString = `pointer-events: none;position: absolute;width: 100%;height: 100%;filter: ${mediaStyle.filter || ""};object-fit: ${mediaStyle.fit || "contain"};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

<div class="main" style="aspect-ratio: {customResolution.width}/{customResolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#key path}
        {#if type === "camera"}
            <div bind:clientWidth={width} bind:clientHeight={height} style="height: 100%;">
                <!-- TODO: media height -->
                <Camera id={path} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem />
            </div>
        {:else if type === "screen"}
            <Capture screen={{ id: path, name }} streams={[]} background />
        {:else}
            {#if type !== "video" || (thumbnailPath && retryCount <= 5)}
                {#key retryCount}
                    <img src={type !== "video" && useOriginal ? path : thumbnailPath} alt={name} style={mediaStyleString} loading="lazy" class:loading={!loaded} on:error={reload} on:load={() => (loaded = true)} />
                {/key}
            {/if}
            {#if type === "video" && useOriginal}
                <video style={mediaStyleString} bind:this={videoElem} on:error={reload} src={path} on:canplaythrough={getCurrentDuration}>
                    <track kind="captions" />
                </video>
            {/if}
        {/if}
    {/key}
</div>

<style>
    .main {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    img {
        line-break: anywhere;
    }

    img.loading {
        display: none;
    }

    /* canvas,
  .main :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  } */
</style>
