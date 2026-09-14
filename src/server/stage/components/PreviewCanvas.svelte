<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { send } from "../util/socket"

    // frames are pushed from the app ("STREAM_FRAME") while subscribed - no frame polling needed
    export let outputId: string | undefined = undefined
    export let capture: any

    // subscribe & renew (heartbeat keeps the subscription alive across reconnects; app expires stale ones)
    const SUBSCRIBE_INTERVAL = 3000
    send("STREAM_SUBSCRIBE", { outputId })
    const subscribeInterval = setInterval(() => send("STREAM_SUBSCRIBE", { outputId }), SUBSCRIBE_INTERVAL)
    onDestroy(() => {
        clearInterval(subscribeInterval)
        send("STREAM_UNSUBSCRIBE")
    })

    let canvas: any
    let ctx: any
    let width: number = 0
    let height: number = 0

    onMount(() => {
        if (!canvas) return

        ctx = canvas.getContext("2d")
        canvas.width = width * 1.2
        canvas.height = height * 1.2
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
        if (!canvas || !capture) return

        let bitmap: ImageBitmap
        if (capture.jpeg) {
            // pushed frame (compressed)
            bitmap = await createImageBitmap(new Blob([capture.jpeg], { type: "image/jpeg" }))
        } else if (capture.buffer && capture.size) {
            // legacy polled frame (raw RGBA)
            const arr = new Uint8ClampedArray(capture.buffer)
            const pixels = new ImageData(arr, capture.size.width, capture.size.height)
            bitmap = await createImageBitmap(pixels)
        } else {
            return
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

        // Clean up bitmap to prevent memory leaks
        bitmap.close()
    }
</script>

<div class="center" bind:offsetWidth={width} bind:offsetHeight={height}>
    <canvas style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" class="previewCanvas" bind:this={canvas} />
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;
    }

    canvas {
        /* width: 100%; */
        height: 100%;
        aspect-ratio: 16/9;
        background-color: black;
    }
</style>
