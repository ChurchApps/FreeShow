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
        // the tile is a still image, so the desktop capture has done its job; leaving it running kept a
        // 1080p60 Windows capture alive per tile for the rest of the session
        stopStream()
    }

    // TS issue https://github.com/electron/electron/issues/27139
    // A tile only needs one frame for its still, and a drawer opens many at once: asking each for 1080p60
    // spun up that many full-rate desktop captures together, which is what floods the console with
    // wgc_capture_session ProcessFrame warnings while they warm up.
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
    let stream: MediaStream | null = null
    function stopStream() {
        stream?.getTracks().forEach((track) => track.stop())
        stream = null
    }
    onDestroy(() => {
        if (retryTimeout) clearTimeout(retryTimeout)
        // nothing else stops these: the tiles are handed a throwaway `streams` array
        stopStream()
    })

    // take the still again on demand (the card's refresh button)
    function refresh() {
        stopStream()
        loaded = false
        capture()
    }

    onMount(capture)
    function capture() {
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((captured) => {
                if (!videoElem) {
                    captured.getTracks().forEach((track) => track.stop())
                    return
                }

                stream = captured
                streams.push(captured)
                videoElem.srcObject = captured
                videoElem.onloadedmetadata = () => {
                    videoElem?.play()
                    setTimeout(ready, 1000)
                }
            })
            .catch(function (err) {
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
    <Card mediaData={JSON.stringify(constraints)} class="context #screen_card" {loaded} outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} icon={screen.id.includes("screen") ? "screen" : "window"} white={!screen.id.includes("screen")} showPlayOnHover showRefreshOnHover on:refresh={refresh}>
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
