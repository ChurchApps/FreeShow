<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import type { MediaFit } from "../../../types/Main"
    import type { Transition } from "../../../types/Show"
    import { audioChannels, outputs, playingVideos, volume } from "../../stores"
    import { receive, send } from "../../utils/request"
    import { custom } from "../../utils/transitions"
    import { analyseAudio, getAnalyser } from "../helpers/audio"
    import Media from "../media/Media.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import Player from "../system/Player.svelte"
    import Camera from "./Camera.svelte"
    import Window from "./Window.svelte"

    export let background: any = {}
    export let currentStyle: any = {}
    export let animationStyle: string = ""
    export let outputId: string
    export let transition: Transition
    export let path: string = ""
    export let id: string = ""
    export let cameraGroup: string = ""
    // export let name: string = ""
    export let type: string = "media"
    export let startAt: number = 0

    export let title: string
    export let mirror: boolean = false

    $: if (type === "video" || type === "image" || type === undefined) type = "media"
    // $: if (type === "media" && !path?.length && $mediaFolders[id]?.path && name) {
    //     // TODO: what's this for?
    //     let seperator = "/"
    //     if ($mediaFolders[id].path?.includes("\\")) seperator = "\\"
    //     path = $mediaFolders[id].path + seperator + name || ""
    // }

    // $: if (!mirror && !hasLoaded && background?.startAt !== undefined) changeTime()
    // function changeTime() {
    //     setTimeout(() => {
    //         send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, time: background.startAt })
    //         delete background.startAt
    //     }, 100)
    // }

    let width: number = 0
    let height: number = 0

    let hasLoaded: boolean = false
    let autoMute: boolean = false
    function loaded() {
        hasLoaded = true

        if (background.loop !== undefined) videoData.loop = background.loop
        // if (background.filter !== undefined) filter = background.filter

        if (mirror) {
            // request data
            send(OUTPUT, ["REQUEST_VIDEO_DATA"], { id: outputId })
        } else {
            if (background.muted !== undefined) videoData.muted = background.muted

            if (!videoData.muted) autoMute = videoData.muted = true
        }
    }

    let currentId: string = ""
    function playing() {
        if (!hasLoaded || mirror) return

        hasLoaded = false
        currentId = path
        console.log("PLAYING")

        setTimeout(() => {
            if (currentId !== path || !autoMute) return

            // send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, time: videoTime })
            // setTimeout(() => send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, data: videoData, time: videoTime }), 100)

            autoMute = false
            videoData.muted = false
        }, 100)
    }

    $: console.trace(videoData.muted)

    let filter: string = ""
    let flipped: boolean = false
    let fit: MediaFit = "contain"
    let speed: string = "1"

    $: if (background !== null || currentStyle) updateFilter()
    function updateFilter() {
        let temp: any = { ...background }
        filter = temp.filter || ""
        flipped = temp.flipped || false
        fit = currentStyle?.fit || temp.fit || "contain"
        speed = temp.speed || "1"
    }

    // only output window
    let currentAnalysedElem: any = null
    let currentAnalyser: any = null
    async function analyseVideo() {
        // if ($playingVideos[0]?.video === video) return
        // Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected previously to a different MediaElementSourceNode.
        if (currentAnalysedElem !== video) {
            currentAnalyser = await getAnalyser(video)
            currentAnalysedElem = video
        }
        if (!currentAnalyser) return

        playingVideos.set([{ video, analyser: currentAnalyser }])
        analyseAudio()
    }

    /////////

    let video: any = null
    let videoData: any = { duration: 0, paused: true, muted: false, loop: false }
    let videoTime: number = 0

    $: console.log(videoData)

    // $: if (!mirror && videoTime === 1) send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, time: videoTime })
    $: if (!mirror && videoData?.duration) send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, data: videoData })
    $: if (!mirror && $audioChannels) send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: $audioChannels })
    $: if (!mirror && (video === null || videoData.paused === true)) playingVideos.set([])
    $: if (!mirror && video !== null && videoData.paused === false) setTimeout(analyseVideo, 100)

    ///// DATA

    const receiveOUTPUT = {
        REQUEST_VIDEO_DATA: (a: any) => {
            if (mirror || a.id !== outputId) return

            send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, data: videoData, time: videoTime })
        },
        UPDATE_VIDEO: (a: any) => {
            if (a.data) videoData = { ...a.data, duration: videoData.duration || 0 }
            if (a.time !== undefined) setTime(a.time)

            if (mirror || !a.data) return

            setTimeout(() => {
                send(OUTPUT, ["MAIN_VIDEO"], { id: outputId, data: videoData, time: videoTime })
            }, 100)
        },

        BACKGROUND: (a: any) => {
            if (a?.loop) videoData.loop = a.loop
            if (mirror) return
            if (a?.muted) videoData.muted = a.muted
        },
        VOLUME: (a: any) => {
            if (mirror) return
            volume.set(a)
        },
    }

    receive(OUTPUT, receiveOUTPUT)

    function setTime(time: number) {
        let autoPaused: boolean = false
        if (!videoData.paused) {
            autoPaused = videoData.paused = true
        }

        // TODO: youtube seekTo
        setTimeout(() => {
            videoTime = time

            setTimeout(() => {
                if (autoPaused) videoData.paused = false
            }, 80)
        }, 10)

        if (background?.startAt !== undefined && mirror) {
            outputs.update((a) => {
                delete a[outputId].out?.background?.startAt
                return a
            })
        }
    }

    // ENDED

    // auto clear video on finish
    $: if (videoTime && videoData.duration && !videoData.paused && videoTime + 0.5 >= videoData.duration) {
        // this will start changing 0.2s before video ends (video is paused when changing)
        setTimeout(clearVideo, 300)
    }

    let clearing: boolean = false
    function clearVideo() {
        if (clearing) return

        clearing = true
        setTimeout(() => {
            clearing = false
        }, 1000)

        send(OUTPUT, ["MAIN_VIDEO_ENDED"], { id: outputId })

        // // TODO: do this in main

        // if (checkNextAfterMedia()) {
        //     // videoTime = 0
        //     return
        // }

        // if (videoData.loop) return

        // setOutput("background", null)
        // videoTime = 0

        // send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: 0 })

        // let currentOutput = $outputs[outputId]
        // if (currentOutput.keyOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: currentOutput.keyOutput, time: 0 })

        // dont think this is nessesary
        // setTimeout(() => {
        //     if (!currentOutput.out?.background) video = null
        // }, 500)
    }

    // $: if (currentOutput.out?.background === null) {
    //     clearVideo()
    // }
