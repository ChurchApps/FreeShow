<script lang="ts">
    import { onMount } from "svelte"
    import type { MediaStyle } from "../../../../types/Main"
    import type { Resolution } from "../../../../types/Settings"
    import type { MediaType, ShowType } from "../../../../types/Show"
    import { outputs, styles } from "../../../stores"
    import { encodeFilePath, getExtension } from "../../helpers/media"
    import { getResolution } from "../../helpers/output"
    import Camera from "../../output/Camera.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Capture from "../live/Capture.svelte"
    import { videoExtensions } from "../../../values/extensions"

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
    export let ghost: boolean = false
    export let videoElem: any = null

    $: if (path) loaded = false

    let width: number = 0
    let height: number = 0

    // type
    $: if (!type && path) {
        const extension = getExtension(path)
        if (videoExtensions.includes(extension)) type = "video"
    }

    $: customResolution = resolution || getResolution(null, { $outputs, $styles })

    $: if (mediaStyle.speed && videoElem) videoElem.playbackRate = mediaStyle.speed

    $: if (!videoElem) duration = 0
    function getCurrentDuration() {
        if (!videoElem || duration === videoElem.duration) return

        duration = videoElem.duration

        // set video time
        if (hover || !useOriginal) return
        videoElem.currentTime = duration / 2
    }

    // retry on error
    let retryCount = 0
    const MAX_RETRIES = 3
    $: if (path || thumbnailPath) retryCount = 0
    function reload() {
        if (ghost) return

        if (retryCount > MAX_RETRIES) {
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

    $: useOriginal = hover || loadFullImage || retryCount > MAX_RETRIES || !thumbnailPath

    // get duration
    $: if (getDuration && type === "video" && thumbnailPath) getVideoDuration()
    function getVideoDuration() {
        if (ghost) return

        setTimeout(() => {
            let video = document.createElement("video")
            video.onloadeddata = () => {
                duration = video.duration || 0
                // video.pause()
                video.src = ""
            }
            video.src = encodeFilePath(path)
        }, 20)
    }

    $: mediaStyleString = `pointer-events: none;position: absolute;width: 100%;height: 100%;filter: ${mediaStyle.filter || ""};object-fit: ${mediaStyle.fit || "contain"};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let readyToLoad: boolean = false
    onMount(() => {
        // sometimes the img elem loaded before "loaded" was set to false, causing it to load twice!
        readyToLoad = true
    })
</script>

<div class="main" style="aspect-ratio: {customResolution.width}/{customResolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#key path}
        {#if type === "camera"}
            <div bind:clientWidth={width} bind:clientHeight={height} style="height: 100%;">
                <Camera id={path} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem />
            </div>
        {:else if type === "screen"}
            <Capture screen={{ id: path, name }} streams={[]} background />
        {:else if readyToLoad}
            {#if ghost && !thumbnailPath}
                <!-- show nothing if ghost without thumbnail -->
            {:else if type !== "video" || (thumbnailPath && retryCount <= MAX_RETRIES)}
                {#key retryCount}
                    <img
                        src={type !== "video" && useOriginal ? encodeFilePath(path) : thumbnailPath}
                        alt={name}
                        style={mediaStyleString}
                        loading="lazy"
                        class:loading={!loaded}
                        class:hideError={ghost}
                        on:error={reload}
                        on:load={() => (loaded = true)}
                    />
                {/key}
            {/if}
            {#if type === "video" && useOriginal && !ghost}
                <video style={mediaStyleString} bind:this={videoElem} on:error={reload} src={encodeFilePath(path)} on:canplaythrough={getCurrentDuration}>
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
        opacity: 0;
        position: absolute;
        pointer-events: none;
    }

    img.hideError {
        color: transparent;
    }

    /* canvas,
  .main :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  } */
</style>
