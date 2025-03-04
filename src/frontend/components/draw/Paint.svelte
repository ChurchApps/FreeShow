<script lang="ts">
    import { onMount } from "svelte"
    import { draw, drawSettings, paintCache } from "../../stores"

    export let settings: any = {}

    let canvas: any = null
    let ctx: any = null

    let lines: any[] = []

    onMount(() => {
        if (canvas) ctx = canvas.getContext("2d")
        if ($paintCache) {
            lines = $paintCache
            redraw()
        }
    })

    function redraw() {
        if (!ctx) return

        for (var i = 1; i < lines.length; i++) {
            let previous: any = lines[i - 1]
            let current: any = lines[i]
            if (current !== "mouseup") {
                if (previous === "mouseup") previous = current

                ctx.beginPath()
                ctx.moveTo(previous.x, previous.y)
                ctx.lineWidth = current.size
                ctx.lineCap = "round"
                ctx.strokeStyle = current.color
                ctx.lineTo(current.x, current.y)
                ctx.stroke()
            }
        }
    }

    // TODO: history!

    $: if (settings.clear) clear()
    function clear() {
        if (!ctx) return

        ctx.clearRect(0, 0, 1920, 1080)
        lines = []
        paintCache.set([])

        setTimeout(() => {
            drawSettings.update((ds: any) => {
                if (ds.paint?.clear) delete ds.paint.clear
                return ds
            })
        }, 100)
    }

    let drawStop: boolean = false
    let timeout: any = null
    $: if (settings.dots) startTimeout()
    function startTimeout() {
        drawStop = false
        if (timeout || !settings.dots) return
        timeout = setTimeout(() => {
            drawStop = true
            setTimeout(() => {
                timeout = null
                startTimeout()
            }, 20)
        }, 1)
    }

    $: if (mouseDown && $draw && !drawStop) drawLine()
    function drawLine() {
        if (!$draw || !previousPos) return

        // ctx.beginPath()
        ctx.moveTo(previousPos.x, previousPos.y)
        let d = $draw
        if (settings.threed) d = { x: d.x / 1.1, y: d.y / 1.1 }
        ctx.lineTo(d.x, d.y)
        ctx.stroke()

        store(d.x, d.y)
    }

    function store(x: number, y: number) {
        let line = {
            x: x,
            y: y,
            size: settings.size || 10,
            color: settings.color || "#ffffff",
        }
        lines.push(line)
        paintCache.set(lines)
    }

    let previousPos: any = null
    let mouseDown: boolean = false
    $: {
        if ($draw !== null && !mouseDown) mouseDown = true
        else if ($draw === null) mouseDown = false
    }
    $: if (mouseDown && ctx) {
        ctx.beginPath()
        previousPos = $draw
        // ctx.moveTo(previousPos.x, previousPos.y)
        ctx.lineWidth = settings.size || 10
        ctx.lineCap = "round"
        ctx.strokeStyle = settings.color || "#ffffff"
    } else {
        previousPos = null
        if (lines.length && lines[lines.length - 1] !== "mouseup") lines.push("mouseup")
    }
</script>

<canvas bind:this={canvas} width={1920} height={1080} />

<style>
    canvas {
        position: absolute;
        top: 0;
        left: 0;
        border: none;
        background-color: transparent;
        width: 100%;
        height: 100%;
    }
</style>
