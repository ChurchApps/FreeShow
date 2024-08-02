<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import Card from "../Card.svelte"

    interface Screen {
        id: string
        name: string
    }
    export let screen: Screen
    let frame: any
    export let background: boolean = false

    let canvas: any

    onMount(() => {
        // WIP: frame rate
        if (background) send(NDI, ["CAPTURE_STREAM"], { source: screen })
        else send(NDI, ["RECEIVE_STREAM"], { source: screen })
    })

    $: if (frame) setCanvas()
    async function setCanvas() {
        if (!canvas) return
        console.log(frame)

        let ctx = canvas.getContext("2d")

        const WIDTH = frame.xres
        const HEIGHT = frame.yres

        // i don't know why
        // when colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA is not set, this shows a wrong colored QR code
        // when is is set the data seems correct but is all black...
        // var mergedArray = new Uint8Array(frame.data.length * 2)
        // mergedArray.set(frame.data)
        // mergedArray.set(frame.data, frame.data.length)

        console.log(WIDTH * HEIGHT * 4, "===", frame.data.length)

        const imageData = new ImageData(new Uint8ClampedArray(frame.data), WIDTH, HEIGHT)
        ctx.putImageData(imageData, 0, 0)

        // // Create a new ImageData object
        // let imageData = ctx.createImageData(canvas.width, canvas.height)
        // // Copy the pixel data from the Buffer to the ImageData object
        // for (let i = 0; i < frame.data.length; i++) {
        //     imageData.data[i] = frame.data[i]
        // }
        // // Put the ImageData onto the canvas
        // ctx.putImageData(imageData, 0, 0)

        //////////////

        // var clampedArray = new Uint8ClampedArray(frame.data)
        // var imageData = new ImageData(clampedArray, canvas.width, canvas.height)
        // // var imageData = new ImageData(clampedArray, frame.xres, frame.yres);
        // ctx.putImageData(imageData, 0, 0)

        //////////////

        // canvas.width = frame.xres
        // canvas.height = frame.yres

        // const arr = new Uint8ClampedArray(frame.data)
        // const pixels = new ImageData(arr, frame.xres, frame.yres)
        // const bitmap = await createImageBitmap(pixels)

        // ctx.clearRect(0, 0, canvas.width, canvas.height)
        // ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    }

    const receiveNDI: any = {
        RECEIVE_STREAM: (data) => {
            if (data.id !== screen.id) return
            frame = data.frame
        },
    }

    receive(NDI, receiveNDI, screen.id)
    onDestroy(() => {
        destroy(NDI, screen.id)
    })
</script>

{#if background}
    <canvas bind:this={canvas} />
{:else}
    <!-- class="context #live_card" -->
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click label={screen.name} icon="ndi" white showPlayOnHover>
        <!-- <SelectElem style="display: flex;" id="ndi" data={{ id: screen.id, type: "ndi", name: screen.name }} draggable> -->
        <canvas bind:this={canvas} />
        <!-- </SelectElem> -->
    </Card>
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;
        aspect-ratio: 1920/1080;

        object-fit: contain;
    }
</style>
