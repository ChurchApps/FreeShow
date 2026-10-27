<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import { onStreamFrame } from "../../../utils/streamPort"
    import { findMatchingOut } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import { StreamCanvasRenderer } from "./streamCanvas"
    import { StreamLayer } from "./streamLayer"

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
    // only an output's own background may be composited under the page
    export let outputBackground = false

    let canvas: HTMLCanvasElement | undefined

    onMount(() => {
        if (background) {
            // only a real output takes the full-quality receive; a tile has no outputId (see OMTStream)
            if (!mirror) send(BLACKMAGIC, ["RECEIVE_STREAM"], { source: screen, outputId: outputId || undefined })
        } else send(BLACKMAGIC, ["RECEIVE_FRAME"], { source: screen })
    })

    const renderer = new StreamCanvasRenderer()
    // only a real output's background drives the composite (see streamLayer); a tile has no outputId
    const dispatch = createEventDispatcher()
    let announced = false
    const layer = new StreamLayer(outputBackground && background && !mirror && outputId ? outputId : "", screen.id, () => (composited = layer.composited))
    let composited = false
    $: if (frame && canvas) {
        layer.update(canvas, frame.xres, frame.yres)
        if (layer.drawing) {
            renderer.draw(canvas, frame)
            layer.drawn()
        }
        // Background.svelte switches to a new background once it reports loaded
        if (!announced) {
            announced = true
            dispatch("loaded")
        }
    }

    const receiveStream = (data: { id: string; frame: any; time: number }) => {
        if (data.id !== screen.id) return
        loaded = true

        // newest frame wins: Svelte coalesces a burst into one draw
        frame = data.frame
    }

    const stopStream = onStreamFrame(BLACKMAGIC, receiveStream)
    onDestroy(() => {
        layer.destroy()
        renderer.destroy()
        stopStream()
        if (background && !mirror) send(BLACKMAGIC, ["STOP_RECEIVER"], { id: screen.id, outputId: outputId || Object.keys($outputs)[0] })
    })

    let loaded = false
</script>

{#if background}
    <!-- hidden while the worker composites this stream -->
    <!-- data-source: part of the page's content hash (MainOutput.svelte) -->
    <canvas bind:this={canvas} data-source={screen.id} style={composited ? `${style};visibility: hidden;` : style} />
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
