import type {
    AuroraItem,
    BloomItem,
    BubbleItem,
    CityItem,
    DayNightCycle,
    EffectDefinition,
    EffectFunction,
    EffectInit,
    EffectItem,
    EffectType,
    FogItem,
    GalaxyItem,
    LensFlareItem,
    NeonItem,
    RainItem,
    RayItem,
    ShapeItem,
    Side,
    SnowItem,
    SpotlightItem,
    StarItem,
    SunItem,
    WaveItem
} from "../../../../types/Effects"
import { createNoise2D } from "./simplex-noise"

const effectTypes: readonly EffectType[] = ["shape", "wave", "bubbles", "stars", "galaxy", "rain", "snow", "neon", "sun", "lens_flare", "spotlight", "aurora", "bloom", "fog", "city", "rays", "fireworks"] as const
// type EffectType = (typeof effectTypes)[number]

export class EffectRender {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    items: EffectItem[]
    running = false
    lastTime = 0
    width = 1920
    height = 1080
    effectData = new WeakMap<EffectItem, any>()

    dayNightCycle?: DayNightCycle
    cycleTime = 0

    TYPES: Record<string, EffectDefinition> = {}

    constructor(canvas: HTMLCanvasElement, items: EffectItem[], isPreview: boolean = false) {
        if (!canvas) throw new Error("Canvas element not found")

        // this.width = canvas.width || this.width
        // this.height = canvas.height || this.height
        canvas.width = this.width
        canvas.height = this.height

        this.canvas = canvas
        this.ctx = canvas.getContext("2d")!
        this.items = items

        this.autoRegisterEffects(effectTypes)

        if (isPreview) {
            this.frame(0, true)
            this.frame(1)
            return
        }

        this.start()
    }

    start() {
        this.running = true
        this.frame(0, true)

        const loop = (time: number) => {
            // const deltaTime = time - this.lastTime
            this.lastTime = time

            if (this.running) this.frame(1) // deltaTime / 16
            requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
    }

    stop() {
        this.running = false
    }

    updateItems(items: EffectItem[]) {
        this.items = items

        // TODO: only update if count is changed (init data)
        this.frame(0, true)
    }

    frame(deltaTime: number, init: boolean = false) {
        const ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)

        this.updateSkyGradient(deltaTime)

        for (const item of this.items) {
            const effect = this.TYPES[item.type]
            if (!effect) {
                if (init) {
                    console.warn("Unknown effect type:", item.type)
                    console.log(this.TYPES)
                }
                continue
            }

            if (init) effect.init?.(item)
            else effect.render(item, deltaTime)
        }
    }

    // Automatically binds draw/init methods
    autoRegisterEffects(names: readonly EffectType[]) {
        for (const name of names) {
            const init = (this as any)[`init${this._toMethodName(name)}`]?.bind(this)
            const render = (this as any)[`draw${this._toMethodName(name)}`]?.bind(this)
            if (render) this.TYPES[name] = { init, render }
        }
    }

    registerEffect(name: string, render: EffectFunction, init?: EffectInit) {
        this.TYPES[name] = { init, render }
    }

    private _toMethodName(name: string) {
        return name
            .replace(/_([a-z])/g, (_, c) => c.toUpperCase()) // snake_case to camelCase
            .replace(/^([a-z])/, (_, c) => c.toUpperCase()) // capitalize first letter
    }

    // SKY GRADIENT

