<script lang="ts" context="module">
    let streamInstances = 0
</script>

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
    export let background = false
    export let mirror = false
    // the output showing this stream owns the receiver: without its id the frames would be routed to
    // whichever output happens to come first in the store, and this output would never receive any
    export let outputId = ""

    let canvas: any

    onMount(() => {
        if (background) {
            if (!mirror) send(BLACKMAGIC, ["RECEIVE_STREAM"], { source: screen, outputId: outputId || Object.keys($outputs)[0] })
        } else send(BLACKMAGIC, ["RECEIVE_FRAME"], { source: screen })
    })

    $: if (frame) setCanvas()
    function setCanvas() {
        if (!canvas) return

        let ctx = canvas.getContext("2d")

        const WIDTH = frame.width
        const HEIGHT = frame.height
        canvas.width = WIDTH
        canvas.height = HEIGHT

        const imageData = new ImageData(new Uint8ClampedArray(frame.data), WIDTH, HEIGHT)
        ctx.putImageData(imageData, 0, 0)
    }

    const receiveBlackmagic: any = {
        RECEIVE_STREAM: (data) => {
            //  || data.frame?.type !== "frame"
            if (data.id !== screen.id || !data.frame.video) return
            loaded = true

            // WIP play audio? (data.audio.data ...)

            // Take the newest frame rather than dropping by age. Svelte coalesces several arrivals in
            // one tick into a single draw, so a burst still never renders a backlog, while an absolute
            // age cut discarded every 4K frame: 16MB takes longer than that to deliver on its own.
            frame = data.frame.video
        }
    }

    // the preload keeps one listener per id, so two components showing the same source must not share one
    const receiverId = `${screen.id}#${++streamInstances}`

    receive(BLACKMAGIC, receiveBlackmagic, receiverId)
    onDestroy(() => {
        destroy(BLACKMAGIC, receiverId)
        if (background && !mirror) send(BLACKMAGIC, ["STOP_RECEIVER"], { id: screen.id, outputId: outputId || Object.keys($outputs)[0] })
    })

    let loaded = false
</script>

{#if background}
    <canvas bind:this={canvas} />
{:else}
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click label={screen.name} {loaded} icon="blackmagic" white showPlayOnHover>
        <canvas bind:this={canvas} />
    </Card>
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;

        object-fit: contain;
    }
</style>
