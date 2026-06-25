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

    $: if (($visualizerData || analysers?.length || edit) && canvas && item) visualizer()

    let canvas: HTMLCanvasElement | undefined
    let ctx: CanvasRenderingContext2D | null = null
    $: color = item.visualizer?.color || null
    // WIP higher padding reduces total width
    $: padding = (item.visualizer?.padding || 0) - 0.5

    onDestroy(() => {
        if (!ctx || !canvas) return

        // reset
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        visualizerData.set(null)
        if (preview) send(OUTPUT, ["VISUALIZER_DATA"], null)

        if (rendering) cancelAnimationFrame(rendering)
        if (checkInterval) clearInterval(checkInterval)
    })

    let rendering = 0
    function visualizer() {
        if (!canvas || rendering) return

        const targetWidth = Math.ceil(canvas.clientWidth) || window.innerWidth
        const targetHeight = Math.ceil(canvas.clientHeight) || window.innerHeight

        if (!ctx || canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth
            canvas.height = targetHeight
            ctx = canvas.getContext("2d")
        }

        let WIDTH = canvas.width
        let HEIGHT = canvas.height

        let bufferLength = $visualizerData?.buffers ?? analysers[0]?.frequencyBinCount // 128
        if (!bufferLength && edit) bufferLength = 128
        if (!bufferLength) return

        let barWidth = WIDTH / bufferLength - padding

        let x = 0
        let frameCounter = 0
        const visualizerType = item.visualizer?.type || "bars"

        if (edit) {
            // wait for color/padding to update
            setTimeout(() => {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                const mockBars: any[] = []
                for (let i = 0; i < bufferLength; i++) {
                    const sineFactor = Math.abs(Math.sin((1 - i / bufferLength) * Math.PI * 8))
                    const barHeight = HEIGHT * (0.5 * sineFactor + 0.5) * ((bufferLength - i) / bufferLength)
                    mockBars.push({ height: barHeight, percentage: sineFactor })
                }

                if (visualizerType === "kaleidoscope") {
                    drawKaleidoscope({ ctx: ctx!, bars: mockBars, width: WIDTH, height: HEIGHT, color, padding, edit })
                } else if (visualizerType === "particles") {
                    drawParticles({ ctx: ctx!, bars: mockBars, width: WIDTH, height: HEIGHT, color, padding, edit })
                } else {
                    x = 0
                    for (let i = 0; i < bufferLength; i++) {
                        generateBar(mockBars[i])
                    }
                }
            })
            return
        }

        // don't show highest frequencies as they are often flat
        barWidth *= 1.42 // 1.3

        if ($currentWindow) {
            if ($visualizerData) renderFrame()
            return
        }

        const maxHeightValue = analysers[0]?.fftSize // 256
        if (!maxHeightValue) return

        const dataArrays: any[] = analysers.map(() => new Uint8Array(bufferLength))
        let lastTime = 0

        function renderFrame(timestamp: number = 0) {
            if (!$visualizerData && !analysers?.length) {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                cancelAnimationFrame(rendering)
                rendering = 0

                if (preview) send(OUTPUT, ["VISUALIZER_DATA"], null)

                return
            }

            if (!$currentWindow) {
                // Throttle main window analyzer and IPC send to ~30fps
                if (timestamp - lastTime < 30) {
                    rendering = requestAnimationFrame(renderFrame)
                    return
                }
                lastTime = timestamp
            }

            // Limit drawing visual updates in the preview window to save performance (draw every 5th frame, ~12fps)
            const shouldDraw = $currentWindow || edit || (frameCounter % 5 === 0)
            frameCounter++

            if (shouldDraw) {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                x = 0
            }

            if ($visualizerData) {
                let bars = $visualizerData.bars
                if (shouldDraw) {
                    if (visualizerType === "kaleidoscope") {
                        drawKaleidoscope({ ctx: ctx!, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                    } else if (visualizerType === "particles") {
                        drawParticles({ ctx: ctx!, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                    } else {
                        for (let i = 0; i < $visualizerData.buffers; i++) {
                            generateBar(bars[i])
                        }
                    }
                }

                return
            }

            // only get data in main window preview
            if ($currentWindow || !preview) return

            rendering = requestAnimationFrame(renderFrame)

            // update frequency data for all analysers
            analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i]))

            let bars: any[] = []
            for (let i = 0; i < bufferLength; i++) {
                const sum = dataArrays[0][i] + dataArrays[1][i]
                const percentage = Math.round(sum / dataArrays.length) / maxHeightValue
                const barHeight = HEIGHT * percentage

                bars.push({ height: barHeight, percentage })
                if (shouldDraw && visualizerType === "bars") {
                    generateBar({ height: barHeight, percentage })
                }
            }

            if (shouldDraw) {
                if (visualizerType === "kaleidoscope") {
                    drawKaleidoscope({ ctx: ctx!, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                } else if (visualizerType === "particles") {
                    drawParticles({ ctx: ctx!, bars, width: WIDTH, height: HEIGHT, color, padding, edit })
                }
            }

            send(OUTPUT, ["VISUALIZER_DATA"], { bars, buffers: bufferLength })
        }

        if (rendering) cancelAnimationFrame(rendering)
        renderFrame()

        function generateBar({ percentage }: { height: number; percentage: number }) {
            const r = 255 * percentage
            const g = 5
            const b = 150

            const barHeight = HEIGHT * percentage

            if (color === "rgb(0 0 0 / 0)") color = ""
            ctx!.fillStyle = color || `rgb(${r}, ${g}, ${b})`
            ctx!.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)

            x += barWidth + padding
        }
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
