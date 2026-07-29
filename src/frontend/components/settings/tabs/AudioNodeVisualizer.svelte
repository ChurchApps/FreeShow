<script lang="ts">
    import { onMount, onDestroy } from "svelte"
    import { audioChannelsData } from "../../../stores"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"

    export let channelId: string = ""
    export let height: number = 10
    export let width: number = 60

    let canvas: HTMLCanvasElement
    let animationFrame: number

    // Smooth level tracking per channel index
    let smoothedLevels: number[] = []

    function getChannelLabel(index: number, count: number): string {
        if (count === 1) return "M"
        if (count === 2) return index === 0 ? "L" : "R"
        return `${index + 1}`
    }

    let channelLabels: string[] = ["L", "R"]

    function render() {
        if (!canvas) {
            animationFrame = requestAnimationFrame(render)
            return
        }

        const rectWidth = canvas.clientWidth || width
        if (canvas.width !== rectWidth) {
            canvas.width = rectWidth
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const w = canvas.width

        // Fetch current channel volume data
        const captured = AudioInputCapture.getInstance().getVisualizerData(channelId)
        const nodeData = ($audioChannelsData || {})[channelId]

        let channelDbs: number[] = []

        if (captured && captured.channels?.length) {
            channelDbs = captured.channels.map((c) => c.db)
        } else {
            const data = nodeData as any
            if (data && typeof data.dB === "number" && data.dB > -80) {
                channelDbs = [data.dB, data.dB]
            } else {
                channelDbs = [-80, -80]
            }
        }

        const count = channelDbs.length || 2
        channelLabels = Array.from({ length: count }, (_, i) => getChannelLabel(i, count))

        const channelHeight = Math.max(2, Math.floor((height || 8) / count))
        const channelGap = 2
        const totalHeight = channelHeight * count + channelGap * (count - 1)

        if (canvas.height !== totalHeight) {
            canvas.height = totalHeight
        }

        ctx.clearRect(0, 0, w, totalHeight)

        // Ensure smoothed levels array matches channel count
        while (smoothedLevels.length < count) smoothedLevels.push(0)
        if (smoothedLevels.length > count) smoothedLevels.length = count

        // Draw track backgrounds
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
        for (let ch = 0; ch < count; ch++) {
            const y = ch * (channelHeight + channelGap)
            ctx.fillRect(0, y, w, channelHeight)
        }

        const numSegments = 24
        const gap = 1.5
        const totalGap = gap * (numSegments - 1)
        const segWidth = (w - totalGap) / numSegments

        // Process and draw each channel meter
        for (let ch = 0; ch < count; ch++) {
            const db = channelDbs[ch]
            // Standard logarithmic dB mapping: -60 dB to 0 dB mapped to 0..1 scale
            // dB values above -60 dB scale smoothly up to 1.0 (0 dB full-scale)
            const target = db > -60 ? Math.min(1, Math.max(0, (db + 60) / 60)) : 0

            // Fast attack, smooth decay
            if (target > smoothedLevels[ch]) {
                smoothedLevels[ch] = target
            } else {
                smoothedLevels[ch] += (target - smoothedLevels[ch]) * 0.2
            }

            const currentLevel = smoothedLevels[ch]
            if (currentLevel > 0.005) {
                const activeCount = Math.round(currentLevel * numSegments)
                const y = ch * (channelHeight + channelGap)

                for (let i = 0; i < activeCount; i++) {
                    const ratio = i / (numSegments - 1)
                    ctx.fillStyle = ratio < 0.6 ? "#4caf50" : ratio < 0.85 ? "#ffeb3b" : "#f44336"
                    ctx.fillRect(i * (segWidth + gap), y, segWidth, channelHeight)
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

<div class="visualizer-container">
    <canvas bind:this={canvas} class="node-visualizer" title="{channelId} multi-channel meter"></canvas>
    <div class="channel-labels">
        {#each channelLabels as label}
            <span>{label}</span>
        {/each}
    </div>
</div>

<style>
    .visualizer-container {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        margin-top: 2px;
    }

    .node-visualizer {
        border-radius: 2px;
        display: block;
        flex: 1;
    }

    .channel-labels {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-size: 7px;
        font-weight: 700;
        line-height: 1;
        opacity: 0.6;
        user-select: none;
    }
</style>
