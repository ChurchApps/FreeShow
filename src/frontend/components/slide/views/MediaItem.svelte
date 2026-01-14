<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Item } from "../../../../types/Show"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { currentWindow, outputs, slideVideoData, styles, volume } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import Image from "../../drawer/media/Image.svelte"
    import { encodeFilePath, getExtension, getMedia, getMediaType, getThumbnailPath, mediaSize } from "../../helpers/media"
    import { defaultLayers } from "../../helpers/output"
    import { _show } from "../../helpers/shows"

    export let id: string
    export let item: Item
    export let outputId = ""
    export let slideRef: any = {}

    export let preview = false
    export let mirror = true
    export let edit = false

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
    })

    // LOAD MEDIA ITEM

    let mediaPath = ""

    $: bgPath = item?.src
    $: if (bgPath) getMediaItemPath()
    async function getMediaItemPath() {
        if (item.type !== "media") return

        if (typeof bgPath !== "string") return getCustomPath()

        mediaPath = bgPath
        let thumbnailPath = getThumbnailPath(mediaPath, mediaSize.slideSize)

        const media = await getMedia(bgPath)
        if (!media) return

        mediaPath = media.path
        thumbnailPath = media.thumbnail

        // only load thumbnails in main preview
        if (shouldAutoUpdate || $currentWindow || preview) return

        mediaPath = thumbnailPath
    }

    $: mediaStyleString = `filter: ${item?.filter};object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;`
    $: mediaStyleCombinedString = `width: 100%;height: 100%;transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});${edit ? "pointer-events: none;" : ""}`

    // VIDEO UPDATE

    let videoElem: HTMLVideoElement | null = null
    let videoBlurElem: HTMLVideoElement | null = null

    $: if (!$currentWindow && $slideVideoData) updateVideo()
    function updateVideo() {
        const videoData = $slideVideoData[id]?.[mediaPath]
        if (!videoElem || !videoData) return

        if (videoData.isPaused && !videoElem.paused) {
            videoElem.pause()
            videoBlurElem?.pause()
        } else if (!videoData.isPaused && videoElem.paused) {
            videoElem.play()
            videoBlurElem?.play()
        }
    }

    onMount(() => {
        if ($currentWindow !== "output") return

        const interval = setInterval(() => {
            if (!videoElem) return

            const videoData = { currentTime: videoElem.currentTime, duration: videoElem.duration, isPaused: videoElem.paused, loop: videoElem.loop }
            // send(Main.MAIN_SLIDE_VIDEO, videoData)
            send(OUTPUT, ["MAIN_SLIDE_VIDEO"], { id, path: mediaPath, data: videoData })
        }, 200)

        const videoReceiver = {
            SLIDE_VIDEO_STATE: (data: any) => {
                if (data.slideId !== id || data.path !== mediaPath) return
                if (!videoElem) return

                if (data.action === "play") {
                    videoElem.play()
                    videoBlurElem?.play()
                } else if (data.action === "pause") {
                    videoElem.pause()
                    videoBlurElem?.pause()
                } else if (data.action === "loop") {
                    videoElem.loop = true
                    if (videoBlurElem) videoBlurElem.loop = true
                } else if (data.action === "unloop") {
                    videoElem.loop = false
                    if (videoBlurElem) videoBlurElem.loop = false
                }
            }
        }

        const listenerId = "SLIDE_VIDEO_RECEIVE_" + uid(5)
        receive(OUTPUT, videoReceiver, listenerId)

        return () => {
            clearInterval(interval)
            destroy(OUTPUT, listenerId)
        }
    })

    $: playbackRate = item.speed ?? 1

    let shouldLoop = item.loop !== false
</script>

{#if mediaPath}
    {#if ($currentWindow || preview) && getMediaType(getExtension(mediaPath)) === "video"}
        {#if item.fit === "blur"}
            <video bind:this={videoBlurElem} src={encodeFilePath(mediaPath)} style="{mediaStyleBlurString}{mediaStyleCombinedString}" bind:playbackRate muted autoplay loop={shouldLoop} />
        {/if}
        <video bind:this={videoElem} src={encodeFilePath(mediaPath)} style="{mediaStyleString}{mediaStyleCombinedString}" bind:playbackRate muted={mirror || item.muted} volume={AudioPlayer.getVolume(null, $volume)} autoplay loop={shouldLoop}>
            <track kind="captions" />
        </video>
    {:else}
        <!-- {#key updater} -->
        <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
        <!-- TODO: use custom transition... -->
        {#if item.fit === "blur"}
            <Image style="{mediaStyleBlurString}{mediaStyleCombinedString}" src={mediaPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        {/if}
        <Image style="{mediaStyleString}{mediaStyleCombinedString}" src={mediaPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        <!-- {/key} -->
    {/if}
{/if}
