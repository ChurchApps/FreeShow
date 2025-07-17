import type {
    AssetItem,
    AuroraItem,
    BloomItem,
    BubbleItem,
    CircleItem,
    CityItem,
    CycleItem,
    EffectDefinition,
    EffectFunction,
    EffectInit,
    EffectItem,
    EffectType,
    FireworkItem,
    FogItem,
    GalaxyItem,
    GrassItem,
    LensFlareItem,
    LightningItem,
    RainbowItem,
    RainItem,
    RayItem,
    RectangleItem,
    ShapeItem,
    Side,
    SnowItem,
    SpotlightItem,
    StarItem,
    SunItem,
    TriangleItem,
    WaveItem
} from "../../../../types/Effects"
import { createNoise2D } from "./simplex-noise"

const effectTypes: readonly EffectType[] = [
    "circle",
    "rectangle",
    "triangle",
    "wave",
    "bubbles",
    "stars",
    "galaxy",
    "rain",
    "snow",
    "sun",
    "lens_flare",
    "spotlight",
    "aurora",
    "bloom",
    "fog",
    "city",
    "rays",
    "fireworks",
    "cycle",
    "grass",
    "lightning",
    "rainbow",
    "asset"
] as const
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
            const deltaTime = this.lastTime ? time - this.lastTime : 1
            this.lastTime = time

            if (this.running) this.frame(deltaTime / 16) // 1
            requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
    }

    stop() {
        this.running = false
    }

    private setItems(items: EffectItem[]) {
        this.items = items.filter((a) => !a.hidden)
    }

    updateItems(items: EffectItem[], _noFrameChange = false) {
        this.setItems(items)

        // if (noFrameChange) return
        this.frame(0, true)
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

    setGlow(x: number, y: number, radius: number, color = "white") {
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius)
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

            this.setGlow(x, y, glowRadius)
            this.circle(x, y, glowRadius)

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
            const positionedNebula = nebula.map((a) => ({ ...a, x: centerX + a.offsetX, y: centerY + a.offsetY }))
            this.drawStaticNebula(positionedNebula)
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

        for (const drop of drops) {
            ctx.beginPath()
            ctx.moveTo(drop.x, drop.y)
            ctx.lineTo(drop.x, drop.y + drop.length)
            ctx.stroke()

            // move
            drop.y += drop.speed * deltaTime

            this.checkOffscreen(drop)
        }
    }

    /// SNOW ///

    initSnow(item: SnowItem) {
        if (!item.color) item.color = "#ffffff"
        const drift = item.drift ?? 0.5

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

        this.effectData.set(item, { blades, time: 0 })
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

        for (const blade of blades) {
            const windSway = Math.sin(data.time * blade.windSpeed + blade.windOffset) * blade.maxSway
            const windSway2 = Math.sin(data.time * blade.windSpeed * 1.3 + blade.windOffset) * blade.maxSway * 0.3

            const baseWidth = (item.width ?? 2) * 2 // Base width at bottom
            const points: any[] = []

            // Generate points for the triangular grass blade
            for (let i = 0; i <= blade.segments; i++) {
                const progress = i / blade.segments
                const y = baseY - blade.height * progress

                // Apply wind effect - more sway at the top
                const swayAmount = windSway * progress * progress + windSway2 * progress
                const x = blade.x + swayAmount

                // Add slight curve for more natural look
                const curve = Math.sin(progress * Math.PI) * 1.5

                // Calculate width at this point (triangular taper)
                const widthAtPoint = baseWidth * (1 - progress * 0.95) // Tapers to 5% at top

                points.push({
                    x: x + curve,
                    y,
                    width: widthAtPoint
                })
            }

            // Create gradient from dark bottom to lighter top
            const gradient = ctx.createLinearGradient(blade.x, baseY, blade.x, baseY - blade.height)

            // Parse the base color and create darker version for bottom
            const rgb = this.hexToRgb(baseColor) || { r: 74, g: 124, b: 89 }
            const darkerColor = `rgb(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 20)})`

            gradient.addColorStop(0, darkerColor) // Darker at bottom
            gradient.addColorStop(1, baseColor) // Original color at top

            ctx.fillStyle = gradient

            // Draw the triangular grass blade using a path
            ctx.beginPath()

            // Start at bottom left
            ctx.moveTo(blade.x - baseWidth / 2, baseY)

            // Draw left side going up
            for (let i = 1; i < points.length; i++) {
                const point = points[i]
                ctx.lineTo(point.x - point.width / 2, point.y)
            }

            // Draw tip
            const tip = points[points.length - 1]
            ctx.lineTo(tip.x, tip.y - 1)

            // Draw right side going down
            for (let i = points.length - 2; i >= 1; i--) {
                const point = points[i]
                ctx.lineTo(point.x + point.width / 2, point.y)
            }

            // Close at bottom right
            ctx.lineTo(blade.x + baseWidth / 2, baseY)
            ctx.closePath()

            ctx.fill()

            // Optional: Add a subtle stroke for definition
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

            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r)

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
        const grad = ctx.createRadialGradient(x, y, innerR, x, y, outerR)
        for (const [color, stop] of stops) grad.addColorStop(stop, color)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, outerR, 0, this.doublePI)
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

            const grad = ctx.createRadialGradient(discX, discY, 0, discX, discY, discData.dia)
            this.setColorStops(grad, [
                [0, `hsla(${discData.hue},100%,90%,${0 * dist})`],
                [0.9, `hsla(${discData.hue},100%,90%,${0.15 * dist})`],
                [1, `hsla(${discData.hue},100%,90%,0)`]
            ])

            ctx.beginPath()
            ctx.fillStyle = grad
            ctx.arc(discX, discY, discData.dia, 0, this.doublePI)
            ctx.fill()

            if (i === 0) {
                this.drawFlareCore({ x: discX, y: discY, dia: discData.dia, hue: discData.hue }, dist)
            }
        }
    }

    private drawFlareCore(disc: { x: number; y: number; dia: number; hue: number }, dist: number) {
        const ctx = this.ctx

        // Glow
        const grad1 = ctx.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, disc.dia * 2)
        this.setColorStops(grad1, [
            [0, `rgba(200,220,255,${0.2 * dist})`],
            [1, "rgba(200,220,255,0)"]
        ])
        ctx.beginPath()
        ctx.fillStyle = grad1
        ctx.arc(disc.x, disc.y, disc.dia * 2, 0, this.doublePI)
        ctx.fill()

        // Spectral disc
        const ease = (a: number, b: number, t: number) => (b - a) * (1 - Math.pow(t - 1, 2)) + a
        const spec = ease(disc.dia / 5, disc.dia / 2.5, dist)
        const sdist = 1 - Math.pow(Math.abs(dist - 1), 3)
        const grad2 = ctx.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, spec)
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
        this.effectData.set(item, {
            nextStrike: performance.now() + this.randomNumber(1000 / item.frequency, 2000 / item.frequency),
            flashAlpha: 0,
            strikePath: []
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

        const rainbowColors = ["rgba(255, 0, 0, 0.4)", "rgba(255, 165, 0, 0.4)", "rgba(255, 255, 0, 0.4)", "rgba(0, 128, 0, 0.4)", "rgba(0, 0, 255, 0.4)", "rgba(75, 0, 130, 0.4)", "rgba(238, 130, 238, 0.4)"]

        for (let i = 0; i < rainbowColors.length; i++) {
            ctx.beginPath()
            ctx.strokeStyle = rainbowColors[i]
            ctx.lineWidth = bandWidth
            ctx.arc(centerX, centerY, outerRadius - i * bandWidth, Math.PI, 2 * Math.PI, false)
            ctx.stroke()
        }
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
            const match = baseColor.match(/rgba?\(([^)]+)\)/)
            if (match) {
                const [r, g, b] = match[1].split(",").map((n: string) => parseFloat(n.trim()))
                return `rgba(${r},${g},${b},${opacity})`
            }
        }
        return baseColor
    }

    initSpotlight(item: SpotlightItem) {
        this.effectData.set(item, { swayPhase: Math.random() * this.doublePI })
    }

    drawSpotlight(item: SpotlightItem, deltaTime: number) {
        const ctx = this.ctx
        const data = this.effectData.get(item)
        if (!data) return

        data.swayPhase += item.swaySpeed * deltaTime * 0.016
        // pendulum sway
        const swayAngle = Math.sin(data.swayPhase) * item.swayAmplitude
        // motor turn
        // const t = (data.swayPhase / Math.PI) % 2
        // const triangular = t < 1 ? t : 2 - t
        // const swayAngle = (triangular - 0.5) * 2 * item.swayAmplitude

        const baseX = this.getOffsetX(item.x)
        const baseY = this.getOffsetY(item.y)
        const length = item.length
        const baseHalf = item.baseWidth / 2

        ctx.save()
        ctx.translate(baseX, baseY)
        ctx.rotate(swayAngle)

        const baseColor = item.color

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, length * 0.9)
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

        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 200)
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

        this.effectData.set(item, bands)
    }

    drawAurora(item: AuroraItem, deltaTime: number) {
        const ctx = this.ctx
        const bands = this.effectData.get(item) || []

        ctx.save()
        ctx.globalCompositeOperation = "lighter"
        ctx.filter = "blur(8px)"

        for (const band of bands) {
            if (this.running) {
                band.phase += band.speed * 0.01 * deltaTime
                band.bottomPhase += band.speed * 0.01 * deltaTime * 0.8 // slightly different speed for bottom wave
            }

            // Horizontal gradient from left (0) to right (canvas.width)
            const gradient = ctx.createLinearGradient(0, 0, this.width, 0)
            for (let i = 0; i < band.colorStops.length; i++) {
                gradient.addColorStop(i / (band.colorStops.length - 1), band.colorStops[i])
            }

            ctx.fillStyle = gradient
            ctx.globalAlpha = band.opacity

            ctx.beginPath()

            const offsetY = band.offsetY + this.getOffsetY(item.offset ?? 0.2) - band.amplitude * 2.5

            // Top edge wave (left -> right)
            ctx.moveTo(0, offsetY)
            for (let x = 0; x <= this.width; x += 2) {
                const y = offsetY + band.amplitude * band.noise2D(x / band.wavelength, band.phase)
                ctx.lineTo(x, y)
            }

            // Bottom edge wave (right -> left), related but randomized with different phase
            for (let x = this.width; x >= 0; x -= 2) {
                const y = offsetY + band.amplitude * 2 + band.amplitude * band.noise2D(x / band.wavelength, band.bottomPhase)
                ctx.lineTo(x, y)
            }

            ctx.closePath()
            ctx.fill()
        }

        ctx.restore()
    }

    /// BLOOM ///

    initBloom(item: BloomItem) {
        const { width, height } = this
        const blobCount = item.blobCount ?? 10
        const speed = item.speed ?? 1

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

            const grad = bufferCtx.createRadialGradient(0, 0, 0, 0, 0, radiusX)
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
        this.effectData.set(item, {
            particles: [],
            cooldown: 0
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

            // Draw particle
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, this.doublePI)
            ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${p.alpha})`
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

        return {
            x: this.width / 2 + (Math.random() - 0.5) * (this.width * 0.8),
            y: this.height,
            vx: Math.random() - 0.5,
            vy,
            gravity,
            life: item.speed < 1 ? 60 / (item.speed * deltaTime) : 60,
            size: (item.size ?? 1) * 1.8,
            alpha: 1,
            hue: Math.floor(Math.random() * 360),
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

        this.effectData.set(item, {
            cycleTime: 0,
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
