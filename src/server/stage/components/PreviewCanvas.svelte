<script lang="ts">
    import { onMount } from "svelte"

    export let id: string
    export let alpha: boolean
    export let socket: any
    export let capture: any

    onMount(() => {
        socket.emit("STAGE", { id: socket.id, channel: "REQUEST_STREAM", data: { outputId: id, alpha } })
    })

    // export let capture: any
    // export let fullscreen: any = false
    // export let disabled: any = false
    // export let id: string = ""
    // export let style: string = ""

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

    $: if (capture) updateCanvas()
    async function updateCanvas() {
        if (!canvas) return

        const arr = new Uint8ClampedArray(capture.buffer)
        const pixels = new ImageData(arr, capture.size.width, capture.size.height)
        const bitmap = await createImageBitmap(pixels)

        if (!canvas) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
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
