import type { AssetItem, AuroraItem, BloomItem, BubbleItem, CircleItem, CityItem, CycleItem, EffectDefinition, EffectFunction, EffectInit, EffectItem, EffectType, FireworkItem, FogItem, GalaxyItem, GrassItem, LensFlareItem, LightningItem, RainbowItem, RainItem, RayItem, RectangleItem, ShapeItem, Side, SnowItem, SpotlightItem, StarItem, SunItem, TriangleItem, WaveItem } from "../../../../types/Effects"
import { createNoise2D } from "./simplex-noise"

const effectTypes: readonly EffectType[] = ["circle", "rectangle", "triangle", "wave", "bubbles", "stars", "galaxy", "rain", "snow", "sun", "lens_flare", "spotlight", "aurora", "bloom", "fog", "city", "rays", "fireworks", "cycle", "grass", "lightning", "rainbow", "asset"] as const
// type EffectType = (typeof effectTypes)[number]

export class EffectRender {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    items: EffectItem[]
    running = false
    lastTime = 0
    width = 1920
    height = 1080
    doublePI = Math.PI * 2
    effectData = new WeakMap<EffectItem, any>()
    isPreview = false
    private animFrameId = 0
    // Cache for star glow gradients: key = "radius", value = CanvasGradient
    private glowCache = new Map<string, CanvasGradient>()

    TYPES: Record<string, EffectDefinition> = {}

