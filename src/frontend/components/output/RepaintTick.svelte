<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { destroy, receive } from "../../utils/request"

    // forces an offscreen paint by redrawing a 1px canvas; webContents.invalidate() does not
    export let outputId: string

    let canvas: HTMLCanvasElement
    let flip = false
    const listenerId = "REPAINT_" + outputId

    receive(
        OUTPUT,
        {
            REPAINT: () => {
                const ctx = canvas?.getContext("2d")
                if (!ctx) return
                flip = !flip
                ctx.clearRect(0, 0, 1, 1)
                ctx.fillStyle = flip ? "rgba(0,0,0,0.004)" : "rgba(0,0,0,0.008)"
                ctx.fillRect(0, 0, 1, 1)
            }
        },
        listenerId
    )
    onDestroy(() => destroy(OUTPUT, listenerId))
</script>

<canvas bind:this={canvas} width="1" height="1" />

<style>
    canvas {
        position: absolute;
        left: 0;
        top: 0;
        width: 1px;
        height: 1px;
        pointer-events: none;
    }
</style>
