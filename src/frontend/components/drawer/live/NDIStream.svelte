<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import Card from "../Card.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    interface Screen {
        id: string
        name: string
    }
    export let screen: Screen
    let frame: any
    export let background = false
    export let mirror = false

    let canvas: HTMLCanvasElement | undefined

    onMount(() => {
        if (background) {
            if (!mirror) send(NDI, ["CAPTURE_STREAM"], { source: screen, outputId: Object.keys($outputs)[0] })
        } else send(NDI, ["RECEIVE_STREAM"], { source: screen })
    })

    $: if (frame) setCanvas()
    function setCanvas() {
        if (!canvas) return

        let ctx = canvas.getContext("2d")

        const WIDTH = frame.xres
        const HEIGHT = frame.yres
        canvas.width = WIDTH
        canvas.height = HEIGHT

        const imageData = new ImageData(new Uint8ClampedArray(frame.data), WIDTH, HEIGHT)
        ctx?.putImageData(imageData, 0, 0)
    }

    const receiveNDI = {
        RECEIVE_STREAM: (data: { id: string; frame: any; time: number }) => {
            if (data.id !== screen.id) return
            loaded = true

            let timeSinceSent = Date.now() - data.time
            if (timeSinceSent > 100) return // skip frames if overloaded

            frame = data.frame
        },
    }

    receive(NDI, receiveNDI, screen.id)
    onDestroy(() => {
        destroy(NDI, screen.id)
        if (background && !mirror) send(NDI, ["CAPTURE_DESTROY"], { id: screen.id, outputId: Object.keys($outputs)[0] })
    })

    let loaded = false
</script>

{#if background}
    <canvas bind:this={canvas} />
{:else}
    <!-- class="context #live_card" -->
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} {loaded} icon="ndi" white showPlayOnHover>
        <SelectElem style="display: flex;" id="ndi" data={{ id: screen.id, type: "ndi", name: screen.name }} draggable>
            <canvas bind:this={canvas} />
        </SelectElem>
    </Card>
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;
        /* aspect-ratio: 1920/1080; */

        object-fit: contain;
    }
</style>
