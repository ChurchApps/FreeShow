interface Bar {
    height: number
    percentage: number
}

interface DrawOptions {
    ctx: CanvasRenderingContext2D
    bars: Bar[] | any[]
    width: number
    height: number
    color: string | null
    padding: number
    edit: boolean
}

interface VisualizerParticle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    alpha: number
    color: string
}

let particles: VisualizerParticle[] = []

export function drawParticles({ ctx, bars, width, height, color, padding, edit }: DrawOptions) {
    const numBars = bars.length

    // Calculate peak and average levels
    let totalPct = 0
    let maxPct = 0
    for (let i = 0; i < numBars; i++) {
        const pct = bars[i]?.percentage || 0
        totalPct += pct
        if (pct > maxPct) {
            maxPct = pct
        }
    }
    const avgPct = totalPct / numBars

    // Show nothing with no audio (unless in edit mode)
    if (!edit && avgPct < 0.001) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()

    // Spawn new particles from the bottom based on audio levels
    const spawnRate = edit ? 0.3 : Math.min(0.8, maxPct * 1.5)
    if (Math.random() < spawnRate && particles.length < 150) {
        const i = Math.floor(Math.random() * numBars)
        const bar = bars[i]
        const pct = bar?.percentage || 0

        if (pct > 0.15 || edit) {
            const barWidth = width / numBars
            const basePct = edit ? 0.5 : pct
            const x = i * barWidth + Math.random() * barWidth
            const y = height
            const rawPadding = padding + 0.5
            const sizeMultiplier = 1 + Math.max(0, rawPadding) * 0.5
            const size = (2 + basePct * 8 + Math.random() * 4) * sizeMultiplier
            const vy = -(1 + basePct * 3.5 + Math.random() * 2)
            const vx = (Math.random() - 0.5) * 0.8
            const alpha = 0.7 + Math.random() * 0.3

            let pColor = color || ""
            if (!pColor) {
                const hue = 180 + (i / numBars) * 120
                pColor = `hsla(${hue}, 100%, 65%, ${alpha})`
            }

            particles.push({ x, y, vx, vy, size, alpha, color: pColor })
        }
    }

    ctx.shadowBlur = 10
    ctx.shadowColor = color || "rgba(0, 240, 255, 0.5)"

    const audioSpeedMultiplier = 0.4 + 1.6 * maxPct

    particles = particles.filter((p) => {
        // Scale movement speed dynamically based on current audio levels
        const speed = audioSpeedMultiplier * 2
        p.y += p.vy * speed
        p.x += p.vx * speed
        p.vx += (Math.random() - 0.5) * 0.3 * audioSpeedMultiplier
        p.alpha -= 0.012

        if (p.y < -50 || p.alpha <= 0 || p.x < 0 || p.x > width) {
            return false
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        return true
    })

    ctx.globalAlpha = 1.0
    ctx.restore()
}
