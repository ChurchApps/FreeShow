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

export interface VisualizerPalette {
    background: [string, string, string]
    glowPrimary: string
    glowSecondary: string
    accent: string
    layerOne: string
    layerTwo: string
    layerThree: string
    contour: string
    horizonLight: string
    orbitCore: string
    shadow: string
    spectrumTop: string
    spectrumBottom: string
}

const palettes: Record<string, VisualizerPalette> = {
    ocean: {
        background: ["#07111f", "#10142d", "#071924"],
        glowPrimary: "rgba(23, 161, 190, 0.20)",
        glowSecondary: "rgba(125, 54, 171, 0.18)",
        accent: "rgba(127, 230, 255, 0.74)",
        layerOne: "rgba(32, 204, 221, 0.15)",
        layerTwo: "rgba(91, 115, 231, 0.14)",
        layerThree: "rgba(190, 76, 185, 0.13)",
        contour: "rgba(180, 235, 255, 0.34)",
        horizonLight: "rgba(71, 169, 215, 0.24)",
        orbitCore: "rgba(105, 107, 190, 0.12)",
        shadow: "rgba(87, 188, 255, 0.4)",
        spectrumTop: "rgba(80, 190, 230, 0.22)",
        spectrumBottom: "rgba(25, 63, 100, 0.02)"
    },
    violet: {
        background: ["#0c0a1d", "#19132b", "#0b1020"],
        glowPrimary: "rgba(103, 69, 183, 0.24)",
        glowSecondary: "rgba(44, 119, 180, 0.17)",
        accent: "rgba(194, 174, 255, 0.8)",
        layerOne: "rgba(145, 105, 230, 0.17)",
        layerTwo: "rgba(85, 126, 230, 0.15)",
        layerThree: "rgba(205, 112, 210, 0.13)",
        contour: "rgba(207, 195, 255, 0.34)",
        horizonLight: "rgba(122, 98, 212, 0.25)",
        orbitCore: "rgba(112, 83, 183, 0.14)",
        shadow: "rgba(161, 131, 255, 0.42)",
        spectrumTop: "rgba(141, 112, 227, 0.23)",
        spectrumBottom: "rgba(55, 43, 102, 0.02)"
    },
    ember: {
        background: ["#1a0d12", "#251419", "#111016"],
        glowPrimary: "rgba(194, 78, 51, 0.22)",
        glowSecondary: "rgba(145, 55, 105, 0.17)",
        accent: "rgba(255, 190, 130, 0.82)",
        layerOne: "rgba(245, 123, 72, 0.17)",
        layerTwo: "rgba(202, 82, 105, 0.15)",
        layerThree: "rgba(242, 176, 93, 0.12)",
        contour: "rgba(255, 213, 176, 0.34)",
        horizonLight: "rgba(224, 112, 63, 0.24)",
        orbitCore: "rgba(177, 79, 75, 0.13)",
        shadow: "rgba(255, 145, 91, 0.4)",
        spectrumTop: "rgba(230, 115, 71, 0.22)",
        spectrumBottom: "rgba(101, 48, 44, 0.02)"
    },
    forest: {
        background: ["#07140f", "#10221d", "#071411"],
        glowPrimary: "rgba(33, 138, 105, 0.22)",
        glowSecondary: "rgba(40, 105, 137, 0.17)",
        accent: "rgba(149, 237, 197, 0.8)",
        layerOne: "rgba(64, 194, 143, 0.16)",
        layerTwo: "rgba(65, 151, 177, 0.15)",
        layerThree: "rgba(151, 194, 111, 0.12)",
        contour: "rgba(190, 247, 215, 0.34)",
        horizonLight: "rgba(64, 164, 127, 0.24)",
        orbitCore: "rgba(58, 143, 116, 0.13)",
        shadow: "rgba(94, 219, 165, 0.4)",
        spectrumTop: "rgba(67, 181, 142, 0.22)",
        spectrumBottom: "rgba(27, 79, 65, 0.02)"
    }
}

export function getVisualizerPalette(name: string) {
    return palettes[name] || palettes.ocean
}

export const ambientVisualizerTypes = ["aurora", "horizon", "orbit", "soft-spectrum"]

function level(bars: Bar[], start: number, end: number, edit: boolean, fallback: number) {
    if (edit) return fallback
    const first = Math.floor(bars.length * start)
    const last = Math.max(first + 1, Math.floor(bars.length * end))
    let sum = 0
    for (let i = first; i < last; i++) sum += bars[i]?.percentage || 0
    return sum / (last - first)
}

function base(ctx: CanvasRenderingContext2D, width: number, height: number, palette: VisualizerPalette) {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, palette.background[0])
    gradient.addColorStop(0.55, palette.background[1])
    gradient.addColorStop(1, palette.background[2])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const glow = ctx.createRadialGradient(width * 0.5, height, 0, width * 0.5, height, width * 0.75)
    glow.addColorStop(0, palette.glowPrimary)
    glow.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
}

function accentColor(color: string | null, fallback: string) {
    return color && color !== "rgb(0 0 0 / 0)" ? color : fallback
}