    constructor(canvas: HTMLCanvasElement, items: EffectItem[], isPreview = false) {
        if (!canvas) throw new Error("Canvas element not found")

        // this.width = canvas.width || this.width
        // this.height = canvas.height || this.height
        canvas.width = this.width
        canvas.height = this.height

        this.canvas = canvas
        this.ctx = canvas.getContext("2d")!
        this.setItems(items)
        this.isPreview = isPreview

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
            if (!this.running) return // stop the rAF chain; stop() also calls cancelAnimationFrame
            // Clamp deltaTime to 100ms to prevent physics explosion after tab switch
            const rawDelta = this.lastTime ? time - this.lastTime : 16
            const deltaTime = Math.min(rawDelta, 100)
            this.lastTime = time

            this.frame(deltaTime / 16)
            this.animFrameId = requestAnimationFrame(loop)
        }
        this.animFrameId = requestAnimationFrame(loop)
    }

    stop() {
        this.running = false
        cancelAnimationFrame(this.animFrameId)
    }

    private setItems(items: EffectItem[]) {
        this.items = items.filter((a) => !a.hidden)
    }

    updateItems(items: EffectItem[], _noFrameChange = false) {
        const filteredNew = items.filter((a) => !a.hidden)
        const filteredOld = this.items

        for (let i = 0; i < Math.min(filteredOld.length, filteredNew.length); i++) {
            const oldItem = filteredOld[i]
            const newItem = filteredNew[i]
            if (oldItem && newItem && oldItem.type === newItem.type) {
                const data = this.effectData.get(oldItem)
                if (data !== undefined) {
                    this.effectData.set(newItem, data)
                }
            }
        }

        this.setItems(items)

        // if (noFrameChange) return
        this.frame(0, true)
        if (this.isPreview) {
            this.frame(1)
        }
    }

    frame(deltaTime: number, init = false) {
        const ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)

        for (const item of this.items) {
            const effect = this.TYPES[item.type]
            if (!effect) {
                if (init) {
                    console.warn("Unknown effect type:", item.type)
                    // console.log(this.TYPES)
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
    getOffsetX(offset: number | undefined, side: Side | null = null) {
        if (offset === undefined) offset = 0.5
        if (side === "right") return this.width * (1 - offset)
        return this.width * offset
    }
    getOffsetY(offset: number | undefined, side: Side | null = null) {
        if (offset === undefined) offset = 0.5
        if (side === "bottom") return this.height * (1 - offset)
        return this.height * offset
    }

    getRandomPosX() {
        return this.width * Math.random()
    }
    getRandomPosY() {
        return this.height * Math.random()
    }

    randomNumber(from: number, to: number) {
        return Math.random() * (to - from) + from
    }

    randomItem(array: any[]) {
        return array[(Math.random() * array.length) | 0]
        // return array[Math.floor(Math.random() * array.length)]
    }

    // 1 of -1
    positiveOrNegative() {
        return Math.random() < 0.5 ? -1 : 1
    }

    checkOffscreen(item: { x: number; y: number; length?: number; size?: number; radius?: number; speed?: number }, inverted = false) {
        const size = item.size ?? item.radius ?? item.length ?? 0
        const speed = item.speed || 0
        const offscreen = (inverted ? speed > 0 : speed < 0) ? item.y + size < 0 : item.y - size > this.height
        if (!offscreen) return false

        item.y = item.y < 0 ? this.height + size : -size
        item.x = this.getRandomPosX()
        return true
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

    private clamp01(value: number) {
        return Math.min(1, Math.max(0, value))
    }

    private createSafeRadialGradient(ctx: CanvasRenderingContext2D, x: number, y: number, innerR: number, outerR: number) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(innerR) || !Number.isFinite(outerR)) return null

        const safeInnerR = Math.max(0, innerR)
        const safeOuterR = Math.max(0, outerR)
        if (safeOuterR <= 0 || safeOuterR < safeInnerR) return null

        return {
            gradient: ctx.createRadialGradient(x, y, safeInnerR, x, y, safeOuterR),
            safeOuterR
        }
    }

    setGlow(x: number, y: number, radius: number, color = "white") {
        const safe = this.createSafeRadialGradient(this.ctx, x, y, 0, radius)
        if (!safe) return

        const gradient = safe.gradient
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, "transparent")

        this.ctx.fillStyle = gradient
    }

    /// COLOR ///

    hexToRgb(hex: string): { r: number; g: number; b: number } | null {
        // Handle both #RRGGBB and #RGB formats
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) || /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex)

        if (!result) return null

        if (result[1].length === 1) {
            // Short format #RGB
            return {
                r: parseInt(result[1] + result[1], 16),
                g: parseInt(result[2] + result[2], 16),
                b: parseInt(result[3] + result[3], 16)
            }
        } else {
            // Long format #RRGGBB
            return {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            }
        }
    }

    /// ///

    line(x: number, y: number) {
        this.ctx.lineTo(x, y)
    }

    circle(x: number, y: number, radius: number) {
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius, 0, this.doublePI)
        this.ctx.fill()
    }
    // ctx.rect(bubble.x, bubble.y, radius, radius)

    // ----------- EFFECT ITEMS ------------

    /// STARS ///

    initStars(item: StarItem) {
        const minRadius = item.size * 0.5
        const maxRadius = item.size * 2
        const speed = item.speed ?? 1

        const existing = this.effectData.get(item)
        if (existing && existing.length === item.count) {
            for (const star of existing) {
                star.radius = this.randomNumber(minRadius, maxRadius)
                star.alphaChange = speed * this.randomNumber(0.0001, 0.005) * (star.alphaChange < 0 ? -1 : 1)
            }
            return
        }

        const stars = Array.from({ length: item.count }, () => ({
            x: this.getRandomPosX(),
            y: this.getRandomPosY(),
            radius: this.randomNumber(minRadius, maxRadius),
            alpha: this.randomNumber(0.5, 1),
            alphaChange: speed * this.randomNumber(0.0001, 0.005) * this.positiveOrNegative()
        }))

        this.effectData.set(item, stars)
    }

    drawStars(item: StarItem) {
        const ctx = this.ctx
        const stars = this.effectData.get(item)
        if (!stars) return

        for (const star of stars) {
            const x = star.x
            const y = star.y
            const glowRadius = star.radius * 2

            ctx.globalAlpha = star.alpha

            // Cache radial gradient by radius to avoid creating thousands of gradient objects per second
            const cacheKey = glowRadius.toFixed(1)
            let grad = this.glowCache.get(cacheKey)
            if (!grad) {
                grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius)
                grad.addColorStop(0, "white")
                grad.addColorStop(1, "transparent")
                this.glowCache.set(cacheKey, grad)
            }
            // Translate so the cached gradient (centred at 0,0) lands on the star
            ctx.save()
            ctx.translate(x, y)
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(0, 0, glowRadius, 0, this.doublePI)
            ctx.fill()
            ctx.restore()

            // update star flashing
            star.alpha += star.alphaChange
            if (star.alpha <= 0) {
                star.alpha = 0
                star.alphaChange *= -1
            } else if (star.alpha >= 1) {
                star.alpha = 1
                star.alphaChange *= -1
            }
        }

        ctx.globalAlpha = 1
    }

    /// GALAXY ///

    initGalaxy(item: GalaxyItem) {
        const centerX = this.getOffsetX(item.x)
        const centerY = this.getOffsetY(item.y)

        item.nebula = item.nebula ?? true
        const arms = item.armCount ?? 4
        const startArms = (2 * Math.PI) / arms
        const swirl = 1 - (item.swirlStrength ?? 0.5)
        const colors = item.colors ?? ["#ffffff", "#a0c8ff", "#e0b3ff", "#ffccff"]

        const stars: any[] = []

        // SPIRAL STARS
        for (let i = 0; i < item.count * 0.8; i++) {
            const arm = i % arms
            const baseAngle = startArms * arm
            const size = Math.random() * item.size * 5
            const radius = Math.exp(0.35 * size) * 20 // (spacing * size) * tightness
            const angle = baseAngle + size + (Math.random() - 0.5) * swirl

            stars.push({
                inCore: false,
                radius,
                rotation: angle,
                // size: Math.random() * item.size + 0.5,
                size: this.randomNumber(item.size * 0.9, item.size * 1.1),
                // color: colors[Math.floor(Math.random() * colorCount)]
                color: this.randomItem(colors)
            })
        }

        // CORE STARS
        const CORE_RADIUS = item.size * 10 // pixels
        const CORE_STARS = Math.floor(item.count * 0.04)
        for (let i = 0; i < CORE_STARS; i++) {
            const radius = Math.pow(Math.random(), 1) * CORE_RADIUS
            const angle = Math.random() * 2 * Math.PI

            stars.push({
                inCore: true,
                radius,
                rotation: angle,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                size: Math.random() * item.size + 0.5,
                color: this.randomItem(colors)
            })
        }

        const nebula = Array.from({ length: 6 }, () => {
            const radius = Math.random() * 250 + 200
            const x = (Math.random() - 0.5) * 400
            const y = (Math.random() - 0.5) * 400
            const hue = 200 + Math.random() * 60
            const alpha = Math.random() * 0.08 + 0.015
            return { offsetX: x, offsetY: y, radius, color: `hsla(${hue}, 70%, 60%, ${alpha})` }
        })

        this.effectData.set(item, { stars, nebula })
    }

    drawGalaxy(item: GalaxyItem, deltaTime: number) {
        const data = this.effectData.get(item)
        if (!data) return

        const { stars, nebula } = data
        const centerX = this.getOffsetX(item.x)
        const centerY = this.getOffsetY(item.y)
        const rotationSpeed = item.rotationSpeed * 0.0002 * deltaTime

        for (const star of stars) {
            let x
            let y

            if (!star.inCore) {
                star.rotation += rotationSpeed

                x = centerX + Math.cos(star.rotation) * star.radius
                y = centerY + Math.sin(star.rotation) * star.radius
            } else {
                // x = star.x
                // y = star.y
                x = centerX + star.radius * Math.cos(star.rotation)
                y = centerY + star.radius * Math.sin(star.rotation)
            }

            const fade = star.inCore ? 1 : Math.max(0.3, 1 - star.radius / 500)

            this.ctx.globalAlpha = fade
            this.setGlow(x, y, star.size * (star.inCore ? 3 : 2), star.color)
            this.circle(x, y, star.size)
        }

        this.ctx.globalAlpha = 1

        if (item.nebula) {
            // Update nebula positions in-place to avoid allocating 6 new objects every frame
            for (const a of nebula) {
                a.x = centerX + a.offsetX
                a.y = centerY + a.offsetY
            }
            this.drawStaticNebula(nebula)
        }
    }

    drawStaticNebula(clouds: { x: number; y: number; radius: number; color: string }[]) {
        for (const cloud of clouds) {
            this.setGlow(cloud.x, cloud.y, cloud.radius, cloud.color)
            this.circle(cloud.x, cloud.y, cloud.radius)
        }
    }

    /// RAIN ///

    initRain(item: RainItem) {
        if (!item.color) item.color = "rgba(173,216,230,0.5)"

        const existing = this.effectData.get(item)
        if (existing && existing.length === item.count) {
            for (const drop of existing) {
                drop.speed = item.speed * this.randomNumber(0.5, 1)
                drop.length = item.length * this.randomNumber(0.5, 1)
            }
            return
        }

        const drops = Array.from({ length: item.count }, () => ({
            x: this.getRandomPosX(),
            y: this.getRandomPosY(),
            speed: item.speed * this.randomNumber(0.5, 1),
            length: item.length * this.randomNumber(0.5, 1)
        }))

        this.effectData.set(item, drops)
    }

    drawRain(item: Required<RainItem>, deltaTime: number) {
        const ctx = this.ctx
        const drops = this.effectData.get(item) || []

        ctx.lineCap = "round"
        ctx.strokeStyle = item.color
        ctx.lineWidth = item.width

        // Batch all drops into a single path + one stroke call instead of per-drop stroke
        ctx.beginPath()
        for (const drop of drops) {
            ctx.moveTo(drop.x, drop.y)
            ctx.lineTo(drop.x, drop.y + drop.length)

            // move
            drop.y += drop.speed * deltaTime

            this.checkOffscreen(drop)
        }
        ctx.stroke()
    }

    /// SNOW ///

    initSnow(item: SnowItem) {
        if (!item.color) item.color = "#ffffff"
        const drift = item.drift ?? 0.5

        const existing = this.effectData.get(item)
        if (existing && existing.length === item.count) {
            for (const flake of existing) {
                flake.size = item.size * this.randomNumber(0.5, 1.5)
                flake.speed = item.speed * 0.5 * this.randomNumber(0.5, 1.5)
                flake.drift = drift * this.randomNumber(-0.5, 0.5)
            }
            return
        }

        const snowflakes = Array.from({ length: item.count }, () => ({
            x: this.getRandomPosX(),
            y: this.getRandomPosY(),
            size: item.size * this.randomNumber(0.5, 1.5),
            speed: item.speed * 0.5 * this.randomNumber(0.5, 1.5),
            drift: drift * this.randomNumber(-0.5, 0.5), // horizontal sway
            phase: Math.random() * this.doublePI
        }))

        this.effectData.set(item, snowflakes)
    }

    drawSnow(item: Required<SnowItem>, deltaTime: number) {
        const ctx = this.ctx
        const snowflakes = this.effectData.get(item) || []
        const time = performance.now() * 0.001

        ctx.fillStyle = item.color

        for (const flake of snowflakes) {
            // sway motion
            const sway = Math.sin(time + flake.phase) * flake.drift * 2

            this.circle(flake.x + sway, flake.y, flake.size)

            // move
            flake.y += flake.speed * deltaTime
            flake.x += flake.drift * 0.5

            this.checkOffscreen(flake)
        }
    }

    /// BUBBLES ///

    initBubbles(item: BubbleItem) {
        const existing = this.effectData.get(item)
        if (existing && existing.length === item.count) {
            for (const bubble of existing) {
                bubble.radius = Math.random() * item.size + (item.maxSizeVariation ?? 10)
                bubble.pulseSpeed = Math.random() * ((item.pulseSpeed || 1) * 0.0002) + 0.0001
                bubble.speed = item.speed * this.randomNumber(0.2, 0.7)
            }
            return
        }

        const bubbles = Array.from({ length: item.count }, () => {
            return {
                x: this.getRandomPosX(),
                y: this.getRandomPosY(),
                radius: Math.random() * item.size + (item.maxSizeVariation ?? 10),
                pulseSpeed: Math.random() * ((item.pulseSpeed || 1) * 0.0002) + 0.0001,
                pulsePhase: Math.random() * this.doublePI,
                speed: item.speed * this.randomNumber(0.2, 0.7),
                drift: this.randomNumber(-0.5, 0.5),
                color: `hsla(${Math.random() * 360}, 100%, 70%, 0.2)`
                // WIP color range? / specific color with different brightness
            }
        })

        this.effectData.set(item, bubbles)
    }

    drawBubbles(item: BubbleItem, deltaTime: number) {
        const ctx = this.ctx
        const bubbles = this.effectData.get(item) || []
        const time = performance.now()

        for (const bubble of bubbles) {
            const pulse = Math.sin(time * bubble.pulseSpeed + bubble.pulsePhase) * 0.3 + 1
            const radius = bubble.radius * pulse

            // ctx.save()
            ctx.fillStyle = bubble.color
            // ctx.shadowBlur = 10
            // ctx.shadowColor = bubble.color
            this.circle(bubble.x, bubble.y, radius)
            // ctx.restore()

            // move
            bubble.y -= bubble.speed * deltaTime
            bubble.x += bubble.drift

            this.checkOffscreen(bubble, true)
        }
    }

    /// GRASS ///

    initGrass(item: GrassItem) {
        const baseHeight = item.height ?? 60
        const heightVar = 1
        const windStrength = item.windStrength ?? 0.5
        const windSpeed = item.speed ?? 1

        const existing = this.effectData.get(item)
        if (existing && existing.blades && existing.blades.length === item.count) {
            for (const blade of existing.blades) {
                blade.height = baseHeight * (1 + (Math.random() - 0.5) * heightVar)
                blade.segments = Math.max(3, Math.floor(blade.height / 15))
                blade.maxSway = windStrength * (blade.height / baseHeight) * 15
                blade.windSpeed = windSpeed * (0.8 + Math.random() * 0.4)
            }
            return
        }

        const blades = Array.from({ length: item.count }, (_, i) => {
            const x = (this.width / item.count) * i + Math.random() * (this.width / item.count)
            const height = baseHeight * (1 + (Math.random() - 0.5) * heightVar)
            const segments = Math.max(3, Math.floor(height / 15)) // More segments for taller grass

            return {
                x,
                height,
                segments,
                windOffset: Math.random() * Math.PI * 2, // Random phase for natural movement
                maxSway: windStrength * (height / baseHeight) * 15, // Taller grass sways more
                windSpeed: windSpeed * (0.8 + Math.random() * 0.4) // Slight speed variation
            }
        })

        this.effectData.set(item, { blades, time: existing ? existing.time : 0 })
    }

    drawGrass(item: GrassItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        const { blades } = data
        data.time += deltaTime * 0.01

        const baseColor = item.color ?? "#4a7c59"
        ctx.strokeStyle = baseColor
        ctx.lineJoin = "round"

        const baseY = this.getOffsetY(item.offset ?? 1)
        const baseWidth = (item.width ?? 2) * 2

        // Compute gradient-related values once per frame, not once per blade.
        // All blades share the same baseColor so darkerColor is stable across blades.
        const rgb = this.hexToRgb(baseColor) || { r: 74, g: 124, b: 89 }
        const darkerColor = `rgb(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 20)})`

        for (const blade of blades) {
            const windSway = Math.sin(data.time * blade.windSpeed + blade.windOffset) * blade.maxSway
            const windSway2 = Math.sin(data.time * blade.windSpeed * 1.3 + blade.windOffset) * blade.maxSway * 0.3

            // Create gradient per-blade (blade heights differ), but reuse the pre-computed colors
            const gradient = ctx.createLinearGradient(blade.x, baseY, blade.x, baseY - blade.height)
            gradient.addColorStop(0, darkerColor) // Darker at bottom
            gradient.addColorStop(1, baseColor)   // Original color at top
            ctx.fillStyle = gradient

            // Draw the triangular grass blade using a path.
            // Points are computed inline to avoid allocating a temporary array per blade.
            ctx.beginPath()

            // Left side going up
            ctx.moveTo(blade.x - baseWidth / 2, baseY)
            for (let i = 1; i <= blade.segments; i++) {
                const progress = i / blade.segments
                const y = baseY - blade.height * progress
                const swayAmount = windSway * progress * progress + windSway2 * progress
                const x = blade.x + swayAmount + Math.sin(progress * Math.PI) * 1.5
                const halfW = baseWidth * (1 - progress * 0.95) / 2
                ctx.lineTo(x - halfW, y)
            }

            // Tip
            {
                const swayAmount = windSway + windSway2
                const tipX = blade.x + swayAmount + Math.sin(Math.PI) * 1.5
                ctx.lineTo(tipX, baseY - blade.height - 1)
            }

            // Right side going down
            for (let i = blade.segments - 1; i >= 1; i--) {
                const progress = i / blade.segments
                const y = baseY - blade.height * progress
                const swayAmount = windSway * progress * progress + windSway2 * progress
                const x = blade.x + swayAmount + Math.sin(progress * Math.PI) * 1.5
                const halfW = baseWidth * (1 - progress * 0.95) / 2
                ctx.lineTo(x + halfW, y)
            }

            ctx.lineTo(blade.x + baseWidth / 2, baseY)
            ctx.closePath()
            ctx.fill()

            // Subtle stroke for definition
            ctx.lineWidth = 0.5
            ctx.globalAlpha = 0.7
            ctx.stroke()
            ctx.globalAlpha = 1
        }
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
        const ctx = this.ctx
        // Hoist the constant factor outside the tight loop
        const twoPIoverWL = (2 * Math.PI) / item.wavelength
        if (item.side === "left" || item.side === "right") {
            const baseX = this.getOffsetX(item.offset, item.side)
            for (let y = 0; y <= this.height; y++) {
                ctx.lineTo(baseX + item.amplitude * Math.sin(y * twoPIoverWL + item.phase), y)
            }
        } else {
            const baseY = this.getOffsetY(item.offset, item.side)
            for (let x = 0; x <= this.width; x++) {
                ctx.lineTo(x, baseY + item.amplitude * Math.sin(x * twoPIoverWL + item.phase))
            }
        }
    }

    /// SHAPES ///

    createCanvasGradient(ctx: CanvasRenderingContext2D, gradientStr: string, width: number, height: number) {
        const splitStops = (str: string): string[] => {
            const parts: string[] = []
            let buffer = ""
            let depth = 0

            for (const char of str) {
                if (char === "(") depth++
                if (char === ")") depth--
                if (char === "," && depth === 0) {
                    parts.push(buffer.trim())
                    buffer = ""
                } else {
                    buffer += char
                }
            }
            if (buffer) parts.push(buffer.trim())
            return parts
        }

        if (gradientStr.startsWith("linear-gradient")) {
            const match = gradientStr.match(/linear-gradient\(([^,]+),\s*(.+)\)/)
            if (!match) return { gradient: gradientStr, plainColor: gradientStr }

            const angleStr = match[1].trim()
            const stopsStr = match[2]

            const angleDeg = parseFloat(angleStr)
            const angleRad = ((angleDeg - 90) * Math.PI) / 180

            const halfW = width / 2
            const halfH = height / 2
            const x0 = halfW - Math.cos(angleRad) * halfW
            const y0 = halfH - Math.sin(angleRad) * halfH
            const x1 = halfW + Math.cos(angleRad) * halfW
            const y1 = halfH + Math.sin(angleRad) * halfH

            const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
            // console.log(x0, y0, x1, y1, halfW, halfH, angleRad)

            const stops = splitStops(stopsStr)

            let plainColor = stops[0]
            const firstStopMatch = plainColor.match(/^(.+?)\s+([\d.]+)%$/)
            if (firstStopMatch) plainColor = firstStopMatch[1].trim()

            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i]
                const parts = stop.match(/^(.+?)\s+([\d.]+)%$/)
                if (parts) {
                    gradient.addColorStop(parseFloat(parts[2]) / 100, parts[1].trim())
                } else {
                    gradient.addColorStop(i / (stops.length - 1), stop)
                }
            }

            return { gradient, plainColor }
        }

        if (gradientStr.startsWith("radial-gradient")) {
            const match = gradientStr.match(/radial-gradient\(([^,]+),\s*(.+)\)/)
            if (!match) return { gradient: gradientStr, plainColor: gradientStr }

            // const shape = match[1].trim();
            const stopsStr = match[2]
            const r = Math.min(width, height) / 2

            const safe = this.createSafeRadialGradient(ctx, 0, 0, 0, r)
            if (!safe) return { gradient: gradientStr, plainColor: gradientStr }

            const gradient = safe.gradient

            const stops = splitStops(stopsStr)

            let plainColor = stops[stops.length - 1]
            const firstStopMatch = plainColor.match(/^(.+?)\s+([\d.]+)%$/)
            if (firstStopMatch) plainColor = firstStopMatch[1].trim()

            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i]
                const parts = stop.match(/^(.+?)\s+([\d.]+)%$/)
                if (parts) {
                    gradient.addColorStop(parseFloat(parts[2]) / 100, parts[1].trim())
                } else {
                    gradient.addColorStop(i / (stops.length - 1), stop)
                }
            }

            return { gradient, plainColor }
        }

        return { gradient: gradientStr, plainColor: gradientStr }
    }

    drawRotatingShape(item: ShapeItem, deltaTime: number, drawShapeFn: (canvasCtx: CanvasRenderingContext2D, shapeItem: any) => void) {
        const ctx = this.ctx
        const centerX = this.getOffsetX(item.x)
        const centerY = this.getOffsetY(item.y)

        item.angle += ((item.speed ?? 0) / 10) * deltaTime

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(item.angle)

        const color = item.color
        if (typeof color === "string" && (color.startsWith("linear-gradient") || color.startsWith("radial-gradient"))) {
            const width = (item as any).size ?? (item as any).width ?? (item as any).radius
            const height = (item as any).size ?? (item as any).height ?? (item as any).radius
            const { gradient, plainColor } = this.createCanvasGradient(ctx, color, width, height)

            ctx.strokeStyle = gradient
            ctx.fillStyle = gradient
            ctx.shadowColor = plainColor
        } else {
            ctx.strokeStyle = color
            ctx.fillStyle = color
            ctx.shadowColor = color
        }

        ctx.lineWidth = item.thickness
        ctx.shadowBlur = item.shadow ?? 0

        drawShapeFn(ctx, item)

        if (item.hollow) ctx.stroke()
        else ctx.fill()

        ctx.restore()
    }

    initCircle(item: CircleItem) {
        item.angle = 0
    }

    drawCircle(item: CircleItem, deltaTime: number) {
        this.drawRotatingShape(item, deltaTime, this.drawCircleShape.bind(this))
    }

    drawCircleShape(ctx: CanvasRenderingContext2D, item: CircleItem) {
        ctx.beginPath()
        ctx.arc(0, 0, item.radius / 2, 0, Math.PI * (item.gap ?? 2))
    }

    initRectangle(item: RectangleItem) {
        item.angle = 0
    }

    drawRectangle(item: RectangleItem, deltaTime: number) {
        this.drawRotatingShape(item, deltaTime, this.drawRectangleShape.bind(this))
    }

    drawRectangleShape(ctx: CanvasRenderingContext2D, item: RectangleItem) {
        ctx.beginPath()
        ctx.rect(-item.width / 2, -item.height / 2, item.width, item.height)
    }

    initTriangle(item: TriangleItem) {
        item.angle = 0
    }

    drawTriangle(item: TriangleItem, deltaTime: number) {
        this.drawRotatingShape(item, deltaTime, this.drawTriangleShape.bind(this))
    }

    drawTriangleShape(ctx: CanvasRenderingContext2D, item: TriangleItem) {
        const halfSize = (item.size ?? 10) / 2
        ctx.beginPath()
        ctx.moveTo(0, -halfSize)
        ctx.lineTo(halfSize, halfSize)
        ctx.lineTo(-halfSize, halfSize)
        ctx.closePath()
    }

    /// SUN ///

    sunOrbitPointX = 0.5
    sunOrbitPointY = 0.8
    initSun(item: SunItem) {
        const scale = item.radius / 80
        item.rayCount ??= Math.round(20 * scale)
        item.rayLength ??= 200 * scale
        item.rayWidth ??= 5 * scale
        item.color ??= "rgba(255, 223, 0, 0.15)"
        item.speed ??= 0

        // orbiting
        if (item.speed) {
            const dx = (item.x || 0) - this.sunOrbitPointX
            const dy = (item.y || 0) - this.sunOrbitPointY

            item.orbitRadius = Math.sqrt(dx * dx + dy * dy)
            item.orbitAngle = Math.atan2(dy, dx) + Math.PI // start at "night"
        }

        this.effectData.set(item, { cycleTime: 0 })
    }

    drawSun(item: Required<SunItem>, deltaTime: number) {
        const ctx = this.ctx

        let x: number
        let y: number
        if (item.speed) {
            const data = this.effectData.get(item)
            if (!data) return

            data.cycleTime = this.getCycleTime(item.speed, data.cycleTime, deltaTime)
            const time = data.cycleTime / this.cycleLength // 0 → 1
            const angle = item.orbitAngle + time * 2 * Math.PI
            // item.orbitAngle += item.speed / 100

            const orbitRadius = item.orbitRadius // * this.width // use width to keep it circular

            x = this.getOffsetX(this.sunOrbitPointX + orbitRadius * Math.cos(angle))
            y = this.getOffsetY(this.sunOrbitPointY + orbitRadius * Math.sin(angle))
        } else {
            x = this.getOffsetX(item.x)
            y = this.getOffsetY(item.y)
        }

        ctx.save()

        this.drawSunGlow(x, y, item.radius)
        this.drawSunCore(x, y, item.radius)
        this.drawSunRays(x, y, item, item.color)

        ctx.restore()

        this.drawEnhancedLensFlare(x, y, item.radius * 3, "rgba(255, 255, 255, 0.6)")
    }

    drawSunGlow(x: number, y: number, radius: number) {
        // Outer glow
        this.fillRadialGradient(x, y, radius * 1.5, radius * 4, [
            ["rgba(255, 255, 255, 0.15)", 0],
            ["transparent", 1]
        ])

        // Mid glow
        this.fillRadialGradient(x, y, radius, radius * 2.5, [
            ["rgba(255, 255, 255, 0.5)", 0],
            ["rgba(255, 255, 120, 0.5)", 0.3],
            ["transparent", 1]
        ])
    }

    drawSunCore(x: number, y: number, radius: number) {
        const ctx = this.ctx
        ctx.shadowColor = "rgba(255, 255, 255, 0.9)"
        ctx.shadowBlur = radius * 1.5
        ctx.fillStyle = "rgba(255, 255, 255, 1)"
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.8, 0, this.doublePI)
        ctx.fill()
        ctx.shadowBlur = 0
    }

    drawSunRays(x: number, y: number, item: SunItem, color: string) {
        const { rayCount, rayLength, rayWidth, radius } = item
        const waveAmp = rayWidth * 0.3
        const waveFreq = 5

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * this.doublePI
            const rayX = x + Math.cos(angle) * radius * 0.8
            const rayY = y + Math.sin(angle) * radius * 0.8

            this.drawWavyRay(rayX, rayY, rayLength, waveAmp, waveFreq, "rgba(255, 255, 255, 0.35)", color)

            this.fillRadialGradient(rayX, rayY, 0, rayLength, [
                ["rgba(255, 255, 255, 0.35)", 0],
                ["rgba(255, 251, 237, 0.25)", 0.2],
                ["transparent", 1]
            ])
        }
    }

    drawWavyRay(x: number, y: number, baseRadius: number, waveAmplitude: number, waveFrequency: number, colorStart: string, colorEnd: string) {
        const ctx = this.ctx
        const segments = 60
        const angleStep = this.doublePI / segments

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

        this.fillRadialGradient(x, y, 0, baseRadius + waveAmplitude, [
            [colorStart, 0],
            [colorEnd, 0.2],
            ["transparent", 1]
        ])
    }

    fillRadialGradient(x: number, y: number, innerR: number, outerR: number, stops: [string, number][]) {
        const ctx = this.ctx
        const safe = this.createSafeRadialGradient(ctx, x, y, innerR, outerR)
        if (!safe) return

        const grad = safe.gradient
        for (const [color, stop] of stops) {
            if (!Number.isFinite(stop)) continue
            grad.addColorStop(this.clamp01(stop), color)
        }
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, safe.safeOuterR, 0, this.doublePI)
        ctx.fill()
    }

    drawEnhancedLensFlare(x: number, y: number, radius: number, _baseColor: string) {
        const ctx = this.ctx
        ctx.save()

        this.fillRadialGradient(x, y, 0, radius, [
            ["rgba(255, 255, 255, 0.7)", 0],
            ["rgba(255, 255, 255, 0.1)", 0.7],
            ["transparent", 1]
        ])

        const ghostCount = 5
        for (let i = 1; i <= ghostCount; i++) {
            const offsetX = x + i * radius * 0.6 * (i % 2 === 0 ? 1 : -1)
            const offsetY = y + i * radius * 0.2 * (i % 2 === 0 ? -1 : 1)
            const ghostRadius = radius * 0.2 * (1 - i / ghostCount)

            this.fillRadialGradient(offsetX, offsetY, 0, ghostRadius, [
                [`rgba(255, 255, 255, ${0.3 * (1 - i / ghostCount)})`, 0],
                ["transparent", 1]
            ])
        }

        ctx.restore()
    }

    /// LENS FLARE ///

    private setColorStops(gradient: CanvasGradient, stops: [number, string][]) {
        for (const [offset, color] of stops) {
            gradient.addColorStop(offset, color)
        }
    }

    initLensFlare(item: LensFlareItem) {
        const flareDiscNum = item.flareDiscNum ?? 8
        const size = item.size ?? 100
        const discs: any[] = []

        const existing = this.effectData.get(item)
        if (existing && existing.discs && existing.discs.length === flareDiscNum + 1) {
            for (let i = 0; i < existing.discs.length; i++) {
                const j = i - flareDiscNum / 2
                existing.discs[i].dia = Math.pow(Math.abs(10 * (j / flareDiscNum)), 2) * 3 + (size + 10) + (Math.random() * size - size)
            }
            return
        }

        for (let i = 0; i <= flareDiscNum; i++) {
            const j = i - flareDiscNum / 2
            const offsetRatio = (j / flareDiscNum) * 2

            const dia = Math.pow(Math.abs(10 * (j / flareDiscNum)), 2) * 3 + (size + 10) + (Math.random() * size - size)
            const hue = Math.round(Math.random() * 360)

            discs.push({ offsetRatio, dia, hue })
        }

        this.effectData.set(item, { discs })
    }

    drawLensFlare(item: LensFlareItem) {
        const ctx = this.ctx

        const centerX = this.width / 2
        const centerY = this.height / 2
        const x = this.getOffsetX(item.x)
        const y = this.getOffsetY(item.y)

        const dist = 1 - Math.hypot(x - centerX, y - centerY) / Math.hypot(centerX, centerY)

        const data = this.effectData.get(item)
        if (!data?.discs) return

        ctx.globalCompositeOperation = "screen"

        for (let i = 0; i < data.discs.length; i++) {
            const discData = data.discs[i]
            const offset = discData.offsetRatio

            const discX = (centerX - x) * offset + centerX
            const discY = (centerY - y) * offset + centerY

            const safe = this.createSafeRadialGradient(ctx, discX, discY, 0, discData.dia)
            if (!safe) continue

            const grad = safe.gradient
            this.setColorStops(grad, [
                [0, `hsla(${discData.hue},100%,90%,${0 * dist})`],
                [0.9, `hsla(${discData.hue},100%,90%,${0.15 * dist})`],
                [1, `hsla(${discData.hue},100%,90%,0)`]
            ])

            ctx.beginPath()
            ctx.fillStyle = grad
            ctx.arc(discX, discY, safe.safeOuterR, 0, this.doublePI)
            ctx.fill()

            if (i === 0) {
                this.drawFlareCore({ x: discX, y: discY, dia: discData.dia, hue: discData.hue }, dist)
            }
        }
    }

    private drawFlareCore(disc: { x: number; y: number; dia: number; hue: number }, dist: number) {
        const ctx = this.ctx

        // Glow
        const safeGrad1 = this.createSafeRadialGradient(ctx, disc.x, disc.y, 0, disc.dia * 2)
        if (!safeGrad1) return
        const grad1 = safeGrad1.gradient
        this.setColorStops(grad1, [
            [0, `rgba(200,220,255,${0.2 * dist})`],
            [1, "rgba(200,220,255,0)"]
        ])
        ctx.beginPath()
        ctx.fillStyle = grad1
        ctx.arc(disc.x, disc.y, safeGrad1.safeOuterR, 0, this.doublePI)
        ctx.fill()

        // Spectral disc
        const ease = (a: number, b: number, t: number) => (b - a) * (1 - Math.pow(t - 1, 2)) + a
        const spec = ease(disc.dia / 5, disc.dia / 2.5, dist)
        const sdist = 1 - Math.pow(Math.abs(dist - 1), 3)
        const safeGrad2 = this.createSafeRadialGradient(ctx, disc.x, disc.y, 0, spec)
        if (!safeGrad2) return
        const grad2 = safeGrad2.gradient
        this.setColorStops(grad2, [
            [0.2 * sdist, `rgba(255,255,255,${sdist})`],
            [0.6, `hsla(${disc.hue},100%,75%,${0.3 * sdist})`],
            [1, `hsla(${disc.hue},100%,40%,0)`]
        ])
        ctx.beginPath()
        ctx.fillStyle = grad2
        ctx.arc(disc.x, disc.y, disc.dia / 2.5, 0, this.doublePI)
        ctx.fill()

        // Horizontal streak
        const grad3 = ctx.createLinearGradient(disc.x - disc.dia * 1.5, disc.y, disc.x + disc.dia * 1.5, disc.y)
        this.setColorStops(grad3, [
            [0, "rgba(240,250,255,0)"],
            [0.5, `rgba(240,250,255,${0.4 * dist ** 3})`],
            [1, "rgba(240,250,255,0)"]
        ])
        ctx.fillStyle = grad3
        ctx.fillRect(disc.x - disc.dia * 1.5, disc.y - 2, disc.dia * 3, 4)

        // Vertical streak
        const grad4 = ctx.createLinearGradient(disc.x, disc.y - disc.dia * 1.5, disc.x, disc.y + disc.dia * 1.5)
        this.setColorStops(grad4, [
            [0, "rgba(240,250,255,0)"],
            [0.5, `rgba(240,250,255,${0.4 * dist ** 3})`],
            [1, "rgba(240,250,255,0)"]
        ])
        ctx.fillStyle = grad4
        ctx.fillRect(disc.x - 2, disc.y - disc.dia * 1.5, 4, disc.dia * 3)
    }

    /// LIGHTNING ///

    initLightning(item: LightningItem) {
        const existing = this.effectData.get(item)
        this.effectData.set(item, {
            nextStrike: existing ? existing.nextStrike : performance.now() + this.randomNumber(1000 / item.frequency, 2000 / item.frequency),
            flashAlpha: existing ? existing.flashAlpha : 0,
            strikePath: existing ? existing.strikePath : []
        })
    }

    drawLightning(item: LightningItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        const currentTime = performance.now()

        // Trigger lightning strike
        if (currentTime >= data.nextStrike) {
            const startX = this.getRandomPosX()
            const segments = 10
            const segmentHeight = this.height / segments
            const maxOffset = 50

            const path = [{ x: startX, y: 0 }]
            for (let i = 1; i <= segments; i++) {
                path.push({
                    x: path[i - 1].x + this.randomNumber(-maxOffset, maxOffset),
                    y: segmentHeight * i
                })
            }

            data.strikePath = path
            data.flashAlpha = 1
            data.flashDecay = 0.1
            data.nextStrike = currentTime + this.randomNumber(1000 / item.frequency, 2000 / item.frequency)
        }

        // Draw lightning strike
        if (data.flashAlpha > 0) {
            ctx.strokeStyle = item.color || "#ffffff"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(data.strikePath[0].x, data.strikePath[0].y)
            for (const point of data.strikePath) {
                ctx.lineTo(point.x, point.y)
            }
            ctx.stroke()

            // Draw flash
            ctx.fillStyle = `rgba(255, 255, 255, ${data.flashAlpha})`
            ctx.fillRect(0, 0, this.width, this.height)

            // Fade the flash
            data.flashAlpha -= data.flashDecay * deltaTime
            if (data.flashAlpha < 0) data.flashAlpha = 0
        }
    }

    /// RAINBOW ///

    drawRainbow(item: RainbowItem) {
        const ctx = this.ctx
        const centerX = this.getOffsetX(0.5)
        const centerY = this.getOffsetY(Math.min(item.offset ?? 0.2, 0.86) + 1.42)
        const outerRadius = this.height * 1.5
        const bandWidth = item.bandWidth ?? 30

        ctx.save()
        // Add a gentle blur to blend the colors realistically, mirroring atmospheric dispersion
        ctx.filter = "blur(8px)"

        // --- SECONDARY BOW (DOUBLE RAINBOW) ---
        // A secondary rainbow is concentric, wider (1.25x), with reversed colors and highly muted opacity (~18% of primary)
        const secondaryOuterRadius = outerRadius * 1.25
        const secondaryInnerRadius = secondaryOuterRadius - 7 * bandWidth
        const secondaryRStart = secondaryInnerRadius - 1.5 * bandWidth
        const secondaryREnd = secondaryOuterRadius + 1.5 * bandWidth
        const secondaryTotalSpan = secondaryREnd - secondaryRStart

        const secondaryGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            Math.max(0, secondaryRStart),
            centerX,
            centerY,
            Math.max(0, secondaryREnd)
        )

        // Double rainbow colors are reversed (Red on the inside, Violet on the outside) and very subtle
        secondaryGrad.addColorStop(0.0, "rgba(255, 0, 0, 0)") // inner edge fade
        secondaryGrad.addColorStop(0.15, "rgba(255, 0, 0, 0.08)") // red
        secondaryGrad.addColorStop(0.25, "rgba(255, 127, 0, 0.07)") // orange
        secondaryGrad.addColorStop(0.35, "rgba(255, 255, 0, 0.07)") // yellow
        secondaryGrad.addColorStop(0.45, "rgba(0, 200, 0, 0.06)") // green
        secondaryGrad.addColorStop(0.55, "rgba(0, 0, 255, 0.06)") // blue
        secondaryGrad.addColorStop(0.65, "rgba(75, 0, 130, 0.07)") // indigo
        secondaryGrad.addColorStop(0.75, "rgba(148, 0, 211, 0.07)") // violet
        secondaryGrad.addColorStop(0.85, "rgba(148, 0, 211, 0.01)") // outer edge start fade
        secondaryGrad.addColorStop(1.0, "rgba(148, 0, 211, 0)") // outer edge fade

        ctx.beginPath()
        ctx.strokeStyle = secondaryGrad
        ctx.lineWidth = secondaryTotalSpan
        ctx.arc(centerX, centerY, secondaryRStart + secondaryTotalSpan / 2, Math.PI, 2 * Math.PI, false)
        ctx.stroke()

        // --- PRIMARY BOW ---
        const innerRadius = outerRadius - 7 * bandWidth
        const rStart = innerRadius - 1.5 * bandWidth
        const rEnd = outerRadius + 1.5 * bandWidth
        const totalSpan = rEnd - rStart

        const primaryGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            Math.max(0, rStart),
            centerX,
            centerY,
            Math.max(0, rEnd)
        )

        // Primary rainbow colors: Violet on the inside, Red on the outside, with soft atmospheric fading
        primaryGrad.addColorStop(0.0, "rgba(148, 0, 211, 0)") // inner edge fade
        primaryGrad.addColorStop(0.15, "rgba(148, 0, 211, 0.35)") // violet
        primaryGrad.addColorStop(0.25, "rgba(75, 0, 130, 0.35)") // indigo
        primaryGrad.addColorStop(0.35, "rgba(0, 0, 255, 0.30)") // blue
        primaryGrad.addColorStop(0.45, "rgba(0, 200, 0, 0.30)") // green
        primaryGrad.addColorStop(0.55, "rgba(255, 255, 0, 0.35)") // yellow
        primaryGrad.addColorStop(0.65, "rgba(255, 127, 0, 0.35)") // orange
        primaryGrad.addColorStop(0.75, "rgba(255, 0, 0, 0.40)") // red
        primaryGrad.addColorStop(0.85, "rgba(255, 0, 0, 0.10)") // outer edge start fade
        primaryGrad.addColorStop(1.0, "rgba(255, 0, 0, 0)") // outer edge fade

        ctx.beginPath()
        ctx.strokeStyle = primaryGrad
        ctx.lineWidth = totalSpan
        ctx.arc(centerX, centerY, rStart + totalSpan / 2, Math.PI, 2 * Math.PI, false)
        ctx.stroke()

        ctx.restore()
    }

    /// SPOT LIGHT ///

    private colorWithOpacity(baseColor: string, opacity: number): string {
        if (baseColor.startsWith("#")) {
            const hex = baseColor.replace("#", "")
            const bigint = parseInt(hex, 16)
            const r = hex.length === 3 ? ((bigint >> 8) & 0xf) * 17 : (bigint >> 16) & 255
            const g = hex.length === 3 ? ((bigint >> 4) & 0xf) * 17 : (bigint >> 8) & 255
            const b = hex.length === 3 ? (bigint & 0xf) * 17 : bigint & 255
            return `rgba(${r},${g},${b},${opacity})`
        } else {
            // Match either rgb(61,153,112) OR rgb(61 153 112 / 0.6)
            const match = baseColor.match(/rgba?\(([^)]+)\)/)
            if (match) {
                const parts = match[1].trim()

                // modern syntax with spaces
                if (parts.includes("/")) {
                    const [rgbPart] = parts.split("/")
                    const [r, g, b] = rgbPart
                        .trim()
                        .split(/\s+/)
                        .map((n: string) => parseFloat(n))
                    return `rgba(${r},${g},${b},${opacity})`
                } else {
                    const [r, g, b] = parts.split(",").map((n: string) => parseFloat(n.trim()))
                    return `rgba(${r},${g},${b},${opacity})`
                }
            }
        }

        return baseColor
    }

    initSpotlight(item: SpotlightItem) {
        const existing = this.effectData.get(item)
        const swayPhase = existing && !isNaN(existing.swayPhase) ? existing.swayPhase : Math.random() * this.doublePI
        this.effectData.set(item, { swayPhase })
    }

    drawSpotlight(item: SpotlightItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        const swaySpeed = isNaN(item.swaySpeed) || item.swaySpeed === undefined || item.swaySpeed === null ? 0 : item.swaySpeed
        const swayAmplitude = isNaN(item.swayAmplitude) || item.swayAmplitude === undefined || item.swayAmplitude === null ? 0 : item.swayAmplitude
        const length = isNaN(item.length) || item.length === undefined || item.length === null ? 2000 : item.length
        const baseWidth = isNaN(item.baseWidth) || item.baseWidth === undefined || item.baseWidth === null ? 1000 : item.baseWidth

        if (length <= 0 || baseWidth <= 0) return

        if (data.swayPhase === undefined || data.swayPhase === null || isNaN(data.swayPhase)) {
            data.swayPhase = Math.random() * this.doublePI
        }

        data.swayPhase += swaySpeed * deltaTime * 0.016
        // pendulum sway
        const swayAngle = Math.sin(data.swayPhase) * swayAmplitude
        // motor turn
        // const t = (data.swayPhase / Math.PI) % 2
        // const triangular = t < 1 ? t : 2 - t
        // const swayAngle = (triangular - 0.5) * 2 * item.swayAmplitude

        const baseX = this.getOffsetX(item.x)
        const baseY = this.getOffsetY(item.y)
        const baseHalf = baseWidth / 2

        ctx.save()
        ctx.translate(baseX, baseY)
        ctx.rotate(swayAngle)

        const baseColor = item.color

        const safeGradient = this.createSafeRadialGradient(ctx, 0, 0, 0, length * 0.9)
        if (!safeGradient) {
            ctx.restore()
            return
        }
        const gradient = safeGradient.gradient
        this.setColorStops(gradient, [
            [0, this.colorWithOpacity(baseColor, 0.3)],
            [0.5, this.colorWithOpacity(baseColor, 0.15)],
            [1, this.colorWithOpacity(baseColor, 0)]
        ])
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-baseHalf, length)
        ctx.lineTo(baseHalf, length)
        ctx.closePath()
        ctx.fill()

        const safeGlowGradient = this.createSafeRadialGradient(ctx, 0, 0, 0, 200)
        if (!safeGlowGradient) {
            ctx.restore()
            return
        }

        const glowGradient = safeGlowGradient.gradient
        this.setColorStops(glowGradient, [
            [0, this.colorWithOpacity(baseColor, 0.3)],
            [0.8, this.colorWithOpacity(baseColor, 0)]
        ])
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(0, 0, length * 0.25, 0, this.doublePI)
        ctx.fill()

        ctx.restore()
    }

    /// AURORA ///

    initAurora(item: AuroraItem) {
        const bandCount = item.bandCount
        const maxHeight = this.height * 0.25 // top 25%
        const bands: any[] = []

        const existing = this.effectData.get(item)
        if (existing && existing.bands && existing.bands.length === bandCount) {
            existing.bufferScale = 0.25
            for (let i = 0; i < bandCount; i++) {
                existing.bands[i].amplitude = item.amplitude * (0.8 + Math.random() * 0.4)
                existing.bands[i].wavelength = item.wavelength * (0.8 + Math.random() * 0.4)
                existing.bands[i].speed = item.speed * (0.5 + Math.random())
                existing.bands[i].colorStops = item.colorStops ?? ["#00ffcc", "#00ffb7", "#00ff88"]
                existing.bands[i].opacity = item.opacity ?? 0.25
            }
            return
        }

        for (let i = 0; i < bandCount; i++) {
            bands.push({
                phase: Math.random() * this.doublePI,
                bottomPhase: Math.random() * this.doublePI, // phase offset for bottom wave
                offsetY: (maxHeight / bandCount) * i + ((Math.random() * maxHeight) / bandCount) * 0.4, // closer, some jitter
                amplitude: item.amplitude * (0.8 + Math.random() * 0.4),
                wavelength: item.wavelength * (0.8 + Math.random() * 0.4),
                speed: item.speed * (0.5 + Math.random()),
                colorStops: item.colorStops ?? ["#00ffcc", "#00ffb7", "#00ff88"], // ["#ff00cc", "#00ff88", "#6600ff"]
                opacity: item.opacity ?? 0.25,
                noise2D: createNoise2D()
            })
        }

        const bufferScale = 0.25
        const bufferCanvas = document.createElement("canvas")
        bufferCanvas.width = this.width * bufferScale
        bufferCanvas.height = this.height * bufferScale
        const bufferCtx = bufferCanvas.getContext("2d")!

        this.effectData.set(item, {
            bands,
            bufferCanvas,
            bufferCtx,
            bufferScale
        })
    }

    drawAurora(item: AuroraItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data || !data.bands) return

        const { bands, bufferCanvas, bufferCtx, bufferScale } = data

        // Clear the offscreen buffer on every frame
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height)

        bufferCtx.save()
        bufferCtx.globalCompositeOperation = "lighter"

        for (let i = 0; i < bands.length; i++) {
            const band = bands[i]
            if (this.running) {
                band.phase += band.speed * 0.01 * deltaTime
                band.bottomPhase += band.speed * 0.01 * deltaTime * 0.8 // slightly different speed for bottom wave
            }

            // Calculate depth-based scaling to simulate realistic atmospheric distance layers
            // Furthest bands (lower index) are dimmer and have narrower curtains
            const depthProgress = (i + 1) / bands.length // scales from e.g. 0.33 to 1.0
            const depthOpacity = 0.65 + 0.35 * depthProgress
            const depthWidthScale = 0.75 + 0.25 * depthProgress

            const offsetY = band.offsetY + this.getOffsetY(item.offset ?? 0.2) - band.amplitude * 2.5

            // Determine vertical boundaries of this band for gradient mapping
            const minY = offsetY - band.amplitude * 1.5
            const maxY = offsetY + band.amplitude * 3.5

            // Create a vertical altitude-dependent color gradient for realistic ionization layers:
            // 1. Extreme altitudes: ionization fades out completely into transparent deep purple/red.
            // 2. Mid-upper altitudes: transitions to the user's primary selected color at low-to-medium opacity.
            // 3. Low altitudes: sharp, highly ionized oxygen emission (user's final color) at full opacity.
            const gradient = bufferCtx.createLinearGradient(0, minY * bufferScale, 0, maxY * bufferScale)

            const colors = band.colorStops
            const numStops = colors.length

            // Realistic vertical color stops:
            // Top edge (extreme altitude) fades out into a faint violet/purple ionization glow
            gradient.addColorStop(0.0, "rgba(147, 51, 234, 0)")
            gradient.addColorStop(0.08, "rgba(147, 51, 234, 0.35)")

            // Middle bodies: distribute user's color stops organically with high opacity towards the bottom
            for (let j = 0; j < numStops; j++) {
                const stopPos = 0.15 + 0.7 * (j / Math.max(1, numStops - 1))
                // Middle has robust opacity (0.7 to 1.0)
                const opacity = 0.7 + 0.3 * (j / Math.max(1, numStops - 1))
                gradient.addColorStop(stopPos, this.colorWithOpacity(colors[j], opacity * depthOpacity))
            }

            // Bottom edge (lowest altitude): sharp, highly intense emission (final user color) at full opacity
            gradient.addColorStop(1.0, this.colorWithOpacity(colors[numStops - 1], 1.0 * depthOpacity))

            // Draw shimmering vertical light curtains onto offscreen canvas using the vertical gradient
            bufferCtx.strokeStyle = gradient

            // On a 480px wide canvas, stepping by 4 gives 120 lines. Very smooth and performant.
            const step = 4
            // Hoist performance.now() outside the column loop — the shimmer value is the same
            // for all columns within a single band in a given frame.
            const shimmerTime = performance.now() * 0.003 * band.speed
            const baseOpacity = band.opacity ?? 0.25
            for (let x = 0; x <= bufferCanvas.width; x += step) {
                const originalX = x / bufferScale

                const topY = (offsetY + band.amplitude * band.noise2D(originalX / band.wavelength, band.phase)) * bufferScale
                const bottomY = (offsetY + band.amplitude * 2.5 + band.amplitude * band.noise2D(originalX / band.wavelength, band.bottomPhase)) * bufferScale

                // 1. Slow, majestic horizontal curtain streaks
                const rayNoise = band.noise2D(originalX / 40, band.phase * 1.2)

                // 2. High-frequency micro-shimmer
                const microShimmer = band.noise2D(originalX / 15, shimmerTime) * 0.15

                // Apply baseline vibrancy booster of 1.8x to prevent washed-out curtains
                const rayOpacity = Math.max(0, baseOpacity * 1.8 * (0.35 + 0.65 * rayNoise + microShimmer))

                bufferCtx.globalAlpha = rayOpacity
                // Modulate ray width organically, scaling down for offscreen and applying depth-based perspective
                const rawWidth = 5 + 3 * band.noise2D(originalX / 20, band.phase * 0.8)
                bufferCtx.lineWidth = rawWidth * bufferScale * depthWidthScale

                bufferCtx.beginPath()
                bufferCtx.moveTo(x, topY)
                bufferCtx.lineTo(x, bottomY)
                bufferCtx.stroke()
            }
        }

        bufferCtx.restore()

        // Draw the scaled and blurred buffer onto the main screen
        ctx.save()
        ctx.globalCompositeOperation = "lighter"

        // Applying the blur filter to a single scaled drawImage is extremely fast and hardware-accelerated.
        // We use blur(8px) for an incredibly soft, realistic atmospheric aurora glow.
        ctx.filter = "blur(8px)"
        ctx.drawImage(bufferCanvas, 0, 0, this.width, this.height)
        ctx.restore()
    }

    /// BLOOM ///

    initBloom(item: BloomItem) {
        const { width, height } = this
        const blobCount = item.blobCount ?? 10
        const speed = item.speed ?? 1

        const existing = this.effectData.get(item)
        if (existing && existing.blobs && existing.blobs.length === blobCount) {
            existing.blurAmount = item.blurAmount ?? 50
            for (const blob of existing.blobs) {
                blob.speedX = (Math.random() - 0.5) * 1.5 * speed
                blob.speedY = (Math.random() - 0.5) * 1.3 * speed
            }
            return
        }

        const blobs = Array.from({ length: blobCount }, () => ({
            x: width / 2 + (Math.random() - 0.5) * width * 0.8,
            y: height / 2 + (Math.random() - 0.5) * height * 0.8,
            radiusX: 150 + Math.random() * 250,
            radiusY: 80 + Math.random() * 150,
            color: Math.random() * 360,
            alpha: 0.15 + Math.random() * 0.25,
            rotation: Math.random() * this.doublePI,
            rotationSpeed: (Math.random() - 0.5) * 0.00015,
            speedX: (Math.random() - 0.5) * 1.5 * speed,
            speedY: (Math.random() - 0.5) * 1.3 * speed
        }))

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
        const w = this.width
        const h = this.height

        for (const blob of blobs) {
            blob.rotation += blob.rotationSpeed * deltaTime
            blob.x += blob.speedX * deltaTime
            blob.y += blob.speedY * deltaTime

            // wrap around screen
            if (blob.x < -blob.radiusX) blob.x = w + blob.radiusX
            else if (blob.x > w + blob.radiusX) blob.x = -blob.radiusX
            if (blob.y < -blob.radiusY) blob.y = h + blob.radiusY
            else if (blob.y > h + blob.radiusY) blob.y = -blob.radiusY
        }

        // render to buffer
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height)
        bufferCtx.save()
        bufferCtx.scale(bufferScale, bufferScale)
        bufferCtx.globalCompositeOperation = "screen"

        for (const { x, y, radiusX, radiusY, rotation, color, alpha } of blobs) {
            bufferCtx.save()
            bufferCtx.translate(x, y)
            bufferCtx.rotate(rotation)

            const safe = this.createSafeRadialGradient(bufferCtx, 0, 0, 0, radiusX)
            if (!safe) {
                bufferCtx.restore()
                continue
            }

            const grad = safe.gradient
            grad.addColorStop(0, `hsla(${color}, 90%, 70%, ${alpha})`)
            grad.addColorStop(1, "transparent")

            bufferCtx.fillStyle = grad
            bufferCtx.beginPath()
            bufferCtx.ellipse(0, 0, radiusX, radiusY, 0, 0, this.doublePI)
            bufferCtx.fill()
            bufferCtx.restore()
        }

        bufferCtx.restore()

        // draw blurred buffer to screen
        ctx.save()
        ctx.filter = `blur(${blurAmount}px)`
        ctx.globalCompositeOperation = "screen"
        ctx.drawImage(bufferCanvas, 0, 0, w, h)
        ctx.restore()
    }

    /// FOG ///

    initFog(item: FogItem) {
        const spread = item.spread ?? 300
        const baseOpacity = item.opacity ?? 0.08
        const size = item.size
        const speed = item.speed

        const existing = this.effectData.get(item)
        if (existing && existing.length === item.count) {
            for (const cloud of existing) {
                cloud.offsetY = (Math.random() - 0.5) * spread
                cloud.radius = size * (0.8 + Math.random() * 0.4)
                cloud.opacity = baseOpacity * (0.8 + Math.random() * 0.4)
                cloud.speed = -speed * (0.6 + Math.random() * 0.4)
            }
            return
        }

        const clouds = Array.from({ length: item.count }, () => ({
            x: Math.random() * this.width,
            offsetY: (Math.random() - 0.5) * spread,
            radius: size * (0.8 + Math.random() * 0.4),
            opacity: baseOpacity * (0.8 + Math.random() * 0.4),
            speed: -speed * (0.6 + Math.random() * 0.4),
            drift: (Math.random() - 0.5) * 0.1
        }))

        this.effectData.set(item, clouds)
    }

    drawFog(item: FogItem, deltaTime: number) {
        const clouds = this.effectData.get(item)
        if (!clouds) return

        const ctx = this.ctx
        const blur = item.blur ?? 40
        const offsetY = this.getOffsetY(item.offset ?? 0.3)
        const width = this.width

        ctx.save()
        ctx.globalCompositeOperation = "source-over"

        for (const cloud of clouds) {
            const img = this.getBlurredCloud(cloud.radius, blur, cloud.opacity)
            const drawX = cloud.x - img.width / 2
            const drawY = offsetY + cloud.offsetY - img.height / 2
            ctx.drawImage(img, drawX, drawY)

            // move
            cloud.x += cloud.speed * deltaTime
            cloud.offsetY += cloud.drift * deltaTime

            // horizontal wrapping
            const r = cloud.radius
            if (cloud.x > width + r) cloud.x = -r
            else if (cloud.x < -r) cloud.x = width + r
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
        ctx.arc(size / 2, size / 2, radius, 0, this.doublePI)
        ctx.fill()

        this.cloudCache.set(key, canvas)
        return canvas
    }

    /// CITY ///

    initCity(item: CityItem) {
        const minWidth = (item.width ?? 40) - 10
        const maxWidth = (item.width ?? 40) + 30
        const minHeight = (item.height ?? 200) - 100
        const maxHeight = (item.height ?? 200) + 200

        const buildings = Array.from({ length: item.count }, () => {
            const width = Math.random() * (maxWidth - minWidth) + minWidth
            const height = Math.random() * (maxHeight - minHeight) + minHeight
            const x = Math.random() * (this.width - width)

            return {
                x,
                y: height,
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
        const buildings = this.effectData.get(item) || []

        for (const b of buildings) {
            const y = (1 - (item.offset ?? 0)) * this.height - b.y

            // Building shape
            ctx.fillStyle = b.color
            ctx.fillRect(b.x, y, b.width, b.height)

            // Outline for visual clarity
            ctx.strokeStyle = "rgba(0,0,0,0.4)"
            ctx.strokeRect(b.x, y, b.width, b.height)

            // Animated windows
            for (const w of b.windows) {
                if (item.night && item.flickerSpeed && Math.random() < item.flickerSpeed / 10000) {
                    w.visible = !w.visible
                }

                if (w.visible) {
                    ctx.fillStyle = b.windowColor
                    ctx.fillRect(b.x + w.x, y + w.y, w.width, w.height)
                }
            }
        }
    }

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

    /// RAYS ///

    initRays(item: RayItem) {
        const numRays = item.numRays ?? 8
        const rayAngle = Math.PI / numRays
        const sweepAngle = rayAngle * 2

        const midX = this.width / 2
        const midY = this.height / 2
        const diameter = Math.sqrt(this.width ** 2 + this.height ** 2)
        const radius = diameter / 2

        const existing = this.effectData.get(item)
        const offset = existing ? existing.offset : 0

        const data = {
            offset,
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
        const data = this.effectData.get(item)
        if (!data) return

        data.offset += ((item.speed ?? 1) / 1000) * deltaTime

        ctx.fillStyle = item.color_1 || "#000"
        ctx.fillRect(0, 0, this.width, this.height)

        ctx.beginPath()
        ctx.fillStyle = item.color_2 || "#FFF"

        for (let i = 0; i < data.numRays; i++) {
            const startAngle = data.sweepAngle * i + data.offset
            const endAngle = startAngle + data.rayAngle

            ctx.moveTo(data.midX, data.midY)
            ctx.arc(data.midX, data.midY, data.radius, startAngle, endAngle, false)
        }

        ctx.fill()
    }

    /// FIREWORKS ///

    initFireworks(item: FireworkItem) {
        const existing = this.effectData.get(item)
        this.effectData.set(item, {
            particles: existing ? existing.particles : [],
            cooldown: existing ? existing.cooldown : 0
        })
    }

    drawFireworks(item: FireworkItem, deltaTime: number) {
        const data = this.effectData.get(item)
        if (!data) return

        const ctx = this.ctx
        const particles = data.particles
        const count = item.count ?? 5

        // Emit new firework rocket
        if (data.cooldown <= 0) {
            particles.push(this.createRocket(item, deltaTime))
            data.cooldown = 100 - count + Math.random() * 10
        } else {
            data.cooldown--
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]

            // Physics update
            p.vy += p.gravity
            p.x += p.vx
            p.y += p.vy
            p.life--

            // Draw particle — use cached hue string to avoid template-string allocation per particle per frame
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, this.doublePI)
            ctx.fillStyle = `${p.hueStr}${p.alpha.toFixed(2)})`
            ctx.fill()

            // Rocket logic
            if (p.type === "rocket" && (p.vy > 0 || p.life <= 0)) {
                this.explode(item, deltaTime, p.x, p.y, p.hue, particles)
                particles.splice(i, 1)
            } else if (p.life <= 0) {
                particles.splice(i, 1)
            }
        }
    }

    private createRocket(item: FireworkItem, deltaTime: number) {
        const gravity = (item.speed ?? 1) * 0.2 * deltaTime
        const heightOffset = this.height * (item.offset ?? 0.7) + (Math.random() - 0.5) * 250
        const vy = -Math.sqrt(2 * gravity * heightOffset)

        const hue = Math.floor(Math.random() * 360)
        return {
            x: this.width / 2 + (Math.random() - 0.5) * (this.width * 0.8),
            y: this.height,
            vx: Math.random() - 0.5,
            vy,
            gravity,
            life: item.speed < 1 ? 60 / (item.speed * deltaTime) : 60,
            size: (item.size ?? 1) * 1.8,
            alpha: 1,
            hue,
            hueStr: `hsla(${hue}, 100%, 50%, `, // cached prefix — append alpha + ")" at draw time
            type: "rocket"
        }
    }

    private explode(item: FireworkItem, deltaTime: number, x: number, y: number, hue: number, particles: any[]) {
        const count = 50 + Math.floor(Math.random() * 50)
        const gravity = (item.speed ?? 1) * 0.02 * deltaTime
        const baseSize = item.size ?? 1
        const baseSpeed = (item.speed ?? 0.5) * deltaTime * 5

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * this.doublePI
            const speed = baseSpeed * Math.random()
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity,
                life: 60 + Math.random() * 30,
                size: baseSize + Math.random(),
                alpha: 1,
                hue,
                hueStr: `hsla(${hue}, 100%, 50%, `, // cached prefix — append alpha + ")" at draw time
                type: "particle"
            })
        }
    }

    // SKY GRADIENT

    initCycle(item: CycleItem) {
        let phases = item.phases ?? [
            { stop: 0.18, color: "rgba(0, 0, 0, 0)" }, // Night
            { stop: 0.25, color: "#f0a428" }, // Sunrise
            { stop: 0.3, color: "#87ceeb" }, // Day
            { stop: 0.7, color: "#87ceeb" }, // Day
            { stop: 0.8, color: "#f57c00" }, // Sunset
            { stop: 0.88, color: "rgba(0, 0, 0, 0)" } // Night
        ]

        // there must be color values at stop 0 & 1
        if (phases[0]?.stop > 0) phases = [{ stop: 0, color: phases[0].color }, ...phases]
        if (phases[phases.length - 1]?.stop < 1) phases.push({ stop: 1, color: phases[phases.length - 1].color })

        const existing = this.effectData.get(item)
        const cycleTime = existing ? existing.cycleTime : 0

        this.effectData.set(item, {
            cycleTime,
            phases
        })
    }

    cycleLength = 24 // seconds
    getCycleTime(speed: number, cycleTime: number, deltaTime: number) {
        // Update time (normalized to seconds with a ~60 FPS scale factor)
        speed ??= 1
        return (cycleTime + deltaTime * speed * 0.016) % this.cycleLength

        // const time = data.cycleTime / cycleLength // 0 → 1
        // const isNight = time > 0.9 || time < 0.1
        // this.nightTime = time > 0.5 ? (time - 0.5) * 2 : 1 - time * 2
    }

    drawCycle(item: CycleItem, deltaTime: number) {
        const data = this.effectData.get(item)
        if (!data) return

        const ctx = this.ctx

        data.cycleTime = this.getCycleTime(item.speed, data.cycleTime, deltaTime)
        const time = data.cycleTime / this.cycleLength // 0 → 1

        const phases = data.phases

        // Find active phase range
        const idx = phases.findIndex((p, i) => i < phases.length - 1 && time >= p.stop && time < phases[i + 1].stop)

        const a = phases[idx]
        const b = phases[idx + 1] ?? a
        const t = (time - a.stop) / (b.stop - a.stop || 1)

        const color = this.lerpColor(a.color, b.color, t)
        const dark = this.darkenColor(color, 0.5)

        // Sky gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, dark)

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, this.width, this.height)
    }

    darkenColor(color: string, factor: number): string {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!match) return color

        const [_, r, g, b, a] = match.map(Number)
        return `rgba(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)}, ${a ?? 1})`
    }

    lerpColor(color1: string, color2: string, t: number): string {
        const parse = (c: string) => {
            if (c.startsWith("#")) {
                let hex = c.slice(1)
                if (hex.length === 3)
                    hex = hex
                        .split("")
                        .map((ch) => ch + ch)
                        .join("")
                const num = parseInt(hex, 16)
                return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 }
            }
            const match = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
            return {
                r: Number(match?.[1] ?? 0),
                g: Number(match?.[2] ?? 0),
                b: Number(match?.[3] ?? 0),
                a: Number(match?.[4] ?? 1)
            }
        }

        const a = parse(color1)
        const b = parse(color2)
        return `rgba(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)}, ${(a.a + (b.a - a.a) * t).toFixed(3)})`
    }

    /// ASSET ///

    loadedImages = {}
    initAsset(item: AssetItem) {
        const imagePath = item.path.includes("/") ? item.path : `./assets/effects/${item.path}.webp`

        const image = new Image()
        image.onload = imageLoaded

        image.src = imagePath
        this.loadedImages[item.path] = image

        const ctx = this.ctx
        const x = this.getOffsetX(item.x)
        const y = this.getOffsetY(item.y)
        function imageLoaded() {
            const width = image.width * 0.3 * item.size
            const height = image.height * 0.3 * item.size
            ctx.drawImage(image, x - width * 0.5, y - height * 0.5, width, height)
        }
    }

    drawAsset(item: AssetItem) {
        const image = this.loadedImages[item.path]
        if (!image) return

        const ctx = this.ctx
        const x = this.getOffsetX(item.x)
        const y = this.getOffsetY(item.y)
        const width = image.width * 0.3 * item.size
        const height = image.height * 0.3 * item.size
        ctx.drawImage(image, x - width * 0.5, y - height * 0.5, width, height)
    }
}
