<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { outputs } from "../../../stores"
    import { findMatchingOut } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let screen: { id: string; name: string }
    export let streams: MediaStream[]
    export let background = false

    let loaded = false

    let canvas: HTMLCanvasElement | undefined
    let videoElem: HTMLVideoElement | undefined

    function ready() {
        if (loaded || !videoElem || background || !canvas) return

        canvas.width = videoElem.offsetWidth
        canvas.height = videoElem.offsetHeight
        canvas.getContext("2d")?.drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
        loaded = true
        // the tile is a still, so the capture is no longer needed
        stopStream()
    }

    // TS issue https://github.com/electron/electron/issues/27139
    // a tile only needs one frame, and a drawer opens many at once
    let constraints: any = {
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: screen.id,
                maxWidth: background ? 1920 : 640,
                maxHeight: background ? 1080 : 360,
                // maxAspectRatio: 16/9,
                maxFrameRate: background ? 60 : 5
            }
        }
    }

    let retryTimeout: NodeJS.Timeout | null = null
    let currentStream: MediaStream | null = null
    let destroyed = false
    function stopStream() {
        currentStream?.getTracks().forEach((track) => track.stop())
        currentStream = null
    }
    onDestroy(() => {
        destroyed = true
        if (retryTimeout) clearTimeout(retryTimeout)
        // the tiles get a throwaway `streams` array, so nothing else stops these
        stopStream()
    })

    onMount(capture)
    function capture() {
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                if (destroyed || !videoElem) return stream.getTracks().forEach((track) => track.stop())

                currentStream = stream
                streams.push(stream)
                videoElem.srcObject = stream
                videoElem.onloadedmetadata = () => {
                    videoElem?.play()
                    setTimeout(ready, 1000)
                }
            })
            .catch(function (err) {
                if (destroyed) return

                let msg: string = err.message
                console.error(err.name + ": " + msg)

                // if (err.name === "NotReadableError") {
                sendMain(Main.ACCESS_SCREEN_PERMISSION)
                // }

                // retry
                retryTimeout = setTimeout(capture, 5000)
            })
    }
</script>

{#if background}
    <video style="width: 100%;height: 100%;pointer-events: none;position: absolute;" bind:this={videoElem}>
        <track kind="captions" />
    </video>
{:else}
    <Card mediaData={JSON.stringify(constraints)} class="context #screen_card" {loaded} outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} icon={screen.id.includes("screen") ? "screen" : "window"} white={!screen.id.includes("screen")} showPlayOnHover>
        <SelectElem style="display: flex;" id="screen" data={{ id: screen.id, type: "screen", name: screen.name }} draggable>
            <canvas bind:this={canvas} />
            {#if !loaded}
                <video style="pointer-events: none;position: absolute;" bind:this={videoElem}>
                    <track kind="captions" />
                </video>
            {/if}
        </SelectElem>
    </Card>
{/if}

<style>
    video {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
    }

    canvas {
        width: 100%;
        height: 100%;
        aspect-ratio: 1920/1080;

        object-fit: contain;
    }
</style>
