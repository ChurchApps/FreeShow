<script lang="ts">
    import { onDestroy, onMount } from "svelte"
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
    // only an output's own background may be composited underneath the page; an item or a scene is drawn
    // in its place in the layer order
    export let outputBackground = false

    let canvas: HTMLCanvasElement | undefined

    onMount(() => {
        if (background) {
            // only a real output takes the full-quality receive; a tile has no outputId (see OMTStream)
            if (!mirror) send(BLACKMAGIC, ["RECEIVE_STREAM"], { source: screen, outputId: outputId || undefined })
        } else send(BLACKMAGIC, ["RECEIVE_FRAME"], { source: screen })
    })

    const renderer = new StreamCanvasRenderer()
    // a full-cover background on a captured output is composited by the worker instead (see streamLayer)
    // Only the component actually drawing an output's background may drive the composite. A drawer tile
    // is rendered with `background` too but no outputId, and falling back to the first output in the
    // store made it fight the real output: its small tile is never a full cover, so it kept cancelling
    // the composite the output had just turned on, and both flickered.
    const layer = new StreamLayer(outputBackground && background && !mirror && outputId ? outputId : "", () => (composited = layer.composited))
    let composited = false
    $: if (frame && canvas) {
        layer.update(canvas, frame.xres, frame.yres)
        if (!composited) renderer.draw(canvas, frame)
    }

    // frames come from the receive process over the stream transport (see streamPort.ts), not over IPC
    const receiveStream = (data: { id: string; frame: any; time: number }) => {
        if (data.id !== screen.id) return
        loaded = true

        // Take the newest frame rather than dropping by age: Svelte coalesces several arrivals in one
        // tick into a single draw, so a burst never renders a backlog.
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
    <!-- while the worker composites this stream into the capture, the canvas must not paint over it -->
    <canvas bind:this={canvas} style={composited ? `${style};visibility: hidden;` : style} />
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