    nightTime = 1
    updateSkyGradient(deltaTime: number) {
        if (!this.dayNightCycle) {
            this.nightTime = 1
            return
        }

        const cycleLength = 240 // seconds
        this.cycleTime += deltaTime * (this.dayNightCycle.speed || 1) * 0.016 // frame time scale

        const time = (this.cycleTime % cycleLength) / cycleLength // 0 to 1
        // const isNight = time > 0.9 || time < 0.1
        this.nightTime = time > 0.5 ? (time - 0.5) * 2 : 1 - time * 2
        const ctx = this.ctx

        // Define phases with their colors
        const skyPhases = [
            { stop: 0.0, color: "#0a0c23" }, // Night
            { stop: 0.2, color: "#f57c00" }, // Sunrise
            { stop: 0.3, color: "#87ceeb" }, // Day
            { stop: 0.7, color: "#87ceeb" }, // Day
            { stop: 0.8, color: "#f57c00" }, // Sunset
            { stop: 1.0, color: "#0a0c23" } // Night
        ]

        // Find two adjacent phases
        let i = 0
        while (i < skyPhases.length - 1 && time > skyPhases[i + 1].stop) i++

        const phaseA = skyPhases[i]
        const phaseB = skyPhases[i + 1] || phaseA

        // Interpolation factor
        const t = (time - phaseA.stop) / (phaseB.stop - phaseA.stop)

        const color = this.lerpColor(phaseA.color, phaseB.color, t)

        // Apply background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, "#000") // dark ground

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, this.width, this.height)
    }

    lerpColor(a: string, c: string, t: number): string {
        const parse = (hex: string) => {
            if (hex.startsWith("#")) hex = hex.slice(1)
            if (hex.length === 3)
                hex = hex
                    .split("")
                    .map((c) => c + c)
                    .join("")
            const num = parseInt(hex, 16)
            return {
                r: (num >> 16) & 255,
                g: (num >> 8) & 255,
                b: num & 255
            }
        }

        const colorA = parse(a)
        const colorB = parse(c)

        const r = Math.round(colorA.r + (colorB.r - colorA.r) * t)
        const g = Math.round(colorA.g + (colorB.g - colorA.g) * t)
        const b = Math.round(colorA.b + (colorB.b - colorA.b) * t)

        return `rgb(${r}, ${g}, ${b})`
    }

    // GENERALIZED RENDERS

    pos(item: EffectItem) {
        return {
            x: item.cropped?.left || 0,
            xEnd: this.width - (item.cropped?.right || 0),
            y: item.cropped?.top || 0,
            yEnd: this.height - (item.cropped?.bottom || 0)
        }
    }

    // calculate offset from percentage (0-1)
    getOffsetX(offset: number, side: Side | null = null) {
        if (side === "right") return this.width * (1 - offset)
        return this.width * offset
    }
    getOffsetY(offset: number, side: Side | null = null) {
        if (side === "bottom") return this.height * (1 - offset)
        return this.height * offset
    }

    pathOpen = false
    startPath(x: number, y: number) {
        this.pathOpen = true

        this.ctx.beginPath()
        this.ctx.moveTo(x, y)
    }

    side: Side | null = null
    startPathSide(side: Side) {
        this.side = side

        if (side === "bottom") {
            this.startPath(0, this.height)
        } else if (side === "top") {
            this.startPath(0, 0)
        } else if (side === "left") {
            this.startPath(0, 0)
        } else if (side === "right") {
            this.startPath(this.width, 0)
        }
    }

    closePath() {
        if (!this.pathOpen) return

        if (this.side === "bottom") {
            this.ctx.lineTo(this.width, this.height)
        } else if (this.side === "top") {
            this.ctx.lineTo(this.width, 0)
        } else if (this.side === "left") {
            this.ctx.lineTo(0, this.height)
        } else if (this.side === "right") {
            this.ctx.lineTo(this.width, this.height)
        }

        this.ctx.closePath()

        this.pathOpen = false
        this.side = null
    }

    close() {
        this.closePath()
        this.ctx.fill()
    }

    setGlow(x: number, y: number, radius: number, color: string = "white") {
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, "transparent")

        this.ctx.fillStyle = gradient
    }

    //////

    line(x: number, y: number) {
        this.ctx.lineTo(x, y)
    }

    circle(x: number, y: number, radius: number) {
        this.ctx.beginPath()
        // ctx.rect(bubble.x, bubble.y, radius, radius)
        this.ctx.arc(x, y, radius, 0, Math.PI * 2)
        this.ctx.fill()
    }

    // ----------- Effects Below ------------

    /// SHAPES ///

    initShape(item: ShapeItem) {
        this.effectData.set(item, {
            angle: 0
        })
    }

    drawShape(item: ShapeItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)

        data.angle += item.rotationSpeed * deltaTime * 0.01 // scale rotation over time
        const angleRad = (data.angle * Math.PI) / 180

        const x = this.getOffsetX(item.x)
        const y = this.getOffsetY(item.y)

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angleRad)

        ctx.fillStyle = item.color || "#fff"

        switch (item.shape) {
            case "circle":
                ctx.beginPath()
                ctx.arc(0, 0, item.size, 0, Math.PI * 2)
                ctx.fill()
                break
            case "rectangle":
                ctx.fillRect(-item.size, -item.size, item.size * 2, item.size * 2)
                break
            case "triangle":
                ctx.beginPath()
                const h = (item.size * Math.sqrt(3)) / 2
                ctx.moveTo(0, -h)
                ctx.lineTo(-item.size, h)
                ctx.lineTo(item.size, h)
                ctx.closePath()
                ctx.fill()
                break
        }

        ctx.restore()
    }

    /// WAVE ///

    initWave(item: WaveItem) {
        item.phase = 0
        item.side = item.side || "bottom"
        if (item.wavelength === 0) item.wavelength = 0.000001
    }

    drawWave(item: Required<WaveItem>, deltaTime: number) {
        item.phase += item.speed * 0.01 * deltaTime

        this.startPathSide(item.side)
        this.wave(item)

        // const gradient = ctx.createLinearGradient(0, yOffset - amplitude, 0, this.height)
        // gradient.addColorStop(0, color)
        // gradient.addColorStop(1, "rgba(0, 25, 50, 0.9)")
        // ctx.fillStyle = gradient

        this.ctx.fillStyle = item.color
        this.close()
    }

    wave(item: Required<WaveItem>) {
        if (item.side === "left" || item.side === "right") {
            for (let y = 0; y <= this.height; y++) {
                const x = this.getOffsetX(item.offset, item.side) + item.amplitude * Math.sin((y / item.wavelength) * 2 * Math.PI + item.phase)
                this.line(x, y)
            }
        } else {
            for (let x = 0; x <= this.width; x++) {
                const y = this.getOffsetY(item.offset, item.side) + item.amplitude * Math.sin((x / item.wavelength) * 2 * Math.PI + item.phase)
                this.line(x, y)
            }
        }
    }

    /// BUBBLES ///

    initBubbles(item: BubbleItem) {
        const bubbles = Array.from({ length: item.count }, () => {
            return {
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseRadius: Math.random() * item.size + item.maxSizeVariation,
                pulseSpeed: Math.random() * ((item.pulseSpeed || 1) * 0.0002) + 0.0001,
                pulsePhase: Math.random() * Math.PI * 2,
                speed: item.speed * (Math.random() * 0.5 + 0.2),
                drift: (Math.random() - 0.5) * 0.5,
                color: `hsla(${Math.random() * 360}, 100%, 70%, 0.2)`
                // WIP color range? / specific color with different brightness
            }
        })
        this.effectData.set(item, bubbles)
    }

    drawBubbles(item: BubbleItem, deltaTime: number) {
        const ctx = this.ctx
        const bubbles = this.effectData.get(item)
        const time = performance.now()

        for (let bubble of bubbles) {
            const pulse = Math.sin(time * bubble.pulseSpeed + bubble.pulsePhase) * 0.3 + 1
            const radius = bubble.baseRadius * pulse

            // ctx.save()
            ctx.fillStyle = bubble.color
            // ctx.shadowBlur = 10
            // ctx.shadowColor = bubble.color
            this.circle(bubble.x, bubble.y, radius)
            // ctx.restore()

            // float
            bubble.y -= bubble.speed * deltaTime
            bubble.x += bubble.drift

            // move back to bottom
            if (bubble.y + radius < 0) {
                bubble.y = this.canvas.height + radius
                bubble.x = Math.random() * this.canvas.width
            }
        }
    }

    /// STARS ///

    initStars(item: StarItem) {
        const baseSize = Math.min(this.canvas.width, this.canvas.height) * item.size
        const minRadius = baseSize * 0.0005
        const maxRadius = baseSize * 0.0025

        const stars = Array.from({ length: item.count }, () => {
            const radius = Math.random() * (maxRadius - minRadius) + minRadius
            return {
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius,
                alpha: Math.random() * 0.5 + 0.5,
                alphaChange: (Math.random() * 0.005 + 0.0001) * (Math.random() < 0.5 ? -1 : 1) * (item.speed ?? 1)
            }
        })
        this.effectData.set(item, stars)
    }

    drawStars(item: StarItem) {
        const ctx = this.ctx
        const stars = this.effectData.get(item)

        for (let star of stars) {
            ctx.save()
            ctx.globalAlpha = star.alpha * this.nightTime

            const glowRadius = star.radius * 2
            this.setGlow(star.x, star.y, glowRadius)
            this.circle(star.x, star.y, glowRadius)

            ctx.restore()

            // FLASH
            star.alpha += star.alphaChange
            if (star.alpha <= 0 || star.alpha >= 1) {
                star.alphaChange *= -1
                star.alpha = Math.max(0, Math.min(1, star.alpha))
            }
        }
    }

    /// GALAXY ///

    initGalaxy(item: GalaxyItem) {
        const centerX = this.canvas.width / 2
        const centerY = this.canvas.height / 2
        // const maxRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45

        // const stars = []
        const arms = item.armCount ?? 4
        const swirl = item.swirlStrength
        const colors = item.colors ?? ["white", "lightblue", "violet"]

        const ARM_COUNT = arms
        const ARM_SPREAD = swirl
        const a = 20 // Controls spiral tightness
        const b = 0.35 // Controls spiral spacing
        const tMax = item.size * 5 // Higher = larger galaxy
        const spiralStars: any[] = []

        // SPIRAL STARS
        for (let i = 0; i < item.count * 0.8; i++) {
            const arm = i % ARM_COUNT
            const armAngle = ((2 * Math.PI) / ARM_COUNT) * arm
            const t = Math.random() * tMax
            const r = a * Math.exp(b * t)
            const angle = armAngle + t + (Math.random() - 0.5) * ARM_SPREAD

            spiralStars.push({
                inCore: false,
                radius: r,
                baseRotation: angle,
                rotation: angle,
                size: Math.random() * item.size + 0.5,
                color: colors[Math.floor(Math.random() * colors.length)]
            })
        }

        // CORE STARS
        const CORE_RADIUS = tMax * 2 // pixels
        const CORE_STARS = Math.floor(0.08 * item.count)

        for (let i = 0; i < CORE_STARS; i++) {
            const r = Math.pow(Math.random(), 1) * CORE_RADIUS // 0.7 gives more mid-radius stars
            const angle = Math.random() * 2 * Math.PI
            const x = this.width / 2 + r * Math.cos(angle)
            const y = this.height / 2 + r * Math.sin(angle)

            spiralStars.push({
                inCore: true,
                x,
                y,
                radius: r,
                rotation: angle,
                size: Math.random() * item.size + 0.5,
                color: colors[Math.floor(Math.random() * colors.length)]
            })
        }

        const nebula = Array.from({ length: 6 }, () => {
            const radius = Math.random() * 250 + 200
            const x = centerX + (Math.random() - 0.5) * 400
            const y = centerY + (Math.random() - 0.5) * 400
            const hue = 200 + Math.random() * 60
            const alpha = Math.random() * 0.08 + 0.015
            return { x, y, radius, color: `hsla(${hue}, 70%, 60%, ${alpha})` }
        })

        this.effectData.set(item, { stars: spiralStars, nebula })
    }

    drawGalaxy(item: GalaxyItem, deltaTime: number) {
        const maxRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45
        const { stars, nebula } = this.effectData.get(item)
        const centerX = this.canvas.width / 2
        const centerY = this.canvas.height / 2

        for (const star of stars) {
            let x, y

            if (!star.inCore) {
                star.rotation += item.rotationSpeed * 0.0002 * deltaTime

                x = centerX + Math.cos(star.rotation) * star.radius
                y = centerY + Math.sin(star.rotation) * star.radius
            } else {
                x = star.x // + (Math.random() - 0.5) * 2
                y = star.y // + (Math.random() - 0.5) * 2
            }

            const fade = star.inCore ? 1 : Math.max(0.3, 1 - star.radius / maxRadius)

            this.ctx.save()
            this.ctx.globalAlpha = fade * this.nightTime
            this.setGlow(x, y, star.size * (star.inCore ? 3 : 2), star.color)
            this.circle(x, y, star.size)
            this.ctx.restore()
        }

        if (item.nebula) this.drawStaticNebula(nebula)
    }

    drawStaticNebula(clouds: { x: number; y: number; radius: number; color: string }[]) {
        const ctx = this.ctx
        ctx.save()
        for (const cloud of clouds) {
            const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius)
            gradient.addColorStop(0, cloud.color)
            gradient.addColorStop(1, "transparent")
            ctx.fillStyle = gradient
            // this.ctx.globalAlpha = this.nightTime
            ctx.beginPath()
            ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }

    /// RAIN ///

    initRain(item: RainItem) {
        const drops = Array.from({ length: item.count }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            speed: item.speed * (0.5 + Math.random() * 0.5),
            length: item.length * (0.5 + Math.random() * 0.5),
            width: item.width,
            color: item.color || "rgba(173,216,230,0.5)" // Light blue default
        }))
        this.effectData.set(item, drops)
    }

    drawRain(item: RainItem, deltaTime: number) {
        const ctx = this.ctx
        const drops = this.effectData.get(item)

        ctx.save()
        ctx.lineCap = "round"
        for (const drop of drops) {
            ctx.strokeStyle = drop.color
            ctx.lineWidth = drop.width

            ctx.beginPath()
            ctx.moveTo(drop.x, drop.y)
            ctx.lineTo(drop.x, drop.y + drop.length)
            ctx.stroke()

            // Move the drop
            drop.y += drop.speed * deltaTime
            if (drop.y > this.canvas.height) {
                drop.y = -drop.length
                drop.x = Math.random() * this.canvas.width
            }
        }
        ctx.restore()
    }

    /// RAIN SCREEN ///

    // initRainScreen(item: RainScreenItem) {
    //     const drops = Array.from({ length: item.count }, () => {
    //         const radius = Math.random() * (item.maxRadius - item.minRadius) + item.minRadius
    //         return {
    //             x: Math.random() * this.canvas.width,
    //             y: Math.random() * this.canvas.height,
    //             vx: (Math.random() - 0.5) * 0.2,
    //             vy: Math.random() * 0.3 + 0.05,
    //             radius,
    //             stretch: 1 + Math.random() * 1.5,
    //             alpha: Math.random() * 0.4 + 0.1
    //         }
    //     })
    //     this.effectData.set(item, drops)
    // }

    // drawRainScreen(item: RainScreenItem, deltaTime: number) {
    //     const ctx = this.ctx
    //     const drops = this.effectData.get(item)

    //     ctx.save()
    //     ctx.globalCompositeOperation = "lighter" // blend light tones for shine

    //     for (const drop of drops) {
    //         const stretch = drop.stretch
    //         const radius = drop.radius
    //         const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, radius)
    //         gradient.addColorStop(0, "rgba(255,255,255,0.3)")
    //         gradient.addColorStop(0.6, item.color || "rgba(180,200,255,0.15)")
    //         gradient.addColorStop(1, "rgba(255,255,255,0)")

    //         ctx.fillStyle = gradient

    //         ctx.beginPath()
    //         ctx.ellipse(drop.x, drop.y, radius, radius * stretch, 0, 0, Math.PI * 2)
    //         ctx.fill()

    //         // Simulate specular highlight
    //         ctx.fillStyle = "rgba(255,255,255,0.3)"
    //         ctx.beginPath()
    //         ctx.ellipse(drop.x - radius * 0.3, drop.y - radius * stretch * 0.3, radius * 0.3, radius * 0.15, 0, 0, Math.PI * 2)
    //         ctx.fill()

    //         if (item.smear) {
    //             const trailLength = radius * 15 * stretch
    //             const grad = ctx.createLinearGradient(drop.x, drop.y - trailLength, drop.x, drop.y)
    //             grad.addColorStop(0, "rgba(200,200,255,0)")
    //             grad.addColorStop(1, "rgba(200,200,255,0.1)")

    //             ctx.strokeStyle = grad
    //             ctx.lineWidth = radius * 0.4
    //             ctx.beginPath()
    //             ctx.moveTo(drop.x, drop.y - trailLength)
    //             ctx.lineTo(drop.x, drop.y)
    //             ctx.stroke()
    //         }

    //         // movement
    //         drop.y += drop.vy * (item.gravity || 1) * deltaTime
    //         drop.x += drop.vx * deltaTime

    //         // reset if off screen
    //         if (drop.y - radius > this.canvas.height) {
    //             drop.y = -radius * 2
    //             drop.x = Math.random() * this.canvas.width
    //         }
    //     }

    //     ctx.restore()
    // }

    /// SNOW ///

    initSnow(item: SnowItem) {
        const snowflakes = Array.from({ length: item.count }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: item.size * (0.5 + Math.random()),
            speed: item.speed * 0.5 * (0.5 + Math.random()),
            drift: (item.drift ?? 0.5) * (Math.random() - 0.5), // horizontal sway
            phase: Math.random() * Math.PI * 2,
            color: item.color || "white"
        }))
        this.effectData.set(item, snowflakes)
    }

    drawSnow(item: SnowItem, deltaTime: number) {
        const ctx = this.ctx
        const snowflakes = this.effectData.get(item)
        const time = performance.now()

        ctx.save()
        ctx.fillStyle = item.color || "white"

        for (const flake of snowflakes) {
            // sway motion
            const sway = Math.sin(time * 0.001 + flake.phase) * flake.drift * 2

            this.circle(flake.x + sway, flake.y, flake.size)

            flake.y += flake.speed * deltaTime
            flake.x += flake.drift * 0.5

            if (flake.y > this.canvas.height) {
                flake.y = -flake.size
                flake.x = Math.random() * this.canvas.width
            }
        }

        ctx.restore()
    }

    /// NEON (WIP) ///

    drawNeon(item: NeonItem, deltaTime: number) {
        const ctx = this.ctx
        const centerX = this.canvas.width / 2
        const centerY = this.canvas.height / 2

        item.angle += item.speed * deltaTime

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(item.angle)

        ctx.beginPath()
        ctx.arc(0, 0, item.radius, 0, Math.PI * 1.8)
        ctx.strokeStyle = item.color
        ctx.lineWidth = item.thickness
        ctx.shadowBlur = 20
        ctx.shadowColor = item.color

        ctx.stroke()
        ctx.restore()
    }

    /// SUN ///

    initSun(_item: SunItem) {
        // Nothing complex needed here, just a placeholder if needed
    }

    drawSun(item: SunItem) {
        const ctx = this.ctx
        const {
            x,
            y,
            radius,
            rayCount,
            rayLength,
            rayWidth,
            color = "rgba(255, 223, 0, 0.9)" // yellow base
        } = item

        ctx.save()

        // --- CORE: layered glows for smooth intensity ---

        // Outer glow (largest, faint)
        {
            const glowRadius = radius * 4
            const grad = ctx.createRadialGradient(x, y, radius * 1.5, x, y, glowRadius)
            grad.addColorStop(0, "rgba(255, 255, 255, 0.15)")
            grad.addColorStop(1, "transparent")
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
            ctx.fill()
        }

        // Mid glow (yellowish)
        {
            const glowRadius = radius * 2.5
            const grad = ctx.createRadialGradient(x, y, radius, x, y, glowRadius)
            grad.addColorStop(0, "rgba(255, 255, 255, 0.5)") // strong white center
            grad.addColorStop(0.3, color) // yellow fade out
            grad.addColorStop(1, "transparent")
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
            ctx.fill()
        }

        // Inner core (small bright white circle with heavy blur)
        {
            ctx.shadowColor = "rgba(255, 255, 255, 0.9)"
            ctx.shadowBlur = radius * 1.5
            ctx.fillStyle = "rgba(255, 255, 255, 1)"
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
        }

        // --- RAYS: soft bloom glows instead of hard triangles ---
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * 2 * Math.PI

            const waveAmp = rayWidth * 0.3 // subtle wave height
            const waveFreq = 5 // number of waves around the circle

            const rayX = x + Math.cos(angle) * radius * 0.8
            const rayY = y + Math.sin(angle) * radius * 0.8

            this.drawWavyRay(rayX, rayY, rayLength, waveAmp, waveFreq, "rgba(255, 255, 255, 0.35)", "rgba(255, 223, 0, 0.15)")

            // Create a radial gradient for each ray (soft bloom)
            const rayRadius = rayLength
            const grad = ctx.createRadialGradient(rayX, rayY, 0, rayX, rayY, rayRadius)
            grad.addColorStop(0, "rgba(255, 255, 255, 0.35)") // bright white core of ray
            grad.addColorStop(0.2, "rgba(255, 223, 220, 0.15)") // yellow soft edge
            grad.addColorStop(1, "transparent")

            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(rayX, rayY, rayRadius, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()

        // Draw enhanced lens flare with white highlights
        this.drawEnhancedLensFlare(x, y, radius * 3, "rgba(255, 255, 255, 0.6)")
    }

    // Helper to draw a softly wavy radial gradient "ray"
    drawWavyRay(x: number, y: number, baseRadius: number, waveAmplitude: number, waveFrequency: number, colorStart: string, colorEnd: string) {
        const ctx = this.ctx
        const segments = 60
        const angleStep = (2 * Math.PI) / segments

        // Create a path with radius modulated by a small sine wave
        ctx.beginPath()
        for (let i = 0; i <= segments; i++) {
            const angle = i * angleStep
            const waveOffset = Math.sin(angle * waveFrequency) * waveAmplitude
            const r = baseRadius + waveOffset
            const px = x + Math.cos(angle) * r
            const py = y + Math.sin(angle) * r
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
        }
        ctx.closePath()

        // Create radial gradient centered at (x, y) covering roughly baseRadius + waveAmplitude
        const grad = ctx.createRadialGradient(x, y, 0, x, y, baseRadius + waveAmplitude)
        grad.addColorStop(0, colorStart)
        grad.addColorStop(0.2, colorEnd)
        grad.addColorStop(1, "transparent")

        ctx.fillStyle = grad
        ctx.fill()
    }

    drawEnhancedLensFlare(x: number, y: number, radius: number, _baseColor: string) {
        const ctx = this.ctx
        ctx.save()

        // Main bright white glow
        const mainGlow = ctx.createRadialGradient(x, y, 0, x, y, radius)
        mainGlow.addColorStop(0, "rgba(255, 255, 255, 0.7)")
        mainGlow.addColorStop(0.7, "rgba(255, 255, 255, 0.1)")
        mainGlow.addColorStop(1, "transparent")
        ctx.fillStyle = mainGlow
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()

        // Ghost flares with white base
        const ghostCount = 5
        for (let i = 1; i <= ghostCount; i++) {
            const offsetX = x + i * radius * 0.6 * (i % 2 === 0 ? 1 : -1)
            const offsetY = y + i * radius * 0.2 * (i % 2 === 0 ? -1 : 1)
            const ghostRadius = radius * 0.2 * (1 - i / ghostCount)

            const ghostGradient = ctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, ghostRadius)
            ghostGradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 * (1 - i / ghostCount)})`)
            ghostGradient.addColorStop(1, "transparent")

            ctx.fillStyle = ghostGradient
            ctx.beginPath()
            ctx.arc(offsetX, offsetY, ghostRadius, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()
    }

    /// LENS FLARE ///

    // initLensFlare(item: LensFlareItem) {
    //     const flare = new LensFlareRender(this.canvas, this.ctx)
    //     flare.setup(item)
    //     this.effectData.set(item, flare)
    // }

    // drawLensFlare(item: LensFlareItem, deltaTime: number) {
    //     const flare = this.effectData.get(item)
    //     flare.render(deltaTime)
    // }

    private flareDiscs: {
        x: number
        y: number
        dia: number
        hue: number
    }[] = []

    private flareDiscNum = 9
    private flareT = 0

    initLensFlare(item: LensFlareItem) {
        const pos = this.pos(item)
        const flareX = (pos.x + pos.xEnd) / 2
        const flareY = (pos.y + pos.yEnd) / 2
        this.effectData.set(item, { x: flareX, y: flareY })

        // Initialize discs on first call
        if (this.flareT === 0) {
            this.flareDiscs = []

            for (let i = 0; i <= this.flareDiscNum; i++) {
                const j = i - this.flareDiscNum / 2
                const x = (this.width / 2 - flareX) * ((j / this.flareDiscNum) * 2) + this.width / 2
                const y = (this.height / 2 - flareY) * ((j / this.flareDiscNum) * 2) + this.height / 2
                const dia = Math.pow(Math.abs(10 * (j / this.flareDiscNum)), 2) * 3 + 110 + (Math.random() * 100 - 100)
                const hue = Math.round(Math.random() * 360)

                this.flareDiscs.push({ x, y, dia, hue })
            }
        }

        this.flareT += 1
    }

    drawLensFlare(item: LensFlareItem) {
        const ctx = this.ctx
        if (!ctx) return

        const pos = this.effectData.get(item)
        if (!pos) return

        const { x, y } = pos
        ctx.clearRect(0, 0, this.width, this.height)
        ctx.globalCompositeOperation = "screen"

        const dist = 1 - Math.sqrt(Math.pow(x - this.width / 2, 2) + Math.pow(y - this.height / 2, 2)) / Math.sqrt(Math.pow(this.width / 2, 2) + Math.pow(this.height / 2, 2))

        for (let i = 0; i < this.flareDiscs.length; i++) {
            const disc = this.flareDiscs[i]

            const j = i - this.flareDiscNum / 2
            disc.x = (this.width / 2 - x) * ((j / this.flareDiscNum) * 2) + this.width / 2
            disc.y = (this.height / 2 - y) * ((j / this.flareDiscNum) * 2) + this.height / 2

            const grad = ctx.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, disc.dia)
            grad.addColorStop(0, `hsla(${disc.hue},100%,90%,${0 * dist})`)
            grad.addColorStop(0.9, `hsla(${disc.hue},100%,90%,${0.15 * dist})`)
            grad.addColorStop(1, `hsla(${disc.hue},100%,90%,0)`)

            ctx.beginPath()
            ctx.fillStyle = grad
            ctx.arc(disc.x, disc.y, disc.dia, 0, Math.PI * 2)
            ctx.closePath()
            ctx.fill()

            if (i === 0) {
                this.drawFlareCore(disc, dist)
            }
        }
    }

    private drawFlareCore(disc: { x: number; y: number; dia: number; hue: number }, dist: number) {
        const ctx = this.ctx
        if (!ctx) return

        // Glow
        const grad1 = ctx.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, disc.dia * 2)
        grad1.addColorStop(0, `rgba(200,220,255,${0.2 * dist})`)
        grad1.addColorStop(1, "rgba(200,220,255,0)")
        ctx.beginPath()
        ctx.fillStyle = grad1
        ctx.arc(disc.x, disc.y, disc.dia * 2, 0, Math.PI * 2)
        ctx.fill()

        // Spectral disc
        const ease = (a: number, b: number, t: number) => (b - a) * (1 - Math.pow(t - 1, 2)) + a
        const spec = ease(disc.dia / 5, disc.dia / 2.5, dist)
        const sdist = 1 - Math.pow(Math.abs(dist - 1), 3)
        const grad2 = ctx.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, spec)
        grad2.addColorStop(0.2 * sdist, `rgba(255,255,255,${sdist})`)
        grad2.addColorStop(0.6, `hsla(${disc.hue},100%,75%,${0.3 * sdist})`)
        grad2.addColorStop(1, `hsla(${disc.hue},100%,40%,0)`)
        ctx.beginPath()
        ctx.fillStyle = grad2
        ctx.arc(disc.x, disc.y, disc.dia / 2.5, 0, Math.PI * 2)
        ctx.fill()

        // Horizontal streak
        const grad3 = ctx.createLinearGradient(disc.x - disc.dia * 1.5, disc.y, disc.x + disc.dia * 1.5, disc.y)
        grad3.addColorStop(0, "rgba(240,250,255,0)")
        grad3.addColorStop(0.5, `rgba(240,250,255,${0.4 * dist ** 3})`)
        grad3.addColorStop(1, "rgba(240,250,255,0)")
        ctx.fillStyle = grad3
        ctx.fillRect(disc.x - disc.dia * 1.5, disc.y - 2, disc.dia * 3, 4)

        // Vertical streak
        const grad4 = ctx.createLinearGradient(disc.x, disc.y - disc.dia * 1.5, disc.x, disc.y + disc.dia * 1.5)
        grad4.addColorStop(0, "rgba(240,250,255,0)")
        grad4.addColorStop(0.5, `rgba(240,250,255,${0.4 * dist ** 3})`)
        grad4.addColorStop(1, "rgba(240,250,255,0)")
        ctx.fillStyle = grad4
        ctx.fillRect(disc.x - 2, disc.y - disc.dia * 1.5, 4, disc.dia * 3)
    }

    /// SPOT LIGHT ///

    initSpotlight(item: SpotlightItem) {
        this.effectData.set(item, { swayPhase: Math.random() * Math.PI * 2 })
    }

    drawSpotlight(item: SpotlightItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        data.swayPhase += item.swaySpeed * deltaTime * 0.016
        // pendulum sway
        // const swayAngle = Math.sin(data.swayPhase) * item.swayAmplitude
        // motor turn
        const t = (data.swayPhase / Math.PI) % 2
        const triangular = t < 1 ? t : 2 - t // rises from 0→1 then falls from 1→0
        const swayAngle = (triangular - 0.5) * 2 * item.swayAmplitude

        const baseX = item.x
        const baseY = item.y
        const length = item.length
        const baseHalf = item.baseWidth / 2

        ctx.save()
        ctx.translate(baseX, baseY)
        ctx.rotate(swayAngle)

        // Convert color to rgba with custom opacity for the gradient
        const baseColor = item.color
        const rgba = (opacity: number) =>
            baseColor.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
                const [r, g, b] = inner.split(",").map((n: string) => parseFloat(n.trim()))
                return `rgba(${r},${g},${b},${opacity})`
            }) || baseColor

        // Light cone gradient based on main color
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, length * 0.9)
        gradient.addColorStop(0, rgba(0.3))
        gradient.addColorStop(0.5, rgba(0.15))
        gradient.addColorStop(1, rgba(0))

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-baseHalf, length)
        ctx.lineTo(baseHalf, length)
        ctx.closePath()
        ctx.fill()

        // Soft glow around the light base
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 200)
        glowGradient.addColorStop(0, rgba(0.3))
        glowGradient.addColorStop(0.8, rgba(0))

        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(0, 0, length * 0.25, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
    }

    /// AURORA ///

    initAurora(item: AuroraItem) {
        const bandCount = item.bandCount
        const maxHeight = this.canvas.height * 0.25 // top 25%
        const offsetY = this.getOffsetY(item.offset ?? 0.12)
        const bands: any[] = []

        // item.colorStops = []
        // for (let i = 0; i < 16; i++) {
        //     item.colorStops.push("#00ff88", "#00ff88", "#00ff88", "transparent")
        // }

        for (let i = 0; i < bandCount; i++) {
            bands.push({
                phase: Math.random() * Math.PI * 2,
                bottomPhase: Math.random() * Math.PI * 2, // phase offset for bottom wave
                offsetY: (maxHeight / bandCount) * i + ((Math.random() * maxHeight) / bandCount) * 0.4 + offsetY, // closer, some jitter
                amplitude: item.amplitude * (0.8 + Math.random() * 0.4),
                wavelength: item.wavelength * (0.8 + Math.random() * 0.4),
                speed: item.speed * (0.5 + Math.random()),
                colorStops: item.colorStops,
                opacity: item.opacity ?? 0.2,
                noise2D: createNoise2D()
            })
        }

        this.effectData.set(item, bands)
    }

    drawAurora(item: AuroraItem, deltaTime: number) {
        const ctx = this.ctx
        const bands = this.effectData.get(item)

        ctx.save()
        ctx.globalCompositeOperation = "lighter"
        ctx.filter = "blur(8px)"

        for (const band of bands) {
            if (this.running) {
                band.phase += band.speed * 0.01 * deltaTime
                band.bottomPhase += band.speed * 0.01 * deltaTime * 0.8 // slightly different speed for bottom wave
            }

            // Horizontal gradient from left (0) to right (canvas.width)
            const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, 0)
            for (let i = 0; i < band.colorStops.length; i++) {
                gradient.addColorStop(i / (band.colorStops.length - 1), band.colorStops[i])
            }

            ctx.fillStyle = gradient
            ctx.globalAlpha = band.opacity

            ctx.beginPath()

            // Top edge wave (left -> right)
            ctx.moveTo(0, band.offsetY)
            for (let x = 0; x <= this.canvas.width; x += 2) {
                const y = band.offsetY + band.amplitude * band.noise2D(x / band.wavelength, band.phase)
                ctx.lineTo(x, y)
            }

            // Bottom edge wave (right -> left), related but randomized with different phase
            for (let x = this.canvas.width; x >= 0; x -= 2) {
                const y = band.offsetY + band.amplitude * 2 + band.amplitude * band.noise2D(x / band.wavelength, band.bottomPhase)
                ctx.lineTo(x, y)
            }

            ctx.closePath()
            ctx.fill()
        }

        ctx.restore()
    }

    // initAurora(item: AuroraItem) {
    //     const bandCount = item.bandCount
    //     const maxHeight = this.canvas.height * 0.25
    //     const offsetY = this.getOffsetY(item.offset ?? 0.12)
    //     const bands: any[] = []

    //     const colorStops = (item.colorStops?.length ?? 0) > 0 ? item.colorStops : Array.from({ length: 16 }, () => "#00ff88") // default green aurora

    //     for (let i = 0; i < bandCount; i++) {
    //         bands.push({
    //             phase: Math.random() * Math.PI * 2,
    //             bottomPhase: Math.random() * Math.PI * 2,
    //             offsetY: (maxHeight / bandCount) * i + ((Math.random() * maxHeight) / bandCount) * 0.4 + offsetY,
    //             amplitude: item.amplitude * (0.8 + Math.random() * 0.4),
    //             wavelength: item.wavelength * (0.8 + Math.random() * 0.4),
    //             speed: item.speed * (0.5 + Math.random()),
    //             colorStops,
    //             opacity: item.opacity ?? 0.2,
    //             noise2D: createNoise2D()
    //         })
    //     }

    //     this.auroraBuffer.width = this.canvas.width
    //     this.auroraBuffer.height = this.canvas.height

    //     this.effectData.set(item, bands)
    // }

    // private auroraBuffer = document.createElement("canvas")
    // private auroraCtx = this.auroraBuffer.getContext("2d")!
    // drawAurora(item: AuroraItem, deltaTime: number) {
    //     const bands = this.effectData.get(item)

    //     // Prepare offscreen buffer
    //     const buffer = this.auroraBuffer
    //     const ctx = this.auroraCtx
    //     ctx.clearRect(0, 0, buffer.width, buffer.height)

    //     ctx.globalCompositeOperation = "lighter"
    //     ctx.globalAlpha = 1
    //     ctx.filter = "none"

    //     for (const band of bands) {
    //         if (this.running) {
    //             band.phase += band.speed * 0.01 * deltaTime
    //             band.bottomPhase += band.speed * 0.008 * deltaTime
    //         }

    //         const gradient = ctx.createLinearGradient(0, 0, buffer.width, 0)
    //         for (let i = 0; i < band.colorStops.length; i++) {
    //             gradient.addColorStop(i / (band.colorStops.length - 1), band.colorStops[i])
    //         }

    //         ctx.fillStyle = gradient
    //         ctx.globalAlpha = band.opacity

    //         ctx.beginPath()
    //         ctx.moveTo(0, band.offsetY)
    //         const step = 4

    //         // Top wave
    //         for (let x = 0; x <= buffer.width; x += step) {
    //             const y = band.offsetY + band.amplitude * band.noise2D(x / band.wavelength, band.phase)
    //             ctx.lineTo(x, y)
    //         }

    //         // Bottom wave
    //         for (let x = buffer.width; x >= 0; x -= step) {
    //             const y = band.offsetY + band.amplitude * 2 + band.amplitude * band.noise2D(x / band.wavelength, band.bottomPhase)
    //             ctx.lineTo(x, y)
    //         }

    //         ctx.closePath()
    //         ctx.fill()
    //     }

    //     // Now draw the blurred buffer onto main canvas with filter (one time only!)
    //     const mainCtx = this.ctx
    //     mainCtx.save()
    //     // mainCtx.filter = "blur(8px)"
    //     mainCtx.globalAlpha = 1.2 // slight bloom boost
    //     mainCtx.filter = "blur(8px) brightness(1.1)"

    //     mainCtx.globalCompositeOperation = "lighter"
    //     mainCtx.drawImage(buffer, 0, 0)
    //     mainCtx.restore()
    // }

    /// BLOOM ///

    initBloom(item: BloomItem) {
        const width = this.width
        const height = this.height
        const blobCount = item.blobCount ?? 10

        const blobs: any[] = []
        for (let i = 0; i < blobCount; i++) {
            blobs.push({
                x: width / 2 + (Math.random() - 0.5) * width * 0.8,
                y: height / 2 + (Math.random() - 0.5) * height * 0.8,
                radiusX: 150 + Math.random() * 250,
                radiusY: 80 + Math.random() * 150,
                color: Math.random() * 360,
                alpha: 0.15 + Math.random() * 0.25,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.00015,
                speedX: (Math.random() - 0.5) * 1.5 * (item.speed || 1),
                speedY: (Math.random() - 0.5) * 1.3 * (item.speed || 1)
            })
        }

        const bufferScale = 0.5 // render at half resolution
        const bufferCanvas = document.createElement("canvas")
        bufferCanvas.width = width * bufferScale
        bufferCanvas.height = height * bufferScale
        const bufferCtx = bufferCanvas.getContext("2d")!

        this.effectData.set(item, {
            blobs,
            bufferCanvas,
            bufferCtx,
            bufferScale,
            blurAmount: item.blurAmount ?? 50
        })
    }

    drawBloom(item: BloomItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        const { blobs, bufferCtx, bufferCanvas, bufferScale, blurAmount } = data

        // Update blob positions
        for (const blob of blobs) {
            blob.rotation += blob.rotationSpeed * deltaTime
            blob.x += blob.speedX * deltaTime
            blob.y += blob.speedY * deltaTime

            const w = this.width
            const h = this.height
            if (blob.x < -blob.radiusX) blob.x = w + blob.radiusX
            else if (blob.x > w + blob.radiusX) blob.x = -blob.radiusX
            if (blob.y < -blob.radiusY) blob.y = h + blob.radiusY
            else if (blob.y > h + blob.radiusY) blob.y = -blob.radiusY
        }

        // Clear buffer
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height)

        bufferCtx.save()
        bufferCtx.scale(bufferScale, bufferScale)
        bufferCtx.globalCompositeOperation = "screen"

        for (const blob of blobs) {
            bufferCtx.save()
            bufferCtx.translate(blob.x, blob.y)
            bufferCtx.rotate(blob.rotation)

            const grad = bufferCtx.createRadialGradient(0, 0, 0, 0, 0, blob.radiusX)
            grad.addColorStop(0, `hsla(${blob.color}, 90%, 70%, ${blob.alpha})`)
            grad.addColorStop(1, "transparent")

            bufferCtx.fillStyle = grad
            bufferCtx.beginPath()
            bufferCtx.ellipse(0, 0, blob.radiusX, blob.radiusY, 0, 0, Math.PI * 2)
            bufferCtx.fill()

            bufferCtx.restore()
        }

        bufferCtx.restore()

        // Apply blur ONCE to the buffer canvas
        ctx.save()
        ctx.filter = `blur(${blurAmount}px)`
        ctx.globalCompositeOperation = "screen"
        ctx.drawImage(bufferCanvas, 0, 0, this.width, this.height)
        ctx.restore()
    }

    /// FOG ///

    initFog(item: FogItem) {
        const offsetY = this.getOffsetY(item.offset ?? 0.3)
        const clouds = Array.from({ length: item.count }, () => {
            return {
                x: Math.random() * this.canvas.width,
                // y: Math.random() * this.canvas.height,
                y: offsetY + (Math.random() - 0.5) * (item.spread || 300),
                // y: this.height * 0.6 + (Math.random() - 0.5) * this.height * 0.1, // cluster low
                radius: item.size * (0.8 + Math.random() * 0.4), // less size variation
                opacity: (item.opacity ?? 0.08) * (0.8 + Math.random() * 0.4), // low opacity
                speed: item.speed * (0.6 + Math.random() * 0.4),
                drift: (Math.random() - 0.5) * 0.1
            }
        })
        this.effectData.set(item, clouds)
    }

    // drawFog(item: FogItem, deltaTime: number) {
    //     const ctx = this.ctx
    //     const clouds = this.effectData.get(item)
    //     const blur = item.blur ?? 40

    //     ctx.save()
    //     ctx.globalCompositeOperation = "source-over"
    //     ctx.filter = `blur(${blur}px)`

    //     for (const cloud of clouds) {
    //         ctx.beginPath()
    //         ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`
    //         this.circle(cloud.x, cloud.y, cloud.radius)

    //         cloud.x += cloud.speed * deltaTime
    //         cloud.y += cloud.drift * deltaTime

    //         // wrap horizontally
    //         if (cloud.x > this.width + cloud.radius) cloud.x = -cloud.radius
    //         if (cloud.x < -cloud.radius) cloud.x = this.width + cloud.radius
    //     }

    //     ctx.restore()
    // }

    drawFog(item: FogItem, deltaTime: number) {
        const ctx = this.ctx
        const clouds = this.effectData.get(item)
        const blur = item.blur ?? 40

        ctx.save()
        ctx.globalCompositeOperation = "source-over"

        for (const cloud of clouds) {
            // Get or create a blurred cloud image
            const img = this.getBlurredCloud(cloud.radius, blur, cloud.opacity)

            // Draw image centered on cloud position
            const drawX = cloud.x - img.width / 2
            const drawY = cloud.y - img.height / 2
            ctx.drawImage(img, drawX, drawY)

            // Move cloud
            cloud.x += cloud.speed * deltaTime
            cloud.y += cloud.drift * deltaTime

            // Wrap horizontally
            if (cloud.x > this.width + cloud.radius) cloud.x = -cloud.radius
            if (cloud.x < -cloud.radius) cloud.x = this.width + cloud.radius
        }

        ctx.restore()
    }

    private cloudCache = new Map<string, HTMLCanvasElement>()

    private getBlurredCloud(radius: number, blur: number, opacity: number): HTMLCanvasElement {
        const key = `${radius}-${blur}-${opacity}`
        if (this.cloudCache.has(key)) return this.cloudCache.get(key)!

        const size = (radius + blur) * 2
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")!

        ctx.filter = `blur(${blur}px)`
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
        ctx.fill()

        this.cloudCache.set(key, canvas)
        return canvas
    }

    /// CITY ///

    initCity(item: CityItem) {
        const buildings = Array.from({ length: item.buildingCount }, () => {
            const width = Math.random() * (item.maxWidth - item.minWidth) + item.minWidth
            const height = Math.random() * (item.maxHeight - item.minHeight) + item.minHeight
            const x = Math.random() * (this.canvas.width - width)

            return {
                x,
                y: this.canvas.height - height,
                width,
                height,
                color: item.color || "#333",
                windowColor: item.windowColor || "#ffd700",
                windows: this._generateWindows(width, height, item.night ?? true)
            }
        })

        // Sort by height DESC so taller buildings are drawn first (i.e. behind)
        buildings.sort((a, b) => b.height - a.height)

        this.effectData.set(item, buildings)
    }

    drawCity(item: CityItem) {
        const ctx = this.ctx
        const buildings = this.effectData.get(item)

        for (const b of buildings) {
            // Building shape
            ctx.fillStyle = b.color
            ctx.fillRect(b.x, b.y, b.width, b.height)

            // Outline for visual clarity
            ctx.strokeStyle = "rgba(0,0,0,0.4)"
            ctx.strokeRect(b.x, b.y, b.width, b.height)

            // Animated windows
            for (const w of b.windows) {
                if (item.night && item.flickerSpeed && Math.random() < item.flickerSpeed / 10000) {
                    w.visible = !w.visible
                }

                if (w.visible) {
                    ctx.fillStyle = b.windowColor
                    ctx.fillRect(b.x + w.x, b.y + w.y, w.width, w.height)
                }
            }
        }
    }

    // Utility for window generation
    private _generateWindows(buildingWidth: number, buildingHeight: number, night: boolean) {
        const windows: any[] = []
        const spacingX = 4
        const spacingY = 6
        const windowWidth = 3
        const windowHeight = 5

        const cols = Math.floor(buildingWidth / (windowWidth + spacingX))
        const rows = Math.floor(buildingHeight / (windowHeight + spacingY))

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                windows.push({
                    x: i * (windowWidth + spacingX) + spacingX / 2,
                    y: j * (windowHeight + spacingY) + spacingY / 2,
                    width: windowWidth,
                    height: windowHeight,
                    visible: night ? Math.random() > 0.5 : false
                })
            }
        }

        return windows
    }

    /// WIP RAYS ///

    initRays(item: RayItem) {
        const numRays = item.numRays ?? 12
        const rayAngle = Math.PI / numRays
        const sweepAngle = rayAngle * 2

        const midX = this.width / 2
        const midY = this.height / 2
        const diameter = Math.sqrt(this.width ** 2 + this.height ** 2)
        const radius = diameter / 2

        const data = {
            offset: 0,
            midX,
            midY,
            radius,
            numRays,
            rayAngle,
            sweepAngle
        }

        this.effectData.set(item, data)
    }

    drawRays(item: RayItem, deltaTime: number) {
        const ctx = this.ctx
        const c = this.canvas
        const d = this.effectData.get(item)
        if (!d) return

        d.offset += (item.speed / 1000) * deltaTime

        // 1. Fill background manually (do not rely on canvas.style.background)
        ctx.fillStyle = item.color_1 || "#000"
        ctx.fillRect(0, 0, c.width, c.height)

        // 2. Begin path for rays
        ctx.beginPath()
        ctx.fillStyle = item.color_2 || "#FFD700" // default gold rays for visibility

        for (let i = 0; i < d.numRays; i++) {
            const startAngle = d.sweepAngle * i + d.offset
            const endAngle = startAngle + d.rayAngle

            ctx.moveTo(d.midX, d.midY)
            ctx.arc(d.midX, d.midY, d.radius, startAngle, endAngle, false)
        }

        ctx.fill()
    }

    /// WIP FIREWORKS ///

    private fireworksParticles: any[] = []
    private gravity = 0.2
    private emitterCooldown = 0
    // FireworkItem
    initFireworks() {
        this.fireworksParticles = []
    }

    drawFireworks() {
        const ctx = this.ctx
        const canvas = this.canvas

        ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (this.emitterCooldown <= 0) {
            // Launch a new firework
            const firework = this.createRocket()
            this.fireworksParticles.push(firework)
            this.emitterCooldown = 5 + Math.random() * 10
        } else {
            this.emitterCooldown--
        }

        for (let i = this.fireworksParticles.length - 1; i >= 0; i--) {
            const p = this.fireworksParticles[i]

            // update velocity
            p.vy += p.gravity
            p.x += p.vx
            p.y += p.vy
            p.life--

            // draw
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${p.alpha})`
            ctx.fill()

            if (p.type === "rocket" && p.vy > 0) {
                this.explode(p.x, p.y, p.hue)
                this.fireworksParticles.splice(i, 1)
            } else if (p.life <= 0) {
                this.fireworksParticles.splice(i, 1)
            }
        }

        requestAnimationFrame(() => this.drawFireworks())
    }

    private createRocket() {
        return {
            x: this.canvas.width / 2 + (Math.random() - 0.5) * 100,
            y: this.canvas.height,
            vx: (Math.random() - 0.5) * 1,
            vy: -10 - Math.random() * 4,
            gravity: this.gravity,
            life: 60,
            size: 2,
            alpha: 1,
            hue: Math.floor(Math.random() * 360),
            type: "rocket"
        }
    }

    private explode(x: number, y: number, hue: number) {
        const count = 50 + Math.floor(Math.random() * 50)
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI
            const speed = Math.random() * 5
            this.fireworksParticles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: this.gravity,
                life: 60 + Math.random() * 30,
                size: 1 + Math.random(),
                alpha: 1,
                hue,
                type: "particle"
            })
        }
    }
}

// class LensFlareRender {
//     canvas: HTMLCanvasElement
//     ctx: CanvasRenderingContext2D
//     time = 0
//     center = { x: 0, y: 0 }
//     radius = 0
//     base = { x: 0, y: 0 }
//     artifacts: any[] = []

//     constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
//         this.canvas = canvas
//         this.ctx = ctx
//     }

//     setup(item: LensFlareItem) {
//         this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 }
//         this.radius = item.radius

//         this.base = {
//             x: this.canvas.width * 0.7,
//             y: this.canvas.height * 0.3
//         }

//         this.artifacts = Array.from({ length: 5 }).map((_, i) => {
//             const t = i / 5
//             return {
//                 offsetRatio: t,
//                 radius: 20 + Math.random() * 40,
//                 color: `rgba(255,255,255,${0.1 + 0.2 * Math.random()})`,
//                 pulseSpeed: Math.random() * 0.002 + 0.001,
//                 pulsePhase: Math.random() * Math.PI * 2
//             }
//         })
//     }

//     render(deltaTime: number) {
//         this.time += deltaTime

//         const t = this.time * 0.0001
//         const ellipseX = Math.cos(t) * 50
//         const ellipseY = Math.sin(t) * 25

//         // Smooth secondary motion instead of jitter
//         const smoothX = Math.sin(t * 5) * 3 // small smooth x oscillation
//         const smoothY = Math.cos(t * 7) * 2 // small smooth y oscillation

//         const flareX = this.base.x + ellipseX + smoothX
//         const flareY = this.base.y + ellipseY + smoothY

//         // Main flare glow
//         const gradient = this.ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, this.radius)
//         gradient.addColorStop(0, "rgba(255,255,200,0.5)")
//         gradient.addColorStop(1, "rgba(255,255,200,0)")

//         this.ctx.globalCompositeOperation = "screen"
//         this.ctx.fillStyle = gradient
//         this.ctx.beginPath()
//         this.ctx.arc(flareX, flareY, this.radius, 0, Math.PI * 2)
//         this.ctx.fill()

//         // Artifacts
//         for (let art of this.artifacts) {
//             const offsetX = (this.center.x - flareX) * art.offsetRatio
//             const offsetY = (this.center.y - flareY) * art.offsetRatio

//             const x = flareX + offsetX
//             const y = flareY + offsetY

//             const pulse = Math.sin(this.time * art.pulseSpeed + art.pulsePhase) * 0.3 + 1
//             const radius = art.radius * pulse

//             const g = this.ctx.createRadialGradient(x, y, 0, x, y, radius)
//             g.addColorStop(0, art.color)
//             g.addColorStop(1, "transparent")

//             this.ctx.beginPath()
//             this.ctx.fillStyle = g
//             this.ctx.arc(x, y, radius, 0, Math.PI * 2)
//             this.ctx.fill()
//         }

//         this.ctx.globalCompositeOperation = "source-over"
//     }
// }

////////

// class FogRenderer {
//     constructor({ width, height }) {
//         this.width = width
//         this.height = height
//         this.time = 0
//         this.fogBlobs = []

//         const FOG_BLOB_COUNT = 80

//         for (let i = 0; i < FOG_BLOB_COUNT; i++) {
//             // Position blobs in wider ellipse cluster but not super tight
//             let angle = Math.random() * Math.PI * 2
//             let radiusX = (this.width / 2) * (0.5 + Math.random() * 0.5)
//             let radiusY = (this.height / 2) * (0.3 + Math.random() * 0.4)

//             let x = this.width / 2 + Math.cos(angle) * radiusX
//             let y = this.height / 2 + Math.sin(angle) * radiusY

//             this.fogBlobs.push({
//                 x,
//                 y,
//                 radiusX: 80 + Math.random() * 100, // smaller blobs
//                 radiusY: 30 + Math.random() * 50,
//                 baseAlpha: 0.03 + Math.random() * 0.05, // softer opacity
//                 alpha: 0,
//                 speedX: 0.01 + Math.random() * 0.015,
//                 speedY: 0.005 + Math.random() * 0.01,
//                 rotation: Math.random() * Math.PI * 2,
//                 rotationSpeed: (Math.random() - 0.5) * 0.0003
//             })
//         }
//     }

//     update(deltaTime) {
//         this.time += deltaTime

//         for (let blob of this.fogBlobs) {
//             blob.x += blob.speedX * deltaTime * 0.1
//             blob.y += blob.speedY * deltaTime * 0.1
//             blob.rotation += blob.rotationSpeed * deltaTime * 0.1

//             // Keep blobs loosely inside canvas bounds with wrap-around
//             if (blob.x - blob.radiusX > this.width) blob.x = -blob.radiusX
//             if (blob.y - blob.radiusY > this.height) blob.y = -blob.radiusY
//             if (blob.x + blob.radiusX < 0) blob.x = this.width + blob.radiusX
//             if (blob.y + blob.radiusY < 0) blob.y = this.height + blob.radiusY

//             // Animate alpha softly to create slight pulsing fog
//             blob.alpha = blob.baseAlpha + 0.02 * Math.sin(this.time * 0.002 + blob.x * 0.01)
//         }
//     }

//     draw(ctx) {
//         // Vibrant vertical gradient background
//         const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
//         const hue = (this.time * 0.01) % 360
//         gradient.addColorStop(0, `hsl(${hue}, 80%, 50%)`)
//         gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 80%, 60%)`)

