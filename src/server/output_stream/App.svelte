<script lang="ts">
    import { io } from "socket.io-client"
    import { onMount } from "svelte"
    import Icon from "../common/components/Icon.svelte"
    import { audioContext, mutePlayback, processBuffer, unmutePlayback } from "../common/util/audioStream"

    let socket = io()

    // FPS
    let secondsTimeout: NodeJS.Timeout | null = null
    let frames = 0
    let count = 0
    let fps = 0
    let start = 0
    let timeLoss = 0
    function startFPS() {
        start = Date.now()
        let time = 1000 - timeLoss
        secondsTimeout = setTimeout(() => {
            fps = count
            count = 0

            timeLoss = Date.now() - start - time
            if (timeLoss < time) setTimeout(() => (count = 0), timeLoss)
            startFPS()
        }, time)
    }

    let audioSignal = false
    let audioMuted = true
    let showAudioIcon = false

    // let initialDelay = 0
    socket.on("OUTPUT_STREAM", msg => {
        switch (msg.channel) {
            case "STREAM":
                frames++
                // FPS
                count++
                if (!secondsTimeout) startFPS()

                // this did not work well across different devices
                // if (!initialDelay) {
                //     // include device time offset / transmission delay
                //     initialDelay = Date.now() - msg.data.time
                // } else {
                //     let timeSinceSent = Date.now() - initialDelay - msg.data.time
                //     if (timeSinceSent > 5000) return // skip frames if overloaded
                // }

                capture = msg.data

                socket.emit("OUTPUT_STREAM", { channel: "STREAM_DONE", data: { id: msg.data.id, success: true } })
                break
            case "AUDIO_BUFFER":
                if (audioSignal && audioMuted) return
                if (!audioSignal) {
                    showAudioIcon = true
                    setTimeout(() => (showAudioIcon = false), 3000)
                }
                audioSignal = true

                processBuffer(msg.data.buffer, { sampleRate: msg.data.sampleRate, channelCount: msg.data.channelCount })
                break
        }
    })

    let capture: any = {}

    let canvas: any
    let ctx = canvas?.getContext("2d")
    let width: number = 0
    let height: number = 0

    onMount(() => {
        if (!canvas) return

        ctx = canvas.getContext("2d")
        canvas.width = width
        canvas.height = height

        checkSize()

        // TODO: request frame on load
    })

    let lastUpdate = 0
    const frameRateLimit = 1000 / 30 // Limit to 30 FPS
    $: if (capture) throttledUpdateCanvas()
    function throttledUpdateCanvas() {
        const now = Date.now()
        if (now - lastUpdate < frameRateLimit) return
        lastUpdate = now
        updateCanvas()
    }

    async function updateCanvas() {
        if (!canvas) return

        const arr = new Uint8ClampedArray(capture.buffer)
        const pixels = new ImageData(arr, capture.size.width, capture.size.height)
        const bitmap = await createImageBitmap(pixels)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

        // Clean up bitmap to prevent memory leaks
        bitmap.close()
    }

    // screen stretch
    let imgHeight = false

    $: if (width) checkSize()
    function checkSize() {
        if (width < canvas?.width) imgHeight = true
        else imgHeight = false
    }

    // FULLSCREEN

    let isFullscreen: boolean = false
    function toggleFullscreen() {
        var doc = window.document
        var docElem = doc.documentElement

        if (!doc.fullscreenElement) {
            docElem.requestFullscreen.call(docElem)
            isFullscreen = true
        } else {
            doc.exitFullscreen.call(doc)
            isFullscreen = false
        }
    }

    // button
    let clicked: boolean = false
    let timeout: NodeJS.Timeout | null = null
    function click() {
        clicked = true
        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => {
            clicked = false
            timeout = null
        }, 2000)
    }

    function toggleMute() {
        if (!audioMuted) {
            audioMuted = true
            mutePlayback()
            return
        }

        audioMuted = false

        if (audioContext?.state === "suspended") {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed after user interaction")
            })
            return
        }

        unmutePlayback()
    }
</script>

<svelte:window on:click={click} />

<div class="center" bind:offsetWidth={width} bind:offsetHeight={height}>
    <canvas class:imgHeight style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" class:height={width / height < (capture?.size?.width || 16) / (capture?.size?.height || 9)} class="previewCanvas" bind:this={canvas} />
</div>

{#if clicked}
    <button on:click={toggleFullscreen}>
        <Icon id={isFullscreen ? "exitFullscreen" : "fullscreen"} size={2.2} white />
    </button>
{/if}

{#if !isFullscreen && clicked}
    <div class="count" style="position: absolute;bottom: 4px;inset-inline-start: 4px;font-size: 0.5em;opacity: 0.3;">
        FPS: {fps} | Frame: {frames} | {capture?.size?.width || 1920}x{capture?.size?.height || 1080}
    </div>
{/if}

{#if (clicked || showAudioIcon) && audioSignal}
    <button on:click={toggleMute} style="inset-inline-start: 20px;">
        <Icon id={audioMuted ? "muted" : "volume"} size={1.5} white={audioMuted} />
    </button>
{/if}

<style>
    :global(*) {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        user-select: none;

        outline-offset: -4px;
        outline-color: var(--secondary);
    }

    :global(html) {
        height: 100%;
    }

    :global(body) {
        /* background-color: var(--primary); */
        background-color: #000000;
        color: var(--text);
        /* transition: background-color 0.5s; */
        -webkit-tap-highlight-color: transparent;

        font-family: system-ui;
        font-size: 1.5em;

        height: 100%;
        width: 100%;

        overflow: hidden;
    }

    :root {
        --primary: #242832;
        --primary-lighter: #2f3542;
        --primary-darker: #191923;
        --primary-darkest: #12121c;
        --text: #f0f0ff;
        --textInvert: #131313;
        --secondary: #f0008c;
        --secondary-opacity: rgba(240, 0, 140, 0.5);
        --secondary-text: #f0f0ff;

        --hover: rgb(255 255 255 / 0.05);
        --focus: rgb(255 255 255 / 0.1);
        /* --active: rgb(230 52 156 / .8); */

        /* --navigation-width: 18vw; */
        --navigation-width: 300px;
    }

    /* VIDEO */
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;
    }

    canvas {
        background-color: #000000;
        aspect-ratio: 16/9;
        /* width: 100%; */
        height: 100%;
        /* object-fit: contain; */
    }
    canvas.height {
        height: initial;
        width: 100%;
    }

    .imgHeight {
        height: initial;
        width: 100%;
    }

    /* fullscreen */
    button {
        position: absolute;
        inset-inline-end: 20px;
        bottom: 20px;
        width: 60px;
        height: 60px;

        display: flex;
        justify-content: center;
        align-items: center;

        /* background-color: white; */
        background-color: var(--primary-lighter);
        color: var(--text);

        padding: 10px;
        border-radius: 50%;
        border: 2px solid black;
    }
    button:hover,
    button:active {
        background-color: rgb(255 255 255 / 0.2);
    }
</style>
