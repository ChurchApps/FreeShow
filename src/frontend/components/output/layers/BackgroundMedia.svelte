<script lang="ts">
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { MediaStyle } from "../../../../types/Main"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { allOutputs, audioChannels, outputs, playingVideos, videosData, videosTime } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import { analyseAudio, getAnalyser } from "../../helpers/audio"
    import { getMediaStyle } from "../../helpers/media"
    import Player from "../../system/Player.svelte"
    import Camera from "../Camera.svelte"
    import Window from "../Window.svelte"
    import Media from "./Media.svelte"
    import OutputTransition from "./OutputTransition.svelte"

    export let outputId: string = ""

    export let data: OutBackground
    export let transition: Transition
    export let currentStyle: any = {}
    export let animationStyle: string = ""
    export let duration: number = 0
    export let mirror: boolean = false

    $: id = data.path || data.id || ""

    let type: string = "media"
    $: type = data.type || "media"
    $: if (type === "video" || type === "image") type = "media"

    let mediaStyle: MediaStyle = {}
    $: if (data) mediaStyle = getMediaStyle(data, currentStyle)

    // VIDEO

    let videoData: any = { duration: 0, paused: true, muted: true, loop: false }
    let videoTime: number = 0

    // always muted in mirror (draw/key)
    $: if (mirror && !videoData.muted) videoData.muted = true
    // video values updated
    $: if (!mirror && (data.muted !== undefined || data.loop !== undefined)) updateValues()
    function updateValues() {
        videoData.muted = data.muted ?? true
        videoData.loop = data.loop ?? false
    }
    // draw
    $: if (mirror && $videosData[outputId]?.paused) videoData.paused = true
    $: if (mirror && $videosTime[outputId]) videoTime = $videosTime[outputId]

    $: if (!mirror) send(OUTPUT, ["MAIN_DATA"], { [outputId]: videoData })
    $: if (!mirror) sendVideoTime(videoTime)

    let loop = 0
    function sendVideoTime(time: number) {
        loop++
        if (loop < 80) return

        send(OUTPUT, ["MAIN_TIME"], { [outputId]: time })
        loop = 0
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
            if (!outputData) return

            videoTime = outputData
        },
        DATA: (data: any) => {
            let outputData = data[keyParentId || outputId]
            if (!outputData) return

            videoData = { ...outputData, duration: videoData.duration || 0 }
        },
    }
    onMount(() => {
        receive(OUTPUT, videoReceiver)
    })

    // call end just before (to make room for transition) - this also triggers video ended on loop
    $: if (videoData.duration && duration && videoTime >= videoData.duration - duration / 1000 - 0.9) videoEnded()

    let endedCalled: boolean = false
    function videoEnded() {
        if (mirror || endedCalled) return

        endedCalled = true
        setTimeout(() => (endedCalled = false), duration || 1000)

        send(OUTPUT, ["MAIN_VIDEO_ENDED"], { id: outputId, loop: videoData.loop, duration })
    }

    // AUDIO

    $: if (!mirror && $audioChannels) send(OUTPUT, ["AUDIO_MAIN"], { id, channels: $audioChannels })
    $: if (!mirror && video !== null) setTimeout(analyseVideo, 100)

    // analyse video audio
    let video: any = null
    let currentAnalysedElem: any = null
    async function analyseVideo() {
        let currentAnalyser: any = null

        // Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected previously to a different MediaElementSourceNode.
        if (currentAnalysedElem !== video) {
            currentAnalyser = await getAnalyser(video)
            currentAnalysedElem = video
        }
        if (!currentAnalyser) return

        // WIP multiple outputs & analysers
        playingVideos.set([{ video, analyser: currentAnalyser }])
        analyseAudio()
    }
</script>

<OutputTransition {transition}>
    {#if type === "media"}
        <Media path={id} {data} {animationStyle} bind:video bind:videoData bind:videoTime {mirror} {mediaStyle} on:loaded on:ended={videoEnded} />
    {:else if type === "screen"}
        <Window {id} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "camera"}
        <Camera {id} groupId={data.cameraGroup || ""} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "player"}
        <!-- prevent showing controls in output -->
        <div class="overlay" />
        <Player {outputId} {id} bind:videoData bind:videoTime title={data.title} startAt={data.startAt} on:loaded />
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