//         ctx.fillStyle = gradient
//         ctx.fillRect(0, 0, this.width, this.height)

//         ctx.globalCompositeOperation = "screen"
//         ctx.filter = "blur(15px)"

//         for (let blob of this.fogBlobs) {
//             ctx.save()
//             ctx.translate(blob.x, blob.y)
//             ctx.rotate(blob.rotation)

//             const g = ctx.createRadialGradient(0, 0, 0, 0, 0, blob.radiusX)
//             g.addColorStop(0, `rgba(255,255,255,${blob.alpha})`)
//             g.addColorStop(1, "transparent")

//             ctx.fillStyle = g
//             ctx.beginPath()
//             ctx.ellipse(0, 0, blob.radiusX, blob.radiusY, 0, 0, Math.PI * 2)
//             ctx.fill()

//             ctx.restore()
//         }

//         ctx.filter = "none"
//         ctx.globalCompositeOperation = "source-over"
//     }
// }

// const canvas = document.querySelector("canvas")
// canvas.width = 1920
// canvas.height = 1080
// const ctx = canvas.getContext("2d")

// const fog = new FogRenderer({ width: canvas.width, height: canvas.height })

// let lastTime = 0
// function animate(time = 0) {
//     const deltaTime = time - lastTime
//     lastTime = time

//     fog.update(deltaTime)
//     fog.draw(ctx)

//     requestAnimationFrame(animate)
// }

// animate()
