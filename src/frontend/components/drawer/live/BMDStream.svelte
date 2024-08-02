<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
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
        if (background) send(BLACKMAGIC, ["CAPTURE_STREAM"], { source: screen })
        else send(BLACKMAGIC, ["CAPTURE_FRAME"], { source: screen })
    })

    $: if (frame) setCanvas()
    async function setCanvas() {
        if (!canvas) return
        console.log(frame)

        let ctx = canvas.getContext("2d")

        // Create a new ImageData object
        let imageData = ctx.createImageData(canvas.width, canvas.height)
        // Copy the pixel data from the Buffer to the ImageData object
        for (let i = 0; i < frame.data.length; i++) {
            imageData.data[i] = frame.data[i]
        }
        // Put the ImageData onto the canvas
        ctx.putImageData(imageData, 0, 0)
    }

    const receiveBlackmagic: any = {
        CAPTURE_FRAME: (data) => {
            if (data.id !== screen.id) return
            frame = data.frame
        },
    }

    receive(BLACKMAGIC, receiveBlackmagic, screen.id)
    onDestroy(() => {
        destroy(BLACKMAGIC, screen.id)
    })
</script>

{#if background}
    <canvas bind:this={canvas} />
{:else}
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click label={screen.name} icon="blackmagic" white showPlayOnHover>
        <canvas bind:this={canvas} />
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
