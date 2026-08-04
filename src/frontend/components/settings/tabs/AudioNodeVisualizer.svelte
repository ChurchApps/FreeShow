<script lang="ts">
    import { onMount, onDestroy } from "svelte"
    import { audioChannels, audioChannelsData } from "../../../stores"
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
        } else if (channelId === "main" && $audioChannels?.length) {
            channelDbs = $audioChannels.map((c) => c?.dB?.value ?? -80)
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

        const numSegments = 24
        const gap = 1.5
        const dotSize = 3
        const dotGap = 4
        const meterOffset = dotSize + dotGap
        const meterWidth = w - meterOffset
        const totalGap = gap * (numSegments - 1)
        const segWidth = (meterWidth - totalGap) / numSegments

        // Draw track backgrounds
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
        for (let ch = 0; ch < count; ch++) {
            const y = ch * (channelHeight + channelGap)
            ctx.fillRect(meterOffset, y, meterWidth, channelHeight)
        }

        // Process and draw each channel meter
        for (let ch = 0; ch < count; ch++) {
            const rawDb = channelDbs[ch]
            let db = rawDb
            const channelVolume = Number(($audioChannelsData || {})[channelId]?.volume ?? 1)
            if (channelVolume > 0 && channelVolume < 1) {
                db += 20 * Math.log10(channelVolume)
            } else if (channelVolume === 0) {
                db = -60
            }

            const y = ch * (channelHeight + channelGap)

            // Draw pre-fader audio presence signal dot
            const hasSignal = rawDb > -60
            ctx.fillStyle = hasSignal ? "#00ff66" : "rgba(255, 255, 255, 0.2)"
            ctx.beginPath()
            ctx.arc(dotSize / 2, y + channelHeight / 2, dotSize / 2, 0, Math.PI * 2)
            ctx.fill()

            // Linear dB scale mapping: -60 dB to 0 dB mapped proportionally to 0..1 scale
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

                for (let i = 0; i < activeCount; i++) {
                    const ratio = i / (numSegments - 1)
                    ctx.fillStyle = ratio < 0.6 ? "#4caf50" : ratio < 0.85 ? "#ffeb3b" : "#f44336"
                    ctx.fillRect(meterOffset + i * (segWidth + gap), y, segWidth, channelHeight)
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
        min-width: 0;
        margin-top: 2px;
    }

    .node-visualizer {
        border-radius: 2px;
        display: block;
        flex: 1;
        width: 100%;
        min-width: 0;
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
