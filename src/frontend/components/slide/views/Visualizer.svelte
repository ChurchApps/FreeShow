<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Item } from "../../../../types/Show"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { currentWindow, visualizerData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { drawKaleidoscope } from "./visualizerKaleidoscope"
    import { drawParticles } from "./visualizerParticles"

    export let item: Item
    export let preview = false
    export let edit = false

    // visualizer
    // TODO: videos & mics
    // WIP circles: https://medium.com/swlh/building-a-audio-visualizer-with-javascript-324b8d420e7

    let analysers = AudioAnalyser.getAnalysers()

    let checkInterval: NodeJS.Timeout | null = null
    if (preview && !$currentWindow && !analysers.length) {
        checkInterval = setInterval(() => {
            analysers = AudioAnalyser.getAnalysers()
            if (analysers.length) clearInterval(checkInterval!)
        }, 800)
    }

    $: color = item?.visualizer?.color || null
    $: padding = (item?.visualizer?.padding || 0) - 0.5
    $: visualizerType = item?.visualizer?.type || "bars"

    let canvas: HTMLCanvasElement | undefined
    let ctx: CanvasRenderingContext2D | null = null

    function stopLoop() {
        if (rendering) {
            cancelAnimationFrame(rendering)
            rendering = 0
        }
    }

    onDestroy(() => {
        stopLoop()
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }

        visualizerData.set(null)
        if (preview) send(OUTPUT, ["VISUALIZER_DATA"], null)

        if (checkInterval) {
            clearInterval(checkInterval)
            checkInterval = null
        }
    })

    let rendering = 0

    $: if (canvas && item) {
        if (edit) {
            stopLoop()
            drawEditMode()
        } else if (!$currentWindow && (analysers?.length || $visualizerData)) {
            startLoop()
        }
    }

    $: if ($currentWindow && $visualizerData && canvas && item && !edit) {
        renderOutputFrame()
    }

    function ensureCanvas() {
        if (!canvas) return null
        const targetWidth = Math.ceil(canvas.clientWidth) || window.innerWidth
        const targetHeight = Math.ceil(canvas.clientHeight) || window.innerHeight

        if (!ctx || canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth
            canvas.height = targetHeight
            ctx = canvas.getContext("2d")
        }
        return ctx
    }

    function drawEditMode() {
        const cCtx = ensureCanvas()
        if (!cCtx || !canvas) return

        const WIDTH = canvas.width
        const HEIGHT = canvas.height
        const bufferLength = 128
        const barWidth = (WIDTH / bufferLength - padding) * 1.42

        cCtx.clearRect(0, 0, WIDTH, HEIGHT)
        const mockBars: any[] = []
        for (let i = 0; i < bufferLength; i++) {
            const sineFactor = Math.abs(Math.sin((1 - i / bufferLength) * Math.PI * 8))
            const barHeight = HEIGHT * (0.5 * sineFactor + 0.5) * ((bufferLength - i) / bufferLength)
            mockBars.push({ height: barHeight, percentage: sineFactor })
        }

        if (visualizerType === "kaleidoscope") {
            drawKaleidoscope({ ctx: cCtx, bars: mockBars, width: WIDTH, height: HEIGHT, color, padding, edit })
        } else if (visualizerType === "particles") {
            drawParticles({ ctx: cCtx, bars: mockBars, width: WIDTH, height: HEIGHT, color, padding, edit })
        } else {
            let x = 0
            const activeColor = color === "rgb(0 0 0 / 0)" ? "" : color
            for (let i = 0; i < bufferLength; i++) {
                const percentage = mockBars[i].percentage
                const r = 255 * percentage
                const barHeight = HEIGHT * percentage
                cCtx.fillStyle = activeColor || `rgb(${r}, 5, 150)`
                cCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
                x += barWidth + padding
            }
        }
    }

    function renderOutputFrame() {
        if (!$visualizerData) return
        const cCtx = ensureCanvas()
        if (!cCtx || !canvas) return

        const WIDTH = canvas.width
        const HEIGHT = canvas.height
        const bufferLength = $visualizerData.buffers || 128
        const barWidth = (WIDTH / bufferLength - padding) * 1.42
        const bars = $visualizerData.bars || []

        cCtx.clearRect(0, 0, WIDTH, HEIGHT)

        if (visualizerType === "kaleidoscope") {
            drawKaleidoscope({ ctx: cCtx, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
        } else if (visualizerType === "particles") {
            drawParticles({ ctx: cCtx, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
        } else {
            let x = 0
            const activeColor = color === "rgb(0 0 0 / 0)" ? "" : color
            for (let i = 0; i < bufferLength; i++) {
                const percentage = bars[i]?.percentage || 0
                const r = 255 * percentage
                const barHeight = HEIGHT * percentage
                cCtx.fillStyle = activeColor || `rgb(${r}, 5, 150)`
                cCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
                x += barWidth + padding
            }
        }
    }

    let lastTime = 0
    let frameCounter = 0

    function startLoop() {
        if (rendering) return

        function renderFrame(timestamp: number = 0) {
            if (!analysers?.length && !$visualizerData) {
                if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
                stopLoop()
                if (preview) send(OUTPUT, ["VISUALIZER_DATA"], null)
                return
            }

            rendering = requestAnimationFrame(renderFrame)

            // Throttle main window analyzer and IPC send to ~30fps
            if (timestamp - lastTime < 30) return
            lastTime = timestamp

            const cCtx = ensureCanvas()
            if (!cCtx || !canvas) return

            const WIDTH = canvas.width
            const HEIGHT = canvas.height
            const bufferLength = analysers[0]?.frequencyBinCount || 128
            const maxHeightValue = analysers[0]?.fftSize || 256
            const barWidth = (WIDTH / bufferLength - padding) * 1.42

            const shouldDraw = frameCounter % 5 === 0
            frameCounter++

            if (shouldDraw) cCtx.clearRect(0, 0, WIDTH, HEIGHT)

            const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))
            analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i] as Uint8Array<ArrayBuffer>))

            const bars: any[] = []
            let x = 0
            const activeColor = color === "rgb(0 0 0 / 0)" ? "" : color

            for (let i = 0; i < bufferLength; i++) {
                const sum = (dataArrays[0]?.[i] || 0) + (dataArrays[1]?.[i] || 0)
                const percentage = Math.round(sum / (dataArrays.length || 1)) / maxHeightValue
                const barHeight = HEIGHT * percentage

                bars.push({ height: barHeight, percentage })

                if (shouldDraw && visualizerType === "bars") {
                    const r = 255 * percentage
                    cCtx.fillStyle = activeColor || `rgb(${r}, 5, 150)`
                    cCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
                    x += barWidth + padding
                }
            }

            if (shouldDraw) {
                if (visualizerType === "kaleidoscope") {
                    drawKaleidoscope({ ctx: cCtx, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                } else if (visualizerType === "particles") {
                    drawParticles({ ctx: cCtx, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                }
            }

            if (preview) {
                send(OUTPUT, ["VISUALIZER_DATA"], { bars, buffers: bufferLength })
            }
        }

        rendering = requestAnimationFrame(renderFrame)
    }
</script>

<canvas bind:this={canvas} />

<style>
    canvas {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: inherit;
    }
</style>
