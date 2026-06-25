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

let particles: {
    x: number
    y: number
    vx: number
    vy: number
    alpha: number
    size: number
    color: string
}[] = []

export function drawKaleidoscope({ ctx, bars, width, height, color, padding, edit }: DrawOptions) {
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.min(centerX, centerY)
    const maxRadiusSq = maxRadius * maxRadius
    const segments = 8
    const angleStep = (Math.PI * 2) / segments
    const numBars = bars.length

    // Calculate peak and overall volume (average percentage) for dynamic scaling
    let totalPct = 0
    let maxPct = 0
    for (let i = 0; i < numBars; i++) {
        totalPct += bars[i]?.percentage || 0
        if (bars[i]?.percentage > maxPct) {
            maxPct = bars[i].percentage
        }
    }
    const avgPct = totalPct / numBars

    // Show nothing when there is no audio (unless in edit mode)
    if (!edit && avgPct < 0.001) {
        return
    }

    // Dynamic scale factor: small size on low volume, expanding to full size on high volume
    const scale = edit ? 1.0 : Math.max(0.15, maxPct)

    const baseMaxRadius = maxRadius * 0.75 * scale
    const pulseFactor = maxRadius * 0.2 * scale

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()

    ctx.translate(centerX, centerY)

    // Create a gorgeous radial gradient for the color scheme
    if (color === "rgb(0 0 0 / 0)") color = ""
    const grad = ctx.createRadialGradient(0, 0, maxRadius * 0.05, 0, 0, maxRadius * scale)
    if (color) {
        grad.addColorStop(0, color)
        grad.addColorStop(1, color)
    } else {
        grad.addColorStop(0, "rgba(0, 240, 255, 1)") // Cyan
        grad.addColorStop(0.5, "rgba(255, 0, 128, 0.8)") // Hot Pink
        grad.addColorStop(1, "rgba(255, 150, 0, 0.9)") // Neon Orange
    }

    // Set up a glowing neon effect
    ctx.shadowBlur = 15
    ctx.shadowColor = color || "rgba(255, 0, 128, 0.7)"

    // 1. Update and Draw Particles (dynamic starbursts shooting outwards)
    if (maxPct > 0.3 && particles.length < 50) {
        for (let s = 0; s < segments; s++) {
            if (Math.random() < maxPct * 0.4) {
                const angle = s * angleStep
                const speed = 1.5 + Math.random() * 3
                particles.push({
                    x: 0,
                    y: 0,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    alpha: 1.0,
                    size: 1.5 + Math.random() * 3,
                    color: color || `hsl(${180 + Math.random() * 120}, 100%, 70%)`
                })
            }
        }
    }

    particles = particles.filter((p) => {
        // Compensate movement and fade speeds for the 30fps frame rate (multiply by 2)
        p.x += p.vx * 2
        p.y += p.vy * 2
        p.alpha -= 0.04

        if (p.alpha <= 0 || (p.x * p.x + p.y * p.y) > maxRadiusSq) {
            return false
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        return true
    })
    ctx.globalAlpha = 1.0 // Reset opacity

    // 2. Draw outer connecting polygon web (smoothly pulsing)
    ctx.beginPath()
    for (let s = 0; s <= segments; s++) {
        const angle = s * angleStep
        const bar = bars[numBars - 1 - (s % numBars)] || bars[0]
        const r = baseMaxRadius + (bar?.percentage || 0) * pulseFactor
        const xVal = r * Math.cos(angle)
        const yVal = r * Math.sin(angle)
        if (s === 0) {
            ctx.moveTo(xVal, yVal)
        } else {
            ctx.lineTo(xVal, yVal)
        }
    }
    ctx.strokeStyle = grad
    ctx.lineWidth = Math.max(1, padding)
    ctx.stroke()

    // 3. Draw dashed concentric web lines connecting the cross-bars (Sacred Geometry look)
    ctx.setLineDash([4, 6])
    for (let i = 8; i < numBars; i += 16) {
        ctx.beginPath()
        for (let s = 0; s <= segments; s++) {
            const angle = s * angleStep
            const bar = bars[(i + s) % numBars]
            if (!bar) continue

            const r = (i / numBars) * baseMaxRadius
            const barHeight = bar.percentage * pulseFactor * 0.5

            const xVal = (r + barHeight) * Math.cos(angle)
            const yVal = (r + barHeight) * Math.sin(angle)

            if (s === 0) {
                ctx.moveTo(xVal, yVal)
            } else {
                ctx.lineTo(xVal, yVal)
            }
        }
        ctx.strokeStyle = color || "rgba(255, 255, 255, 0.25)"
        ctx.lineWidth = 1
        ctx.stroke()
    }
    ctx.setLineDash([]) // Reset dash

    // 4. Draw the straight arms and perpendicular cross-bars
    for (let s = 0; s < segments; s++) {
        ctx.save()
        ctx.rotate(s * angleStep)

        // Draw main arm axis line
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(baseMaxRadius, 0)
        ctx.strokeStyle = grad
        ctx.lineWidth = Math.max(2, padding + 1.5)
        ctx.stroke()

        // Draw cross-bars
        for (let i = 4; i < numBars; i += 8) {
            const bar = bars[i]
            if (!bar) continue

            const r = (i / numBars) * baseMaxRadius
            const barHeight = bar.percentage * pulseFactor * 0.75
            if (barHeight < 2) continue

            ctx.strokeStyle = grad
            ctx.fillStyle = grad
            ctx.lineWidth = Math.max(1.5, padding)

            // Draw the perpendicular cross-bar
            ctx.beginPath()
            ctx.moveTo(r, -barHeight)
            ctx.lineTo(r, barHeight)
            ctx.stroke()

            // Glow circles at both ends of the cross-bar
            ctx.beginPath()
            ctx.arc(r, -barHeight, Math.max(3, barHeight * 0.2), 0, Math.PI * 2)
            ctx.arc(r, barHeight, Math.max(3, barHeight * 0.2), 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()
    }

    // 5. Central pulsing layered core (Bass responder)
    const coreRadius = Math.max(8, maxRadius * 0.12 * scale * (1 + avgPct * 0.6))

    // Outer glow ring
    const centerGrad2 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.5)
    centerGrad2.addColorStop(0, color ? color : "rgba(255, 0, 128, 0.4)")
    centerGrad2.addColorStop(1, "rgba(0, 0, 0, 0)")
    ctx.fillStyle = centerGrad2
    ctx.beginPath()
    ctx.arc(0, 0, coreRadius * 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Inner solid glowing circle
    const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius)
    centerGrad.addColorStop(0, "rgba(255, 255, 255, 1)")
    centerGrad.addColorStop(0.4, color || "rgba(0, 240, 255, 0.9)")
    centerGrad.addColorStop(1, "rgba(0, 240, 255, 0)")
    ctx.fillStyle = centerGrad
    ctx.beginPath()
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
}
