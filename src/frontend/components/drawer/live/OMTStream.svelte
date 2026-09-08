<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OMT } from "../../../../types/Channels"
    import { outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import { findMatchingOut } from "../../helpers/output"
    import Card from "../Card.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { StreamCanvasRenderer } from "./streamCanvas"
    import { onStreamFrame } from "../../../utils/streamPort"

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

    let canvas: HTMLCanvasElement | undefined

    onMount(() => {
        if (background) {
            if (!mirror) send(OMT, ["CAPTURE_STREAM"], { source: screen, outputId: outputId || Object.keys($outputs)[0] })
        } else send(OMT, ["RECEIVE_STREAM"], { source: screen })
    })

    const renderer = new StreamCanvasRenderer()
    $: if (frame && canvas) renderer.draw(canvas, frame)

    const receiveStream = (data: { id: string; frame: any; time: number }) => {
        if (data.id !== screen.id) return
        loaded = true

        // Take the newest frame rather than dropping by age. Svelte coalesces several arrivals in one
        // tick into a single draw, so a burst still never renders a backlog, while an absolute age cut
        // discarded every 4K frame: 16MB takes longer than that to deliver on its own.
        frame = data.frame
    }

    const stopStream = onStreamFrame(OMT, receiveStream)
    onDestroy(() => {
        renderer.destroy()
        stopStream()
        if (background && !mirror) send(OMT, ["CAPTURE_DESTROY"], { id: screen.id, outputId: outputId || Object.keys($outputs)[0] })
    })

    let loaded = false
</script>

{#if background}
    <canvas bind:this={canvas} />
{:else}
    <Card outlineColor={findMatchingOut(screen.id, $outputs)} active={findMatchingOut(screen.id, $outputs) !== null} on:click title={screen.name} label={screen.name} {loaded} icon="omt" white showPlayOnHover>
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
