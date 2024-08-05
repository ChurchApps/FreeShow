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
    export let mirror: boolean = false

    let canvas: any

    onMount(() => {
        if (background) {
            if (!mirror) send(BLACKMAGIC, ["RECEIVE_STREAM"], { source: screen, outputId: Object.keys($outputs)[0] })
        } else send(BLACKMAGIC, ["RECEIVE_FRAME"], { source: screen })
    })

    $: if (frame) setCanvas()
    async function setCanvas() {
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
        CAPTURE_FRAME: (data) => {
            if (data.id !== screen.id || data.type !== "frame") return
            loaded = true

            let timeSinceSent = Date.now() - data.time
            if (timeSinceSent > 100) return // skip frames if overloaded

            // WIP play audio? (data.audio.data ...)

            frame = data.video
        },
    }

    receive(BLACKMAGIC, receiveBlackmagic, screen.id)
    onDestroy(() => {
        destroy(BLACKMAGIC, screen.id)
        if (background && !mirror) send(BLACKMAGIC, ["STOP_RECEIVER"], { id: screen.id, outputId: Object.keys($outputs)[0] })
    })

    let loaded: boolean = false
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