</script>

<!-- svelte transition bug: the double copies are to remove media when changing from "draw" view -->
<!-- TODO: display image stretch / scale -->
{#if type === "media"}
    <Media {path} {currentStyle} {animationStyle} {transition} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} {speed} on:playing={playing} on:loaded={loaded} />
{:else if type === "screen"}
    {#key id}
        {#if transition.type === "none"}
            <div bind:clientWidth={width} bind:clientHeight={height}>
                <Window {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" />
            </div>
        {:else}
            <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
                <Window {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" />
            </div>
        {/if}
    {/key}
{:else if type === "camera"}
    {#key id}
        {#if transition.type === "none"}
            <div bind:clientWidth={width} bind:clientHeight={height}>
                <Camera {id} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem={video} />
            </div>
        {:else}
            <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
                <Camera {id} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem={video} />
            </div>
        {/if}
    {/key}
{:else if type === "player"}
    {#key id}
        {#if transition.type === "none"}
            <div>
                <div class="overlay" />
                <Player {outputId} {id} bind:videoData bind:videoTime bind:title {startAt} />
            </div>
        {:else}
            <div transition:custom={transition}>
                <!-- WIP remove when finished -->
                <!-- TODO: this has to be disabled to get rid of ads! -->
                <div class="overlay" />
                <Player {outputId} {id} bind:videoData bind:videoTime bind:title {startAt} />
            </div>
        {/if}
    {/key}
{/if}

<style>
    div {
        /* position: relative; */
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    }

    .overlay {
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 1;
    }
</style>
