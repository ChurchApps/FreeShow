<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Item } from "../../../../types/Show"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { currentWindow, slideVideoData, volume } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import Image from "../../drawer/media/Image.svelte"
    import { encodeFilePath, getExtension, getMediaType, loadThumbnail, mediaSize } from "../../helpers/media"

    export let id: string
    export let item: Item

    export let preview = false
    export let mirror = true
    export let edit = false

    $: shouldAutoUpdate = item.src?.includes("NowPlayingCover")

    let updater = 0
    let updateInterval: NodeJS.Timeout | null = null
    $: if (shouldAutoUpdate && !updateInterval) {
        updateInterval = setInterval(() => (updater = Date.now()), 1000)
    }
    onDestroy(() => {
        if (updateInterval) clearInterval(updateInterval)
    })

    let mediaItemPath = ""
    $: if (item?.type === "media") getMediaItemPath()
    async function getMediaItemPath() {
        mediaItemPath = ""
        if (!item.src) return

        if (shouldAutoUpdate) {
            mediaItemPath = item.src
            return
        }

        // only load thumbnails in main
        if ($currentWindow || preview) {
            mediaItemPath = item.src
            return
        }

        // if (edit) mediaItemPath = getThumbnailPath(item.src, mediaSize.slideSize)
        mediaItemPath = await loadThumbnail(item.src, mediaSize.slideSize)
    }

    $: mediaStyleString = `filter: ${item?.filter};object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;`
    $: mediaStyleCombinedString = `width: 100%;height: 100%;transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});${edit ? "pointer-events: none;" : ""}`

    // VIDEO UPDATE

    let videoElem: HTMLVideoElement | null = null
    let videoBlurElem: HTMLVideoElement | null = null

    $: if (!$currentWindow && $slideVideoData) updateVideo()
    function updateVideo() {
        const videoData = $slideVideoData[id]?.[mediaItemPath]
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
            send(OUTPUT, ["MAIN_SLIDE_VIDEO"], { id, path: mediaItemPath, data: videoData })
        }, 200)

        const videoReceiver = {
            SLIDE_VIDEO_STATE: (data: any) => {
                if (data.slideId !== id || data.path !== mediaItemPath) return
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

{#if mediaItemPath}
    {#if ($currentWindow || preview) && getMediaType(getExtension(mediaItemPath)) === "video"}
        {#if item.fit === "blur"}
            <video bind:this={videoBlurElem} src={encodeFilePath(mediaItemPath)} style="{mediaStyleBlurString}{mediaStyleCombinedString}" bind:playbackRate muted autoplay loop={shouldLoop} />
        {/if}
        <video bind:this={videoElem} src={encodeFilePath(mediaItemPath)} style="{mediaStyleString}{mediaStyleCombinedString}" bind:playbackRate muted={mirror || item.muted} volume={AudioPlayer.getVolume(null, $volume)} autoplay loop={shouldLoop}>
            <track kind="captions" />
        </video>
    {:else}
        <!-- {#key updater} -->
        <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
        <!-- TODO: use custom transition... -->
        {#if item.fit === "blur"}
            <Image style="{mediaStyleBlurString}{mediaStyleCombinedString}" src={mediaItemPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        {/if}
        <Image style="{mediaStyleString}{mediaStyleCombinedString}" src={mediaItemPath} {updater} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        <!-- {/key} -->
    {/if}
{/if}
