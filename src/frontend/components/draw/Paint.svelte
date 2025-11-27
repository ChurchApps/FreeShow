<script lang="ts">
    import { onMount } from "svelte"
    import type { Draw, DrawLine } from "../../../types/Draw"
    import { draw, drawSettings, outputs, paintCache, paintCacheSlide } from "../../stores"
    import { clone } from "../helpers/array"
    import { getFirstActiveOutput, getOutputResolution } from "../helpers/output"

    export let settings: { [key: string]: any } = {}

    let canvas: HTMLCanvasElement | null = null
    let ctx: CanvasRenderingContext2D | null = null

    let lines: DrawLine[] = []

    // WIP only works when output resolution ratio is the same as the style ratio
    $: outputId = getFirstActiveOutput($outputs)?.id || ""
    $: resolution = getOutputResolution(outputId, $outputs)

    $: outSlide = $outputs[outputId]?.out?.slide
    $: outSlideId = (outSlide?.id || "") + (outSlide?.index || 0) + (outSlide?.layout || "")
    let previousOutSlideId = ""
    $: linkToSlide = settings.link_to_slide
    $: if (linkToSlide && outSlideId !== undefined) updateDrawing()
    function updateDrawing() {
        if (!mounted) return

        paintCacheSlide.update(a => {
            a[previousOutSlideId] = clone(lines)
            return a
        })

        paintCache.set(clone($paintCacheSlide[outSlideId] || []))
        lines = $paintCache
        ctx?.clearRect(0, 0, resolution.width, resolution.height)
        redraw()

        previousOutSlideId = outSlideId
    }

    let mounted = false
    onMount(() => {
        if (canvas) ctx = canvas.getContext("2d")
        if ($paintCache) {
            lines = clone(linkToSlide ? $paintCacheSlide[outSlideId] || [] : $paintCache)
            redraw()
        }
        mounted = true
    })

    function redraw() {
        if (!ctx) return

        for (var i = 1; i < lines.length; i++) {
            let previous = lines[i - 1]
            let current = lines[i]
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

        ctx.clearRect(0, 0, resolution.width, resolution.height)
        lines = []
        paintCache.set([])

        setTimeout(() => {
            drawSettings.update(a => {
                if (a.paint?.clear) delete a.paint.clear
                return a
            })
        }, 100)
    }

    let drawStop = false
    let timeout: NodeJS.Timeout | null = null
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
        if (!$draw || !previousPos || !ctx) return

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
            color: settings.color || "#ffffff"
        }
        lines.push(line)
        paintCache.set(lines)
    }

    let previousPos: Draw | null = null
    let mouseDown = false
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

<canvas bind:this={canvas} width={resolution.width} height={resolution.height} />

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
