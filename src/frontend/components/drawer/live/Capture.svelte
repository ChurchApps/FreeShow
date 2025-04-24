<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { outputs } from "../../../stores"
    import { findMatchingOut } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let screen: { id: string; name: string }
    export let streams: MediaStream[]
    export let background: boolean = false

    let loaded = false

    let canvas: HTMLCanvasElement | undefined
    let videoElem: HTMLVideoElement | undefined

    function ready() {
        if (loaded || !videoElem || background || !canvas) return

        canvas.width = videoElem.offsetWidth
        canvas.height = videoElem.offsetHeight
        canvas.getContext("2d")?.drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
        loaded = true
    }

    // TS issue https://github.com/electron/electron/issues/27139
    let constraints: any = {
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: screen.id,
                maxWidth: 1920,
                maxHeight: 1080,
                // maxAspectRatio: 16/9,
                maxFrameRate: 60,
            },
        },
    }

    onMount(capture)
    function capture() {
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                if (!videoElem) return

                streams.push(stream)
                videoElem.srcObject = stream
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
                setTimeout(capture, 5000)
            })
    }
</script>

{#if background}
    <video style="width: 100%;height: 100%;pointer-events: none;position: absolute;" bind:this={videoElem}>
        <track kind="captions" />
    </video>
{:else}
    <Card
        mediaData={JSON.stringify(constraints)}
        class="context #live_card"
        {loaded}
        outlineColor={findMatchingOut(screen.id, $outputs)}
        active={findMatchingOut(screen.id, $outputs) !== null}
        on:click
        title={screen.name}
        label={screen.name}
        icon={screen.id.includes("screen") ? "screen" : "window"}
        white={!screen.id.includes("screen")}
        showPlayOnHover
    >
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
        inset-inline-start: 50%;
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
