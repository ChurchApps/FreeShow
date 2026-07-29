<script lang="ts">
    import { onMount, onDestroy } from "svelte"
    import { audioChannelsData } from "../../../stores"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"

    export let channelId: string = ""
    export let height: number = 8
    export let width: number = 60

    let canvas: HTMLCanvasElement
    let animationFrame: number

    function render() {
        if (!canvas) {
            animationFrame = requestAnimationFrame(render)
            return
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)"
        ctx.fillRect(0, 0, width, height)

        const captured = AudioInputCapture.getInstance().getVisualizerData(channelId)
        const nodeData = ($audioChannelsData || {})[channelId]
        let activeLevel = 0

        if (captured && captured.db > -80) {
            activeLevel = Math.min(1, Math.max(0, (captured.db + 80) / 80))
        } else {
            const data = nodeData as any
            if (data && typeof data.dB === "number" && data.dB > -80) {
                activeLevel = Math.min(1, Math.max(0, (data.dB + 80) / 80))
            }
        }

        if (activeLevel > 0 || (captured && captured.spectrum.some((v) => v > 0.01))) {
            const barCount = 12
            const gap = 1
            const barWidth = (width - (barCount - 1) * gap) / barCount
            const spectrum = captured?.spectrum || []
            const step = Math.floor(spectrum.length / barCount) || 1

            const grad = ctx.createLinearGradient(0, height, 0, 0)
            grad.addColorStop(0, "#4caf50")
            grad.addColorStop(0.7, "#ffeb3b")
            grad.addColorStop(1, "#f44336")
            ctx.fillStyle = grad

            for (let i = 0; i < barCount; i++) {
                const val = spectrum.length ? spectrum[i * step] : activeLevel
                if (val > 0.01) {
                    const barHeight = Math.max(1, height * val)
                    ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight)
                }
            }
        }
        animationFrame = requestAnimationFrame(render)
    }

    onMount(() => {
        render()
    })

    onDestroy(() => {
        if (animationFrame) cancelAnimationFrame(animationFrame)
    })
</script>

<canvas bind:this={canvas} {width} {height} class="node-visualizer"></canvas>

<style>
    .node-visualizer {
        border-radius: 3px;
        display: block;
        margin-left: auto;
    }
</style>
