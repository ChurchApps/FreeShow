<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow, visualizerData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"

    export let item: any
    export let preview: boolean = false

    $: console.log(item)

    // visualizer
    // TODO: videos & mics
    // WIP circles: https://medium.com/swlh/building-a-audio-visualizer-with-javascript-324b8d420e7
    let analysers: any[] = AudioAnalyser.getAnalysers()
    // WIP get video analysers from outputs
    // $: analysers = [...Object.values($playingAudio), ...$playingVideos]

    $: if (($visualizerData || analysers?.length) && canvas && item) visualizer()
    $: if (ctx && canvas && !$visualizerData) ctx.clearRect(0, 0, canvas.width, canvas.height)

    let canvas: any = null
    let ctx: any = null
    $: color = item.visualizer?.color || null
    $: padding = (item.visualizer?.padding || 0) - 0.5

    onDestroy(() => {
        if (!ctx) return

        // reset
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        visualizerData.set(null)
        if (preview) send(OUTPUT, ["VIZUALISER_DATA"], null)

        if (rendering) cancelAnimationFrame(rendering)
    })

    let rendering: any = null
    function visualizer() {
        if (!ctx) {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            ctx = canvas.getContext("2d")
        }

        let WIDTH = canvas.width
        let HEIGHT = canvas.height

        let bufferLengths: any[] = []

        const bufferLength = analysers[0].frequencyBinCount // 128
        const maxHeightValue = analysers[0].fftSize // 256
        if (!bufferLength || !maxHeightValue) return

        const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))

        let barWidth = (WIDTH / bufferLength) * 1.3 - padding
        let barHeight

        let count = 0
        let x = 0

        function renderFrame() {
            if (!$visualizerData && !analysers?.length) {
                ctx.clearRect(0, 0, WIDTH, HEIGHT)
                if (preview) send(OUTPUT, ["VIZUALISER_DATA"], null)

                return
            }

            x = 0
            ctx.clearRect(0, 0, WIDTH, HEIGHT)

            if ($visualizerData) {
                let bars = $visualizerData.bars
                for (let i = 0; i < $visualizerData.buffers; i++) {
                    generateBar(bars[i])
                }

                return
            }

            if ($currentWindow) return

            rendering = requestAnimationFrame(renderFrame)

            count++
            if (count > 3) {
                count = 0

                // update frequency data for all analysers
                analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i]))

                let bars: any[] = []
                for (let i = 0; i < bufferLengths[0]; i++) {
                    let dataAtIndex = dataArrays.map((a) => a[i])
                    let mid = dataAtIndex.reduce((value, data) => (value += data), 0) / dataAtIndex.length
                    barHeight = mid * 3
                    bars.push(barHeight)

                    // WIP this does not generate anything in the preview...
                    // generateBar(barHeight)
                }

                if (preview) send(OUTPUT, ["VIZUALISER_DATA"], { bars, buffers: bufferLength })
            }
        }

        if (rendering) cancelAnimationFrame(rendering)
        renderFrame()

        function generateBar(barHeight) {
            // see values in AudioPreview.svelte
            let r = barHeight * 1.5 + 5
            let g = 5
            let b = 150

            if (color === "rgb(0 0 0 / 0)") color = ""
            ctx.fillStyle = color || "rgb(" + r + "," + g + "," + b + ")"
            ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)

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
    }
</style>
