<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OMT } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import Card from "../Card.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { StreamCanvasRenderer } from "./streamCanvas"
    import { cacheStreamFrame, getCachedStreamFrame } from "./streamCache"
    import { StreamLayer } from "./streamLayer"
    import { onStreamFrame } from "../../../utils/streamPort"

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
        // A full-quality receive belongs only to a real output. Everything else showing this source (a
        // drawer tile, an editor preview) is a thumbnail, and asking for the full stream made the media
        // drawer start a 4K decode per source — including FreeShow's own output — which halved the
        // output rate and made the picture judder.
        if (background && mirror) return
        if (background && outputId) send(OMT, ["CAPTURE_STREAM"], { source: screen, outputId })
        else send(OMT, ["RECEIVE_STREAM"], { source: screen })
    })

    const renderer = new StreamCanvasRenderer()
    // a full-cover background on a captured output is composited by the worker instead (see streamLayer)
    // Only the component actually drawing an output's background may drive the composite. A drawer tile
    // is rendered with `background` too but no outputId, and falling back to the first output in the
    // store made it fight the real output: its small tile is never a full cover, so it kept canceling
    // the composite the output had just turned on, and both flickered.
    const layer = new StreamLayer(outputBackground && background && !mirror && outputId ? outputId : "", () => (composited = layer.composited))
    let composited = false
    // show the last picture this source had immediately; a live frame replaces it when one arrives
    $: if (canvas && !frame && !background) {
        const cached = getCachedStreamFrame(screen.id)
        if (cached) {
            renderer.draw(canvas, cached as never)
            loaded = true
        }
    }

    $: if (frame && canvas) {
        layer.update(canvas, frame.xres, frame.yres)
        if (!composited) renderer.draw(canvas, frame)
    }

    const receiveStream = (data: { id: string; frame: any; time: number }) => {
        if (data.id !== screen.id) return
        loaded = true
        // a tile is only refreshed every so often, so keep this one for the next time it is mounted
        if (!background) cacheStreamFrame(screen.id, data.frame)

        frame = data.frame
    }

    const stopStream = onStreamFrame(OMT, receiveStream)
    onDestroy(() => {
        layer.destroy()
        renderer.destroy()
        stopStream()
        if (background && !mirror && outputId) send(OMT, ["CAPTURE_DESTROY"], { id: screen.id, outputId })
    })

    let loaded = false
</script>

{#if background}
    <!-- while the worker composites this stream into the capture, the canvas must not paint over it -->
    <!-- the source is named in the markup: an output's page reports its markup as what it shows (MainOutput.svelte) -->
    <canvas bind:this={canvas} data-source={screen.id} style={composited ? `${style};visibility: hidden;` : style} />
{:else}
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} {loaded} icon="omt" white showPlayOnHover showRefreshOnHover on:refresh={() => send(OMT, ["REFRESH_STREAM"], { source: screen })}>
        <SelectElem style="display: flex;" id="omt" data={{ id: screen.id, type: "omt", name: screen.name }} draggable>
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
