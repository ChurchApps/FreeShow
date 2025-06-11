<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Item } from "../../../../types/Show"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { currentWindow, visualizerData } from "../../../stores"
    import { send } from "../../../utils/request"

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
        if (preview) send(OUTPUT, ["VIZUALISER_DATA"], null)

        if (rendering) cancelAnimationFrame(rendering)
        if (checkInterval) clearInterval(checkInterval)
    })

    let rendering = 0
    function visualizer() {
        if (!canvas || rendering) return
        if (!ctx) {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            ctx = canvas.getContext("2d")
        }

        let WIDTH = canvas.width
        let HEIGHT = canvas.height

        let bufferLength = $visualizerData?.buffers ?? analysers[0]?.frequencyBinCount // 128
        if (!bufferLength && edit) bufferLength = 128
        if (!bufferLength) return

        let barWidth = WIDTH / bufferLength - padding

        let x = 0

        if (edit) {
            // wait for color/padding to update
            setTimeout(() => {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                for (let i = 0; i < bufferLength; i++) {
                    const sineFactor = Math.abs(Math.sin((1 - i / bufferLength) * Math.PI * 8))
                    const barHeight = HEIGHT * (0.5 * sineFactor + 0.5) * ((bufferLength - i) / bufferLength)
                    generateBar({ height: barHeight, percentage: sineFactor })
                }
            })
            return
        }

        // don't show highest frequenzies as they are often flat
        barWidth *= 1.42 // 1.3

        if ($currentWindow) {
            if ($visualizerData) renderFrame()
            return
        }

        const maxHeightValue = analysers[0]?.fftSize // 256
        if (!maxHeightValue) return

        const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))

        function renderFrame() {
            if (!$visualizerData && !analysers?.length) {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                cancelAnimationFrame(rendering)
                rendering = 0

                if (preview) send(OUTPUT, ["VIZUALISER_DATA"], null)

                return
            }

            ctx!.clearRect(0, 0, WIDTH, HEIGHT)
            x = 0

            if ($visualizerData) {
                let bars = $visualizerData.bars
                for (let i = 0; i < $visualizerData.buffers; i++) {
                    generateBar(bars[i])
                }

                return
            }

            // only get data in main window preview
            if ($currentWindow || !preview) return

            rendering = requestAnimationFrame(renderFrame)

            // update frequency data for all analysers
            analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i]))

            let bars: { height: number; percentage: number }[] = []
            for (let i = 0; i < bufferLength; i++) {
                const sum = dataArrays[0][i] + dataArrays[1][i]
                const percentage = Math.round(sum / dataArrays.length) / maxHeightValue
                const barHeight = HEIGHT * percentage

                bars.push({ height: barHeight, percentage })
                generateBar({ height: barHeight, percentage })
            }

            send(OUTPUT, ["VIZUALISER_DATA"], { bars, buffers: bufferLength })
        }

        if (rendering) cancelAnimationFrame(rendering)
        renderFrame()

        function generateBar({ height, percentage }: { height: number; percentage: number }) {
            const r = 255 * percentage
            const g = 5
            const b = 150

            if (color === "rgb(0 0 0 / 0)") color = ""
            ctx!.fillStyle = color || `rgb(${r}, ${g}, ${b})`
            ctx!.fillRect(x, HEIGHT - height, barWidth, height)

            x += barWidth + padding
        }
    }
</script>

<canvas bind:this={canvas} />

<style>
    canvas {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 100%;
        height: 100%;
    }
</style>
