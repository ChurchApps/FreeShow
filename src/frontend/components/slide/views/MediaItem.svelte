<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Unsubscriber } from "svelte/store"
    import type { Item } from "../../../../types/Show"
    import { audioChannelsData, currentWindow, media, outputs, styles } from "../../../stores"
    import Image from "../../drawer/media/Image.svelte"
    import { getCropState } from "../../helpers/cropping"
    import { encodeFilePath, getExtension, getMedia, getMediaType, getThumbnailPath, mediaSize } from "../../helpers/media"
    import { defaultLayers } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import { SoftLoopSync } from "../../media/video/softLoop"
    import { syncVideoToAudio, videoSync } from "../../media/video/videoSync"

    export let item: Item
    export let outputId = ""
    export let slideRef: any = {}

    export let preview = false
    export let edit = false
    export let cropPreviewMode = false

    // replace any media items (with unset path) to the set slide background -- if the background layer is turned off
    function getCustomPath() {
        if (!outputId || !slideRef.showId) return

        const outputStyle = $styles[$outputs[outputId]?.style || ""]
        const layers = Array.isArray(outputStyle?.layers) ? outputStyle.layers : defaultLayers
        if (layers.includes("background")) return

        const layoutRef = _show(slideRef.showId).layouts([slideRef.layoutId]).ref()[0] || []
        const layoutSlide = layoutRef[slideRef.slideIndex]
        let backgroundId = layoutSlide?.data?.background || ""
        if (!backgroundId) {
            // get from first slide if not on current slide
            backgroundId = layoutRef[0]?.data?.background || ""
        }

        const media = _show(slideRef.showId).get()?.media || {}

        mediaPath = media[backgroundId]?.path || ""
    }

    $: shouldAutoUpdate = typeof item.src === "string" && item.src.includes("NowPlayingCover")

    let updater = 0
    let updateInterval: NodeJS.Timeout | null = null
    $: if (shouldAutoUpdate && !updateInterval) {
        updateInterval = setInterval(() => (updater = Date.now()), 1000)
    }
    onDestroy(() => {
        if (updateInterval) clearInterval(updateInterval)
        if (unsubscriber) unsubscriber()

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

        cleanupVideo(videoElem)
        cleanupVideo(videoBlurElem)
    })

    // LOAD MEDIA ITEM

    let mediaPath = ""

    $: bgPath = item?.src
    $: if (bgPath) loadMedia()
    async function loadMedia() {
        if (item.type !== "media") return

        if (typeof bgPath !== "string") return getCustomPath()

        mediaPath = bgPath
        let thumbnailPath = getThumbnailPath(mediaPath, mediaSize.slideSize)

        const media = await getMedia(bgPath, mediaSize.slideSize)
        if (!media) return

        mediaPath = media.path
        thumbnailPath = media.thumbnail

        // only load thumbnails in main preview
        if (shouldAutoUpdate || $currentWindow || preview) return

        mediaPath = thumbnailPath
    }

    $: cropState = getCropState(item?.cropping, cropPreviewMode)
    $: showCropOverflowPreview = cropState.showCropOverflowPreview
    $: mediaCropGeometry = cropState.mediaCropGeometry
    $: flipX = item?.flipped ? -1 : 1
    $: flipY = item?.flippedY ? -1 : 1
    $: transformString = `scale(${flipX}, ${flipY})`

    $: mediaStyleString = `filter: ${item?.filter};object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};mix-blend-mode: ${item?.blend || "normal"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;`
    $: mediaStyleCombinedString = `${mediaCropGeometry}transform-origin: center;transform: ${transformString};${edit ? "pointer-events: none;" : ""}`
    $: mediaOverflowPreviewStyle = `position: absolute;width: 100%;height: 100%;left: 0;top: 0;opacity: 0.35;pointer-events: none;transform-origin: center;transform: ${transformString};`

    // VIDEO UPDATE

    let videoElem: HTMLVideoElement | null = null
    let videoBlurElem: HTMLVideoElement | null = null

    let unsubscriber: Unsubscriber | null = null
    let lastSyncedTime: number | null = null

    let softLoopVideo: HTMLVideoElement | null = null
    let softLoopOpacity = 0
    let videoTime = 0
    let isPaused = false

    $: updateVideoSync(bgPath, outputId)
    function updateVideoSync(path: string | undefined, outputId: string) {
        if (unsubscriber) {
            unsubscriber()
            unsubscriber = null
        }

        if (!path || !outputId) return

        unsubscriber = videoSync(path, outputId, (data) => {
            if (!videoElem) return

            const isSoftLoop = !!(data.softLoop && data.softLoop > 0)
            const rate = playbackRate
            syncVideoToAudio(videoElem, data.currentTime, lastSyncedTime, isSoftLoop, rate)
            syncVideoToAudio(videoBlurElem, data.currentTime, lastSyncedTime, isSoftLoop, rate)
            if (data.currentTime !== undefined) {
                lastSyncedTime = data.currentTime
                videoTime = data.currentTime
            }

            if (data.softLoop !== undefined) softLoopValue = data.softLoop
            if (data.softLoopOpacity !== undefined) softLoopOpacity = data.softLoopOpacity
            softLoopAudioTime = data.currentTime
            isPaused = !!data.paused

            if (data.paused && !videoElem.paused) {
                videoElem.pause()
                videoBlurElem?.pause()
            } else if (!data.paused && videoElem.paused) {
                videoElem.play()
                videoBlurElem?.play()
            }
        })
    }

    $: playbackRate = item.speed ?? 1
    let _lastAppliedRate = 1
    $: if (playbackRate !== _lastAppliedRate) {
        _lastAppliedRate = playbackRate
        if (videoElem) videoElem.playbackRate = playbackRate
        if (videoBlurElem) videoBlurElem.playbackRate = playbackRate
        if (softLoopVideo) softLoopVideo.playbackRate = playbackRate
    }

    let shouldLoop = item.loop !== false

    // Soft loop

    $: softLoopValue = $media[mediaPath]?.softLoop ?? 0
    $: fromTime = $media[mediaPath]?.fromTime ?? 0
    $: toTime = $media[mediaPath]?.toTime ?? 0

    const softLoopSync = new SoftLoopSync()
    onDestroy(() => softLoopSync.destroy())

    let softLoopAudioTime: number | undefined
    $: effectiveSoftLoopOpacity = softLoopSync.update(softLoopOpacity, videoTime, fromTime, softLoopValue, videoElem, softLoopVideo, isPaused, toTime, softLoopAudioTime)
