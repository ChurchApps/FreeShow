<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { Resolution } from "../../../../types/Settings"

    import { mediaCache, outputs, styles, videoExtensions } from "../../../stores"
    import { getExtension } from "../../helpers/media"
    import { getResolution } from "../../helpers/output"
    import Camera from "../../output/Camera.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Capture from "../live/Capture.svelte"
    // import Image from "./Image.svelte"

    export let name: any = ""
    export let path: string
    export let loadFullImage: boolean = false
    export let cameraGroup: string = ""
    export let mediaStyle: MediaStyle = {}
    export let type: null | "media" | "image" | "video" | "camera" | "screen" | "audio" = null
    export let hover: boolean = false
    export let loaded: boolean = false
    export let resolution: Resolution | null = null
    export let duration: number = 0
    export let videoElem: any = null
    export let ghost: boolean = false

    // TODO: update
    $: if ((!type || type === "image") && canvas) {
        duration = 0

        // image cache
        loadImage()
    }

    // const thumbnailSize = { width: 1920, height: 1080 }
    const thumbnailSize = { width: 480, height: 270 }
    // const thumbnailSize = { width: 320, height: 180 }
    // const thumbnailSize = {width: 240, height: 135}
    // const thumbnailSize = { width: 160, height: 90 }
    // const thumbnailSize = { width: 80, height: 45 }
    let storedSize: any = {}

    function loadImage() {
        img = new Image()

        let cache = $mediaCache[path]
        let src: string = path
        if (cache) src = cache.data

        img.src = src
        canvas.width = cache ? cache.size?.width || cache.width || 160 : thumbnailSize.width
        canvas.height = cache ? cache.size?.height || cache.height || 90 : thumbnailSize.height

        storedSize = cache ? cache.size || { width: cache.width, height: cache.height } : {}

        if (cache) checkIfCacheLoaded()
        else checkIfLoaded()
    }

    let img: any = null
    function checkIfLoaded(): any {
        if (!img.complete) return setTimeout(checkIfLoaded, 100)

        let width = img.naturalWidth || thumbnailSize.width
        let height = img.naturalHeight || thumbnailSize.height
        let x = 0
        let y = 0

        if (width / height > customResolution.width / customResolution.height) {
            height = height / (width / thumbnailSize.width)
            width = thumbnailSize.width
            y = (thumbnailSize.height - height) / 2
        } else {
            width = width / (height / thumbnailSize.height)
            height = thumbnailSize.height
            x = (thumbnailSize.width - width) / 2
        }

        // canvas?.getContext("2d").drawImage(img, 0, 0, 160, 90)
        setTimeout(() => {
            canvas?.getContext("2d").drawImage(img, x, y, width, height)
            setTimeout(() => {
                if (canvas) {
                    mediaCache.update((a) => {
                        a[path] = { data: canvas.toDataURL(), size: { width, height } }
                        // a[path] = { data: canvas.toDataURL(), width, height, x, y }
                        return a
                    })
                    // canvas?.getContext("2d").clearRect(0, 0, 160, 90)
                    // cavas?.getContext("2d").drawImage(img, x, y, width, height)

                    loaded = true
                }
            }, 100)
        }, 50)
    }

    function checkIfCacheLoaded(): any {
        if (!img.complete) return setTimeout(checkIfCacheLoaded, 100)

        // let cache = $mediaCache[path]
        // canvas?.getContext("2d").drawImage(img, cache.x, cache.y, cache.width, cache.height)
        canvas?.getContext("2d").drawImage(img, 0, 0, storedSize.width || 160, storedSize.height || 90)
        loaded = true
    }

    // type
    $: if (!type && path) {
        const extension = getExtension(path)
        if ($videoExtensions.includes(extension)) type = "video"
    }

    $: if (path) loaded = false

    let canvas: any

    let time = false
    function ready() {
        if (loaded || !videoElem) return

        // check cache
        let cache: any = $mediaCache[path]
        if (cache) {
            // TODO: cache
            var img = new window.Image()
            // console.log(cache)
            img.src = cache.data

            canvas.width = cache.size?.width || cache.width
            canvas.height = cache.size?.height || cache.height
            setTimeout(() => {
                canvas?.getContext("2d").drawImage(img, 0, 0, cache.width, cache.height)
                // canvas.getContext("2d").drawImage(videoElem, 0, 0, cache.width, cache.height)
            }, 200)

            duration = videoElem.duration
            videoElem.currentTime = duration / 2
            time = true

            loaded = true
            return
        }

        if (ghost) return

        if (!time) {
            duration = videoElem.duration
            // it's sometimes Infinity for some reason
            if (duration === Infinity) duration = 0
            videoElem.currentTime = duration / 2
            time = true
        } else {
            let width = videoElem.offsetWidth
            let height = videoElem.offsetHeight
            canvas.width = width
            canvas.height = height
            canvas.getContext("2d").drawImage(videoElem, 0, 0, width, height)

            // set cache
            setTimeout(() => {
                if (!canvas) return
                mediaCache.update((a: any) => {
                    a[path] = { data: canvas.toDataURL(), width, height, size: { width, height } }
                    return a
                })

                loaded = true
            }, 1000)
        }
    }

    let width: number = 0
    let height: number = 0

    $: customResolution = resolution || getResolution(null, { $outputs, $styles })

    $: if (mediaStyle.speed && videoElem) videoElem.playbackRate = mediaStyle.speed

    // retry on error (don't think this is neccesary)
    let retryCount = 0
    $: if (path) retryCount = 0
    function reload() {
        if (ghost || retryCount > 5) return

        setTimeout(() => {
            loaded = false
            retryCount++
        }, 100)
    }
</script>

<div class="main" style="aspect-ratio: {customResolution.width}/{customResolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#key path || retryCount}
        {#if type === "camera"}
            <div bind:clientWidth={width} bind:clientHeight={height} style="height: 100%;">
                <!-- TODO: media height -->
                <Camera id={path} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: videoElem?.videoWidth || 0, height: videoElem?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem />
            </div>
        {:else if type === "screen"}
            <Capture screen={{ id: path, name }} streams={[]} background />
        {:else if type === "video"}
            <div class="video" style="filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});overflow: hidden;">
                <canvas style={getStyleResolution({ width: canvas?.width || 0, height: canvas?.height || 0 }, width, height, mediaStyle.fit)} bind:this={canvas} />
                {#if !loaded || hover || loadFullImage}
                    {#key retryCount}
                        <video style="pointer-events: none;position: absolute;width: 100%;height: 100%;object-fit: {mediaStyle.fit};" bind:this={videoElem} on:error={reload} src={path} on:canplaythrough={ready}>
                            <track kind="captions" />
                        </video>
                    {/key}
                {/if}
            </div>
        {:else}
            {#if !loadFullImage || !loaded}
                <canvas
                    style="{getStyleResolution({ width: canvas?.width || 0, height: canvas?.height || 0 }, width, height, mediaStyle.fit)}filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY
                        ? '-1'
                        : '1'});"
                    bind:this={canvas}
                />
            {/if}
            {#if loadFullImage}
                {#key retryCount}
                    <img
                        src={path}
                        alt={name}
                        loading="lazy"
                        style="pointer-events: none;position: absolute;filter: {mediaStyle.filter || ''};object-fit: {mediaStyle.fit};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});width: 100%;height: 100%;"
                        on:error={reload}
                    />
                {/key}
            {/if}
        {/if}
    {/key}
</div>

<style>
    .main,
    .video {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    /* canvas,
  .main :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  } */
</style>
