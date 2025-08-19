<script lang="ts">
    import { onMount } from "svelte"
    import type { MediaStyle } from "../../../../types/Main"
    import type { Resolution } from "../../../../types/Settings"
    import type { MediaType, ShowType } from "../../../../types/Show"
    import { outputs, styles } from "../../../stores"
    import { videoExtensions } from "../../../values/extensions"
    import { cropImageToBase64, encodeFilePath, getExtension } from "../../helpers/media"
    import { getResolution } from "../../helpers/output"
    import Camera from "../../output/Camera.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Capture from "../live/Capture.svelte"
    import NdiStream from "../live/NDIStream.svelte"

    export let name = ""
    export let path: string
    export let thumbnailPath = ""
    export let loadFullImage = false
    export let cameraGroup = ""
    export let mediaStyle: MediaStyle = {}
    export let type: null | MediaType | ShowType = null
    export let hover = false
    export let loaded = false
    export let resolution: Resolution | null = null
    export let duration = 0
    export let getDuration = false
    export let ghost = false
    export let videoElem: HTMLVideoElement | null = null

    $: if (path) loaded = false

    let width = 0
    let height = 0

    // type
    $: if (!type && path) {
        const extension = getExtension(path)
        if (videoExtensions.includes(extension)) type = "video"
    }

    $: customResolution = resolution || getResolution(null, { $outputs, $styles })

    $: if (mediaStyle.speed && videoElem) videoElem.playbackRate = Number(mediaStyle.speed || 0)

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
        if (ghost || croppingActive) return

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

    $: mediaStyleString = `pointer-events: none;position: absolute;width: 100%;height: 100%;filter: ${mediaStyle.filter || ""};object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `filter: ${mediaStyle.filter || ""} blur(4px) opacity(0.3);object-fit: cover;pointer-events: none;position: absolute;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`

    let readyToLoad = false
    onMount(() => {
        // sometimes the img elem loaded before "loaded" was set to false, causing it to load twice!
        readyToLoad = true
    })

    let croppedImage = ""
    $: croppingActive = mediaStyle.cropping?.bottom || mediaStyle.cropping?.left || mediaStyle.cropping?.top || mediaStyle.cropping?.right
    $: if (croppingActive) cropImage()
    async function cropImage() {
        croppedImage = await cropImageToBase64(path, mediaStyle.cropping)
        if (croppedImage) useOriginal = true
    }
</script>

<div class="main" style="aspect-ratio: {customResolution.width}/{customResolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#key path}
        {#if type === "camera"}
            <div bind:clientWidth={width} bind:clientHeight={height} style="height: 100%;">
                <Camera id={path} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem />
            </div>
        {:else if type === "screen"}
            <Capture screen={{ id: path, name }} streams={[]} background />
        {:else if type === "ndi"}
            <NdiStream screen={{ id: path, name }} background />
        {:else if readyToLoad}
            {#if ghost && !thumbnailPath}
                <!-- show nothing if ghost without thumbnail -->
            {:else if type !== "video" || (thumbnailPath && retryCount <= MAX_RETRIES)}
                {#key retryCount}
                    {#if mediaStyle.fit === "blur"}
                        <img src={type !== "video" && useOriginal ? (croppingActive ? croppedImage : encodeFilePath(path)) : thumbnailPath} alt={name} style={mediaStyleBlurString} loading="lazy" class:loading={!loaded} class="hideError" />
                    {/if}
                    <img
                        src={type !== "video" && useOriginal ? (croppingActive ? croppedImage : encodeFilePath(path)) : thumbnailPath}
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
                {#if mediaStyle.fit === "blur"}
                    <video style={mediaStyleBlurString} src={encodeFilePath(path)} muted>
                        <track kind="captions" />
                    </video>
                {/if}
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

        overflow: hidden;
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
