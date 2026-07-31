<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import type { MediaStyle } from "../../../../types/Main"
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { audioChannelsData, currentWindow, media, outputs, playerVideos, special, videosData, videosTime } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { videoExtensions } from "../../../values/extensions"
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import { getExtension, getMediaLayerType, getMediaStyle } from "../../helpers/media"
    import { VideoController } from "../../media/VideoController"
    import Player from "../../system/Player.svelte"
    import Camera from "../Camera.svelte"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import Window from "../Window.svelte"
    import Media from "./Media.svelte"

    export let outputId = ""

    export let data: OutBackground
    export let transition: Transition
    export let fadingOut = false
    export let currentStyle: Styles | null = null
    export let animationStyle = ""
    export let duration = 0
    export let mirror = false
    export let styleBackground = false

    $: id = data.path || data.id || ""

    let type = "media"
    $: type = data.type || "media"
    $: if (type === "video" || type === "image") type = "media"

    let mediaStyle: MediaStyle = {}
    $: if (data && currentStyle) mediaStyle = getMediaStyle({ ...$media[id], ...data }, currentStyle)

    // VIDEO

    let videoData = { duration: 0, paused: true, muted: true, loop: styleBackground }
    let videoTime = 0

    $: videoLayerType = getMediaLayerType(id, mediaStyle)
    $: defaultLoop = videoLayerType === "background" ? true : styleBackground
    $: defaultMuted = videoLayerType === "background" ? true : false

    $: effectiveMuted = data?.muted !== undefined ? data.muted : $videosData[outputId]?.muted !== undefined ? $videosData[outputId].muted : defaultMuted
    $: effectiveLoop = data?.loop !== undefined ? data.loop : $videosData[outputId]?.loop !== undefined ? $videosData[outputId].loop : defaultLoop

    $: videoData.loop = effectiveLoop
    // All visual video elements are always muted — audio lives in VideoController
    $: videoData.muted = true

    // Sync visual video's paused state from the store
    // (populated by VideoController.publishState or output window's DATA receiver)
    $: if (!styleBackground && $videosData[outputId]?.paused !== undefined && videoData.paused !== $videosData[outputId].paused) {
        videoData.paused = $videosData[outputId].paused
    }

    // Sync visual video currentTime to the controller's published time.
    // Applies only to the frontend (mirror) side — the output window uses TIME IPC receiver.
    $: if (mirror && !styleBackground && $videosTime[outputId] !== undefined) syncVideoTime()
    function syncVideoTime() {
        if (fadingOut || !video || video.seeking) return
        const targetTime = Number($videosTime[outputId])
        if (isNaN(targetTime)) return
        const diff = Math.abs(targetTime - video.currentTime)
        if (diff > 0.15) {
            videoTime = targetTime
            if (video.readyState >= 1) {
                try {
                    video.currentTime = targetTime
                } catch (e) {}
            }
        }
    }

    /** Sync the output window's visual video to a master time with rate-nudging for precision. */
    function syncVideoToMaster(targetTime: number) {
        if (fadingOut || !video || video.seeking || typeof targetTime !== "number" || isNaN(targetTime)) return
        const baseSpeed = Number(mediaStyle.speed) || 1
        const diff = targetTime - video.currentTime
        const absDiff = Math.abs(diff)

        if (absDiff > 0.15) {
            videoTime = targetTime
            if (video.readyState >= 1) {
                try {
                    video.currentTime = targetTime
                } catch (e) {}
                video.playbackRate = baseSpeed
            }
        } else if (absDiff > 0.015) {
            if (video) video.playbackRate = baseSpeed * (diff > 0 ? 1.04 : 0.96)
        } else {
            if (video && video.playbackRate !== baseSpeed) video.playbackRate = baseSpeed
        }
    }

    /** IPC receivers registered on the output window to accept TIME/DATA messages from the controller. */
    const videoReceiver = {
        TIME: (data: any) => {
            const outputData = data[outputId]
            if (outputData === undefined || fadingOut) return
            syncVideoToMaster(outputData)
        },
        DATA: (data: any) => {
            const outputData = data[outputId]
            if (!outputData || fadingOut) return
            videoData = { ...outputData, duration: videoData.duration || 0 }
        }
    }

    let listenerId = ""
    let receiving = false
    let mounted = false
    onMount(() => (mounted = true))

    $: if (id && !fadingOut && mounted) startReceiver()
    function startReceiver() {
        const isStage = $currentWindow === "output" && !!Object.values($outputs)[0]?.stageOutput
        if ((mirror && !isStage) || receiving) return
        receiving = true
        destroy(OUTPUT, listenerId)
        listenerId = "MEDIA_RECEIVE_" + uid(5)
        receive(OUTPUT, videoReceiver, listenerId)
    }

    onDestroy(removeReceiver)
    $: if (fadingOut || id) removeReceiver()
    function removeReceiver() {
        if (!receiving || !mounted) return
        receiving = false
        destroy(OUTPUT, listenerId)
    }

    $: isVideo = videoExtensions.includes(getExtension(id))

    // ── Video ended ───────────────────────────────────────────────────────────
    // Use the controller's published time (videosTime) on the frontend (mirror) side
    // for accuracy, and the visual video's local time on the output window side.

    $: effectiveDuration = $videosData[outputId]?.duration || videoData.duration || 0
    $: currentCheckTime = mirror ? ($videosTime[outputId] ?? 0) : videoTime

    $: if (isVideo && effectiveDuration && currentCheckTime >= effectiveDuration - (duration / 1000 + 0.1) && !mediaStyle.softLoop) {
        videoEnded()
    }

    let endedCalled = false
    $: if (id) endedCalled = false

    function videoEnded() {
        if (fadingOut || endedCalled) return
        endedCalled = true

        if (!effectiveLoop) {
            videoData.paused = true
            // Pause the controller from the frontend side
            if (mirror) VideoController.get(outputId)?.pause()
        }

        // Send MAIN_VIDEO_ENDED from the frontend (mirror) side only
        if (mirror) {
            send(OUTPUT, ["MAIN_VIDEO_ENDED"], { id: outputId, loop: effectiveLoop, duration })
        }

        if (effectiveLoop) {
            setTimeout(() => (endedCalled = false), Math.max(duration, 2000))
        }
    }

    $: audioChannelVolume = $audioChannelsData[outputId]?.volume ?? 1
    $: isMuted = !!(effectiveMuted || $audioChannelsData[outputId]?.isMuted || $audioChannelsData.main?.isMuted)
    $: mainBusVolume = $audioChannelsData.main?.volume ?? 1
    // ReplayGain is applied internally by VideoController.load(); don't include it here to avoid double-application
    $: calculatedVolume = mainBusVolume * (isMuted ? 0 : 1) * audioChannelVolume * (($media[id]?.volume ?? currentStyle?.volume ?? 100) / 100)

    // Pass computed volume/pitch to the controller (frontend/mirror side only)
    $: if (mirror && calculatedVolume !== undefined) VideoController.get(outputId)?.setComputedVolume(calculatedVolume, isMuted)

    $: videoPitch = $media[id]?.pitch ?? 0
    $: if (mirror && videoPitch !== undefined) VideoController.get(outputId)?.setPitch(videoPitch)

    $: videoSpeed = Number(mediaStyle.speed) || 1
    $: if (mirror && videoSpeed) VideoController.get(outputId)?.setSpeed(videoSpeed)

    // When the visual transition starts, fade audio out through the controller
    $: if (mirror && fadingOut && duration) VideoController.get(outputId)?.fadeOut(duration)

    // Keep audioChannelsData in sync with the effective mute state (for routing display)
    $: if (outputId !== undefined) {
        const key = outputId || "default"
        audioChannelsData.update((a) => {
            const current = a[key] || {}
            if (current.isMuted !== effectiveMuted) {
                return { ...a, [key]: { ...current, isMuted: effectiveMuted } }
            }
            return a
        })
    }

    // Visual video element (bound through Media.svelte → Video.svelte)
    let video: HTMLVideoElement | undefined
</script>

<OutputTransition {transition} inTransition={transition.in} outTransition={transition.out} on:outrostart={() => (fadingOut = true)}>
    {#if type === "media"}
        <Media path={id} {data} {animationStyle} bind:video bind:videoData bind:videoTime {mirror} {mediaStyle} on:loaded on:ended={videoEnded} />
    {:else if type === "screen"}
        <Window {id} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "ndi"}
        {#key id}
            <NdiStream screen={{ id, name: "" }} background {mirror} />
        {/key}
    {:else if type === "blackmagic"}
        <BmdStream screen={{ id, name: "" }} background {mirror} />
    {:else if type === "camera"}
        <Camera {id} groupId={data.cameraGroup || ""} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "player"}
        <!-- prevent showing controls in output -->
        {#if $special.hideCursor || $playerVideos[id]?.type !== "youtube"}<div class="overlay" />{/if}
        <Player {outputId} {id} bind:videoData bind:videoTime startAt={data.startAt} on:loaded on:ended={videoEnded} />
    {/if}
</OutputTransition>

<style>
    /* div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    } */

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 1;
    }
</style>
