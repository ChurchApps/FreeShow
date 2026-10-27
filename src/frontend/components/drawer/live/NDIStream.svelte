<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import Card from "../Card.svelte"
    import { StreamCanvasRenderer } from "./streamCanvas"
    import { cacheStreamFrame, getCachedStreamFrame } from "./streamCache"
    import { StreamLayer } from "./streamLayer"
    import { onStreamFrame } from "../../../utils/streamPort"
    import SelectElem from "../../system/SelectElem.svelte"

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
        // only a real output takes the full-quality receive; anything else is a thumbnail
        if (background && mirror) return
        if (background && outputId) send(NDI, ["CAPTURE_STREAM"], { source: screen, outputId })
        else send(NDI, ["RECEIVE_STREAM"], { source: screen })
    })

    const renderer = new StreamCanvasRenderer()
    // only a real output's background drives the composite (see streamLayer); a tile has no outputId
    const dispatch = createEventDispatcher()
    let announced = false
    const layer = new StreamLayer(outputBackground && background && !mirror && outputId ? outputId : "", screen.id, () => (composited = layer.composited))
    let composited = false
    // show the source's last picture until a live frame arrives
    $: if (canvas && !frame && !background) {
        const cached = getCachedStreamFrame(screen.id)
        if (cached) {
            renderer.draw(canvas, cached as never)
            loaded = true
        }
    }

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
        // a remounted tile shows this until its next refresh
        if (!background) cacheStreamFrame(screen.id, data.frame)

        frame = data.frame
    }

    const stopStream = onStreamFrame(NDI, receiveStream)
    onDestroy(() => {
        layer.destroy()
        renderer.destroy()
        stopStream()
        if (background && !mirror && outputId) send(NDI, ["CAPTURE_DESTROY"], { id: screen.id, outputId })
    })

    let loaded = false
</script>

{#if background}
    <!-- hidden while the worker composites this stream -->
    <!-- data-source: part of the page's content hash (MainOutput.svelte) -->
    <canvas bind:this={canvas} data-source={screen.id} style={composited ? `${style};visibility: hidden;` : style} />
{:else}
    <!-- class="context #screen_card" -->
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} {loaded} icon="ndi" white showPlayOnHover showRefreshOnHover on:refresh={() => send(NDI, ["REFRESH_STREAM"], { source: screen })}>
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