/** A calm horizon with a low, audio-shaped light field. */
export function drawHorizon({ ctx, bars, width, height, color, palette: paletteName, edit, time }: DrawOptions) {
    const palette = getVisualizerPalette(paletteName)
    const bass = level(bars, 0, 0.2, edit, 0.32)
    const mids = level(bars, 0.2, 0.7, edit, 0.22)
    const motion = time / 1000
    const accent = accentColor(color, palette.accent)

    ctx.save()
    base(ctx, width, height, palette)
    const horizon = height * 0.72

    const light = ctx.createRadialGradient(width * 0.5, horizon, 0, width * 0.5, horizon, width * 0.58)
    light.addColorStop(0, palette.horizonLight)
    light.addColorStop(1, "rgba(23, 58, 104, 0)")
    ctx.fillStyle = light
    ctx.fillRect(0, 0, width, height)

    for (let layer = 0; layer < 3; layer++) {
        const phase = motion * (0.18 + layer * 0.035) + layer * 1.8
        const amplitude = height * (0.025 + bass * 0.035 + layer * 0.009)
        const yBase = horizon + layer * height * 0.055
        ctx.beginPath()
        for (let x = 0; x <= width; x += Math.max(6, width / 180)) {
            const n = x / width
            const y = yBase + Math.sin(n * Math.PI * (2.4 + layer * 0.3) + phase) * amplitude + Math.sin(n * 12 - phase * 0.7) * amplitude * 0.22
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = layer === 0 ? accent : layer === 1 ? palette.layerTwo : palette.layerThree
        ctx.lineWidth = Math.max(1, height * (layer === 0 ? 0.002 : 0.0014))
        ctx.shadowColor = palette.shadow
        ctx.shadowBlur = height * 0.018
        ctx.stroke()
    }
    ctx.restore()
}

/** A sparse orbital field, with a gentle bass pulse around the outer rim. */
export function drawOrbit({ ctx, bars, width, height, color, palette: paletteName, edit, time }: DrawOptions) {
    const palette = getVisualizerPalette(paletteName)
    const bass = level(bars, 0, 0.18, edit, 0.3)
    const treble = level(bars, 0.65, 1, edit, 0.2)
    const motion = time / 1000
    const cx = width * 0.5
    const cy = height * 0.52
    const radius = Math.min(width, height) * 0.32
    const accent = accentColor(color, palette.accent)

    ctx.save()
    base(ctx, width, height, palette)
    ctx.globalCompositeOperation = "screen"

    for (let ring = 0; ring < 3; ring++) {
        const r = radius * (0.66 + ring * 0.17) + bass * height * (0.025 + ring * 0.008)
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * (1 + ring * 0.12), r * (0.72 + ring * 0.1), Math.sin(motion * 0.08 + ring) * 0.08, 0, Math.PI * 2)
        ctx.strokeStyle = ring === 1 ? accent : ring === 0 ? palette.layerTwo : palette.layerThree
        ctx.lineWidth = Math.max(1, height * (ring === 1 ? 0.002 : 0.0012))
        ctx.shadowColor = palette.shadow
        ctx.shadowBlur = height * 0.02
        ctx.stroke()
    }

    const core = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 0.9)
    core.addColorStop(0, palette.orbitCore)
    core.addColorStop(1, "rgba(50, 37, 105, 0)")
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

/** A soft, low-profile spectrum that leaves the center clear for lyrics. */
export function drawSoftSpectrum({ ctx, bars, width, height, color, palette: paletteName, edit, time }: DrawOptions) {
    const palette = getVisualizerPalette(paletteName)
    const count = bars.length || 1
    const bass = level(bars, 0, 0.2, edit, 0.3)
    const accent = accentColor(color, palette.accent)
    const motion = time / 1000

    ctx.save()
    base(ctx, width, height, palette)
    ctx.globalCompositeOperation = "screen"

    const points: [number, number][] = []
    for (let i = 0; i <= 160; i++) {
        const n = i / 160
        const index = Math.min(count - 1, Math.floor(n * count))
        const energy = bars[index]?.percentage || (edit ? 0.22 : 0)
        const envelope = Math.sin(n * Math.PI) ** 0.7
        const ripple = Math.sin(n * 17 - motion * 0.35) * 0.006
        points.push([n * width, height * (0.89 - envelope * (0.025 + energy * 0.18 + bass * 0.05) + ripple)])
    }

    ctx.beginPath()
    ctx.moveTo(0, height)
    points.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.lineTo(width, height)
    ctx.closePath()
    const fill = ctx.createLinearGradient(0, height * 0.68, 0, height)
    fill.addColorStop(0, palette.spectrumTop)
    fill.addColorStop(1, palette.spectrumBottom)
    ctx.fillStyle = fill
    ctx.fill()

    ctx.beginPath()
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1, height * 0.002)
    ctx.shadowColor = palette.shadow
    ctx.shadowBlur = height * 0.022
    ctx.stroke()
    ctx.restore()
}
