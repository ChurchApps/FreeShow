import { getVisualizerPalette } from "./visualizerAmbient"

interface Bar {
    percentage: number
}

interface DrawOptions {
    ctx: CanvasRenderingContext2D
    bars: Bar[]
    width: number
    height: number
    color: string | null
    palette: string
    edit: boolean
    time: number
}

/**
 * Draw an original, ambient audio-reactive background using the browser's
 * Canvas API. It deliberately has no dependency on third-party visualizer
 * code or preset formats.
 */
export function drawAurora({ ctx, bars, width, height, color, palette: paletteName, edit, time }: DrawOptions) {
    const palette = getVisualizerPalette(paletteName)
    const count = bars.length || 1
    const band = (start: number, end: number) => {
        let total = 0
        let samples = 0
        for (let i = Math.floor(count * start); i < Math.max(Math.floor(count * end), Math.floor(count * start) + 1); i++) {
            total += bars[i]?.percentage || 0
            samples++
        }
        return samples ? total / samples : 0
    }

    const bass = edit ? 0.42 : band(0, 0.18)
    const mids = edit ? 0.28 : band(0.18, 0.62)
    const treble = edit ? 0.18 : band(0.62, 1)
    const motion = time / 1000
    const pulse = Math.min(1, bass * 1.7 + mids * 0.6)
    const accent = color && color !== "rgb(0 0 0 / 0)" ? color : palette.accent

    ctx.save()
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1

    // An opaque, quiet base makes lyrics legible over the visualiser.
    const base = ctx.createLinearGradient(0, 0, width * 0.8, height)
    base.addColorStop(0, palette.background[0])
    base.addColorStop(0.52, palette.background[1])
    base.addColorStop(1, palette.background[2])
    ctx.fillStyle = base
    ctx.fillRect(0, 0, width, height)

    // Slow light pools give the background motion even when there is silence.
    const glow = (x: number, y: number, radius: number, inner: string, outer: string) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, inner)
        gradient.addColorStop(1, outer)
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
    }
    const drift = Math.sin(motion * 0.19)
    glow(width * (0.24 + drift * 0.08), height * (0.42 + Math.cos(motion * 0.16) * 0.07), width * (0.48 + pulse * 0.08), palette.glowPrimary, "rgba(23, 161, 190, 0)")
    glow(width * (0.76 - drift * 0.06), height * (0.64 + Math.sin(motion * 0.13) * 0.08), width * (0.42 + mids * 0.1), palette.glowSecondary, "rgba(125, 54, 171, 0)")

    // Broad flowing ribbons, each with a different tempo and audio response.
    ctx.globalCompositeOperation = "screen"
    const layers = [
        {
            y: 0.4,
            amp: 0.105,
            speed: 0.24,
            freq: 1.55,
            color: palette.layerOne
        },
        {
            y: 0.53,
            amp: 0.125,
            speed: -0.18,
            freq: 1.9,
            color: palette.layerTwo
        },
        {
            y: 0.66,
            amp: 0.095,
            speed: 0.13,
            freq: 1.35,
            color: palette.layerThree
        }
    ]

    layers.forEach((layer, layerIndex) => {
        const phase = motion * layer.speed + layerIndex * 1.9
        const amplitude = height * layer.amp * (0.72 + pulse * 0.9 + treble * 0.25)
        ctx.beginPath()
        ctx.moveTo(0, height)
        for (let x = 0; x <= width; x += Math.max(8, width / 120)) {
            const n = x / width
            const wave = Math.sin(n * Math.PI * 2 * layer.freq + phase) * 0.68 + Math.sin(n * Math.PI * 4.1 - phase * 0.64) * 0.22 + Math.sin(n * Math.PI * 7 + phase * 0.35) * 0.1
            const y = height * layer.y + wave * amplitude - mids * height * 0.08
            if (x === 0) ctx.lineTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.lineTo(width, height)
        ctx.closePath()

        const fill = ctx.createLinearGradient(0, height * (layer.y - 0.2), 0, height)
        fill.addColorStop(0, layer.color)
        fill.addColorStop(1, "rgba(4, 12, 28, 0.30)")
        ctx.fillStyle = fill
        ctx.fill()

        // A fine illuminated crest adds definition without competing with lyrics.
        ctx.beginPath()
        for (let x = 0; x <= width; x += Math.max(8, width / 120)) {
            const n = x / width
            const wave = Math.sin(n * Math.PI * 2 * layer.freq + phase) * 0.68 + Math.sin(n * Math.PI * 4.1 - phase * 0.64) * 0.22 + Math.sin(n * Math.PI * 7 + phase * 0.35) * 0.1
            const y = height * layer.y + wave * amplitude - mids * height * 0.08
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = layerIndex === 0 ? accent : layer.color.replace(/0\.\d+\)/, "0.48)")
        ctx.lineWidth = Math.max(1, height * 0.002)
        ctx.stroke()
    })

    // A quiet spectral contour near the bottom ties the movement to the music.
    ctx.beginPath()
    for (let x = 0; x <= width; x += Math.max(3, width / 240)) {
        const n = x / width
        const index = Math.min(count - 1, Math.floor(n * count))
        const level = bars[index]?.percentage || (edit ? 0.25 : 0)
        const y = height * 0.88 - level * height * 0.22 - Math.sin(n * 24 + motion * 0.7) * height * 0.012
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = palette.contour
    ctx.lineWidth = Math.max(1, height * 0.0015)
    ctx.stroke()

    ctx.restore()
}
