<script lang="ts">
    import { onMount } from "svelte"
    import { draw, previewBuffers } from "../../stores"
    import { getActiveOutputs } from "../helpers/output"

    export let settings: any

    let canvas: any
    let ctx: any

    onMount(() => {
        if (!canvas) return

        ctx = canvas.getContext("2d")
        canvas.width = canvas.clientWidth * 2.8
        canvas.height = canvas.clientHeight * 2.8
    })

    $: outputId = getActiveOutputs()[0]
    $: capture = $previewBuffers[outputId]
    $: if (capture) updateCanvas()
    async function updateCanvas() {
        if (!canvas) return

        const arr = new Uint8ClampedArray(capture.buffer)
        const pixels = new ImageData(arr, capture.size.width, capture.size.height)
        const bitmap = await createImageBitmap(pixels)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    }

    let zoom = 3

    // https://www.w3schools.com/howto/tryit.asp?filename=tryhow_js_image_magnifier_glass
    // $: console.log(-1 * ($draw!.x * zoom - canvas?.clientWidth + zoom))
</script>

{#if $draw}
    <div
        class="zoom"
        style="--left: {$draw.x}px;--top: {$draw.y}px;--width: {canvas?.clientWidth}px;--height: {canvas?.clientHeight}px;--zoom: {zoom};--size: {settings?.size}px;left: {$draw.x}px;top: {$draw.y}px;border-radius: {settings?.radius}%;opacity: {settings?.opacity};width: {settings?.size}px;height: {settings?.size}px;"
    >
        <canvas style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" bind:this={canvas} />
    </div>
{/if}

<style>
    .zoom {
        position: absolute;
        width: 300px;
        height: 300px;
        background-color: transparent;
        border-radius: 50%;
        box-shadow: 0 0 0 50000px black;

        overflow: hidden;
    }

    canvas {
        display: flex;
        align-items: center;
        justify-content: center;

        object-fit: cover;

        position: absolute;
        left: calc(-1 * (var(--left) * var(--zoom) - var(--width) + var(--zoom)));
        top: calc(-1 * (var(--top) * var(--zoom) - var(--height) + var(--zoom)));
        width: calc(var(--width) * var(--zoom));
        height: calc(var(--height) * var(--zoom));
        /* left: -10%;
        top: -10%;
        height: 120%;
        width: 120%; */
    }
</style>
