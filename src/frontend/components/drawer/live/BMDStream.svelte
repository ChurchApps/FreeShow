<script lang="ts" context="module">
    let streamInstances = 0
</script>

<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    interface Screen {
        id: string
        name: string
    }
    export let screen: Screen
    let frame: any
    export let background = false
    export let mirror = false
    // the output showing this stream owns the receiver
    export let outputId = ""
    export let style = ""

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
        ctx?.putImageData(imageData, 0, 0)
    }

    const receiveBlackmagic: any = {
        RECEIVE_STREAM: (data) => {
            //  || data.frame?.type !== "frame"
            if (data.id !== screen.id || !data.frame.video) return
            loaded = true

            // WIP play audio? (data.audio.data ...)

            frame = data.frame.video
        }
    }

    const receiverId = `${screen.id}#${++streamInstances}`

    receive(BLACKMAGIC, receiveBlackmagic, receiverId)
    onDestroy(() => {
        destroy(BLACKMAGIC, receiverId)
        if (background && !mirror) send(BLACKMAGIC, ["STOP_RECEIVER"], { id: screen.id, outputId: outputId || Object.keys($outputs)[0] })
    })

    let loaded = false
</script>

{#if background}
    <canvas bind:this={canvas} {style} />
{:else}
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click label={screen.name} {loaded} icon="blackmagic" white showPlayOnHover>
        <SelectElem style="display: flex;" id="blackmagic" data={{ id: screen.id, type: "blackmagic", name: screen.name }} draggable>
            <canvas bind:this={canvas} />
        </SelectElem>
    </Card>
{/if}

<style>
    canvas {
        width: 100%;
        height: 100%;

        object-fit: contain;
    }
</style>
