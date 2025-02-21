<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import type { MediaStyle } from "../../../../types/Main"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { allOutputs, media, outputs, playingVideos, special, videosData, videosTime, volume } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import Player from "../../system/Player.svelte"
    import Camera from "../Camera.svelte"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import Window from "../Window.svelte"
    import Media from "./Media.svelte"

    export let outputId: string = ""

    export let data: OutBackground
    export let transition: Transition
    export let fadingOut: boolean = false
    export let currentStyle: any = {}
    export let animationStyle: string = ""
    export let duration: number = 0
    export let mirror: boolean = false
    export let styleBackground: boolean = false

    $: id = data.path || data.id || ""

    let type: string = "media"
    $: type = data.type || "media"
    $: if (type === "video" || type === "image") type = "media"

    let mediaStyle: MediaStyle = {}
    $: if (data) mediaStyle = getMediaStyle(data, currentStyle)

    // VIDEO

    let videoData: any = { duration: 0, paused: true, muted: true, loop: styleBackground }
    let videoTime: number = 0

    // let videoDuration = 0
    // if (!videoData.duration && duration) videoData.duration = videoDuration
    // else if (videoData.duration && videoDuration !== videoData.duration) videoDuration = videoData.duration

    // always muted in mirror (draw/key)
    $: if (mirror && !videoData.muted) videoData.muted = true
    // video values updated
    $: if (!mirror && (data.muted !== undefined || data.loop !== undefined)) updateValues()
    function updateValues() {
        if (fadingOut) return

        videoData.muted = data.muted ?? true
        videoData.loop = data.loop ?? false
    }
    // draw

    //Without the second if, the preview videos don't actually play but just skip ahead when kept in sync with the setTimeout()
    $: if (mirror && !styleBackground && $videosData[outputId]?.paused) videoData.paused = true
    $: if (mirror && !styleBackground && $videosData[outputId]?.paused === false) videoData.paused = false

    $: if (mirror && !styleBackground && $videosTime[outputId] !== undefined) setPreviewVideoTime()
    function setPreviewVideoTime() {
        // timeout in case video is going to fade out
        setTimeout(() => {
            if (fadingOut) return

            const diff = Math.abs($videosTime[outputId] - videoTime)
            if (diff > 0.5) {
                videoTime = $videosTime[outputId]

                if (videoTime < 0.6) {
                    videoData.paused = true // quick fix for preview stutter when video loops (should be a better fix)
                } else {
                    videoData.paused = $videosData[outputId]?.paused
                }
            }
        }, 50)
    }

    $: if (!mirror && !fadingOut) send(OUTPUT, ["MAIN_DATA"], { [outputId]: videoData })
    $: if (!mirror && !fadingOut) sendVideoTime(videoTime)

    let sendingTimeout: any = null
    let timeUpdateTimeout = 220
    function sendVideoTime(time: number) {
        if (sendingTimeout) return

        send(OUTPUT, ["MAIN_TIME"], { [outputId]: time })
        sendingTimeout = setTimeout(() => {
            if (fadingOut) return

            send(OUTPUT, ["MAIN_TIME"], { [outputId]: time })
            sendingTimeout = null
        }, timeUpdateTimeout)
    }

    // key output parent
    let keyParentId = ""
    if ($outputs[outputId]?.isKeyOutput) getKeyParent()
    function getKeyParent() {
        Object.keys($allOutputs).forEach((id) => {
            if (keyParentId) return
            if ($allOutputs[id].keyOutput === outputId) keyParentId = id
        })
    }

    const videoReceiver = {
        TIME: (data: any) => {
            let outputData = data[keyParentId || outputId]
            if (!outputData || fadingOut) return

            videoTime = outputData
        },
        DATA: (data: any) => {
            let outputData = data[keyParentId || outputId]
            if (!outputData || fadingOut) return

            videoData = { ...outputData, duration: videoData.duration || 0 }
        },
    }

    let listenerId = ""
    let receiving: boolean = false

    let mounted: boolean = false
    onMount(() => (mounted = true))
    $: if (id && !fadingOut && mounted) startReceiver()
    function startReceiver() {
        if (mirror || receiving) return
        receiving = true

        destroy(OUTPUT, listenerId)

        listenerId = "MEDIA_RECEIVE_" + uid(5)
        receive(OUTPUT, videoReceiver, listenerId)
    }

    onDestroy(removeReceiver)
    $: if (fadingOut || id) removeReceiver()
    function removeReceiver() {
        if (mirror || !receiving || !mounted) return
        receiving = false

        destroy(OUTPUT, listenerId)
    }

    // call end just before (to make room for transition) - this also triggers video ended on loop
    $: if (videoData.duration && videoTime >= videoData.duration - (duration / 1000 + 0.1)) videoEnded()

    let endedCalled: boolean = false
    function videoEnded() {
        if (fadingOut || mirror || endedCalled) return

        endedCalled = true
        setTimeout(() => (endedCalled = false), duration || 1000)

        send(OUTPUT, ["MAIN_VIDEO_ENDED"], { id: outputId, loop: videoData.loop, duration })
    }

    // FADE OUT AUDIO

    $: if (fadingOut && !videoData.muted) fadeoutVideo()
    $: if (!fadingOut && !videoData.muted && id) setVolume($volume * (($media[id]?.volume ?? 100) / 100))
    const speed = 0.01
    const margin = 0.9 // video should fade to 0 before clearing
    function fadeoutVideo() {
        if (mirror || !video || !fadingOut || !duration) return

        let time = duration * speed * margin
        setTimeout(() => {
            if (!video) return

            video.volume = Math.max(0, Number((video.volume - speed).toFixed(3)))
            fadeoutVideo()
        }, time)
    }
    function setVolume(volume: number) {
        if (!video) return
        video.volume = volume
    }

    // AUDIO

    $: if (!mirror && video) analyseVideo()

    onDestroy(() => {
        if (id) AudioAnalyser.detach(id)
    })

    // analyse video audio
    let video: any = null
    let previousPath = id
    async function analyseVideo() {
        if (previousPath && previousPath !== id) {
            AudioAnalyser.detach(id)
        }
        if (!video) return

        playingVideos.set([{ video }])
        AudioAnalyser.attach(id, video)
        AudioAnalyser.recorderActivate()
    }
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
        {#if $special.hideCursor}<div class="overlay" />{/if}
        <Player {outputId} {id} bind:videoData bind:videoTime title={data.title} startAt={data.startAt} on:loaded on:ended={videoEnded} />
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
