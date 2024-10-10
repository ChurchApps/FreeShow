<script lang="ts">
    import { onMount } from "svelte"
    // import YUVRender from "yuv-render"

    export let capture: any
    export let fullscreen: any = false
    export let disabled: any = false
    export let id: string = ""
    export let style: string = ""

    let canvas: any
    let ctx: any
    let width: number = 0
    let height: number = 0

    onMount(() => {
        if (!canvas) return

        ctx = canvas.getContext("2d")
        canvas.width = width * 2.8
        canvas.height = height * 2.8

        // send(OUTPUT, ["PREVIEW_RESOLUTION"], { id, size: { width: canvas.width, height: canvas.height } })
    })

    $: if (fullscreen !== "") setTimeout(updateResolution, 100)
    function updateResolution() {
        if (!canvas) return

        canvas.width = fullscreen ? width * 1.2 : width * 2.8
        canvas.height = fullscreen ? height * 1.2 : height * 2.8
        // send(OUTPUT, ["PREVIEW_RESOLUTION"], { id, size: { width: canvas.width, height: canvas.height } })

        if (capture) updateCanvas()
    }

    // TODO: render in real time this...
    $: if (capture) updateCanvas()
    async function updateCanvas() {
        if (!canvas) return

        // const yuv = new YUVRender(canvas)
        // // yuv.setDimension((capture.size.width / 4) * 3, (capture.size.height / 4) * 3)
        // yuv.setDimension(capture.size.width, capture.size.height)
        // console.log(capture.buffer, capture.size)
        // yuv.render(capture.buffer)

        // // yuv.setDimension(768, 320)
        // // // Uint8Array data
        // // let buffer = new Uint8Array(testFrame)
        // // console.log(buffer)
        // // yuv.render(buffer)

        ///////////////////

        const arr = new Uint8ClampedArray(capture.buffer)
        const pixels = new ImageData(arr, capture.size.width, capture.size.height)
        const bitmap = await createImageBitmap(pixels)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    }
</script>

<div class="center" class:fullscreen class:disabled {style} bind:offsetWidth={width} bind:offsetHeight={height}>
    <canvas {id} class:hide={!capture} style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" class="previewCanvas" bind:this={canvas} />
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        height: 100%;
        width: 100%;
    }
    .center.fullscreen canvas {
        width: unset;
        height: 100%;
    }

    .hide {
        opacity: 0;
    }

    .center.disabled {
        opacity: 0.5;
    }

    canvas {
        width: 100%;
        aspect-ratio: 16/9;
        background-color: black;
    }
</style>
