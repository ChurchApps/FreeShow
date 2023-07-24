<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { playingAudio, playingVideos, visualizerData } from "../../../stores"
    import { send } from "../../../utils/request"

    export let item: any
    export let preview: boolean = false

    $: console.log(item)

    // visualizer
    // TODO: videos & mics
    // WIP circles: https://medium.com/swlh/building-a-audio-visualizer-with-javascript-324b8d420e7
    let analysers: any[] = []
    $: analysers = [...Object.values($playingAudio), ...$playingVideos]

    $: if (($visualizerData || analysers?.length) && canvas && item) visualizer()
    $: if (ctx && canvas && !$visualizerData) ctx.clearRect(0, 0, canvas.width, canvas.height)

    let canvas: any = null
    let ctx: any = null
    $: color = item.visualizer?.color || null
    $: padding = (item.visualizer?.padding || 0) - 0.5

    function visualizer() {
        if (!ctx) {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            ctx = canvas.getContext("2d")
        }

        let WIDTH = canvas.width
        let HEIGHT = canvas.height

        let channels: any[] = []
        let bufferLengths: any[] = []
        let dataArrays: Uint8Array[] = []

        if (!$visualizerData) {
            let leftChannels = analysers.map((a) => a.analyser?.left)
            let rightChannels = analysers.map((a) => a.analyser?.right)
            channels = [...leftChannels, ...rightChannels]

            // remove empty
            channels = channels.filter((a) => a)

            bufferLengths = channels.map((a) => a.frequencyBinCount)
            dataArrays = bufferLengths.map((a) => new Uint8Array(a))
        }

        let bufferLength = $visualizerData ? $visualizerData.buffers : bufferLengths[0]
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

            requestAnimationFrame(renderFrame)

            channels.map((a, i) => a.getByteFrequencyData(dataArrays[i]))

            let bars: any[] = []
            for (let i = 0; i < bufferLengths[0]; i++) {
                let dataAtIndex = dataArrays.map((a) => a[i])
                let mid = dataAtIndex.reduce((value, data) => (value += data), 0) / dataAtIndex.length
                barHeight = mid * 3
                bars.push(barHeight)

                generateBar(barHeight)
            }

            if (!preview) return

            count++
            if (count > 3) {
                send(OUTPUT, ["VIZUALISER_DATA"], { bars, buffers: bufferLength })
                count = 0
            }
        }

        renderFrame()

        function generateBar(barHeight) {
            // see values in AudioPreview.svelte
            let r = barHeight * 1.5 + 5
            let g = 5
            let b = 150

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