</script>

{#if mediaPath}
    {#if ($currentWindow || preview) && getMediaType(getExtension(mediaPath)) === "video"}
        {#if item.fit === "blur"}
            <video bind:this={videoBlurElem} src={encodeFilePath(mediaPath)} style="{mediaStyleBlurString}{mediaStyleCombinedString}" muted autoplay loop={shouldLoop} />
        {/if}
        {@const mainVol = $audioChannelsData.main?.volume ?? 1}
        <video bind:this={videoElem} src={encodeFilePath(mediaPath)} style="{mediaStyleString}{mediaStyleCombinedString}" muted volume={mainVol} autoplay loop={shouldLoop}>
            <track kind="captions" />
        </video>

        {#if softLoopValue > 0 && shouldLoop}
            <video bind:this={softLoopVideo} src={encodeFilePath(mediaPath)} style="{mediaStyleString}{mediaStyleCombinedString} position: absolute;top: 0;left: 0;transition: 0.2s opacity;opacity: {effectiveSoftLoopOpacity};pointer-events: none;" muted loop={shouldLoop} />
        {/if}
    {:else}
        <!-- {#key updater} -->
        <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
        <!-- TODO: use custom transition... -->
        {#if showCropOverflowPreview}
            <Image style="{mediaStyleString}{mediaOverflowPreviewStyle}" src={mediaPath} {updater} alt="" transition={false} />
        {/if}
        {#if item.fit === "blur"}
            <Image style="{mediaStyleBlurString}{mediaStyleCombinedString}" src={mediaPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        {/if}
        <Image style="{mediaStyleString}{mediaStyleCombinedString}" src={mediaPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        <!-- {/key} -->
    {/if}
{/if}
