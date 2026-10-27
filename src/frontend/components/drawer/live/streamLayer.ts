import { writable } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import { receive, send } from "../../../utils/request"

// Hands a full-screen stream to the capture worker to composite instead of the page drawing it.

/** outputs whose stream the capture worker composites; their background paints transparent */
export const compositedOutputs = writable<{ [id: string]: boolean }>({})

const LISTENER_ID = "STREAM_LAYER"
const listeners = new Set<(id: string, active: boolean) => void>()
const outputLayers = new Map<string, Set<StreamLayer>>()
const tickListeners = new Set<(id: string) => void>()
let receiving = false

function listen() {
    if (receiving) return
    receiving = true
    receive(
        OUTPUT,
        {
            STREAM_LAYER: (data: { id: string; active: boolean }) => {
                compositedOutputs.update((a) => ({ ...a, [data.id]: !!data.active }))
                listeners.forEach((l) => l(data.id, !!data.active))
            },
            STREAM_TICK: (data: { id: string }) => tickListeners.forEach((l) => l(data.id))
        },
        LISTENER_ID
    )
}

/** true when the composite matches the page: full cover, frame aspect, no ancestor effect but translation */
function drawnPlainly(canvas: HTMLElement, frameWidth: number, frameHeight: number) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height || !frameWidth || !frameHeight) return false
    if (Math.abs(rect.width / rect.height - frameWidth / frameHeight) > 0.01) return false
    const slack = 1
    if (rect.left > slack || rect.top > slack || rect.right < window.innerWidth - slack || rect.bottom < window.innerHeight - slack) return false

    let node: HTMLElement | null = canvas
    for (let depth = 0; node && depth < 12; depth++) {
        const style = getComputedStyle(node)
        if (style.filter !== "none" || style.backdropFilter !== "none") return false
        if (style.opacity !== "1") return false
        if (style.mixBlendMode !== "normal") return false
        // only a pure translation keeps the pixels in place
        const t = style.transform
        if (t !== "none") {
            const m = t.match(/^matrix\(([-0-9.e, ]+)\)$/)
            if (!m) return false
            const n = m[1].split(",").map((v) => parseFloat(v))
            if (n.length !== 6 || Math.abs(n[0] - 1) > 0.001 || Math.abs(n[1]) > 0.001 || Math.abs(n[2]) > 0.001 || Math.abs(n[3] - 1) > 0.001) return false
        }
        node = node.parentElement
    }
    return true
}

/** whether the worker composites this output's stream; `update` runs per frame */
export class StreamLayer {
    private outputId = ""
    private sourceId = ""
    private canvas: HTMLElement | null = null
    private wanted = false
    private active = false
    // the composite continues until the page draws a fresh frame
    private releasing = false
    private checkedAt = 0
    private lastWidth = 0
    private lastHeight = 0
    private timer: ReturnType<typeof setInterval> | null = null
    private onChange: () => void
    private listener = (id: string, active: boolean) => {
        if (id !== this.outputId) return
        // ignore a composite this layer did not request
        active = active && this.wanted
        if (!active) this.releasing = false
        this.active = active
        this.onChange()
        this.driveDamage(active)
        // no frames arrive while composited, so poll for a transition or filter
        if (active && !this.timer) this.timer = setInterval(() => this.check(), 250)
        else if (!active && this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    constructor(outputId: string, sourceId: string, onChange: () => void) {
        this.outputId = outputId
        this.sourceId = sourceId
        this.onChange = onChange
        if (!outputId) return
        listen()
        listeners.add(this.listener)
        const layers = outputLayers.get(outputId) || new Set()
        layers.add(this)
        outputLayers.set(outputId, layers)
        // a second stream on the output ends the composite
        layers.forEach((l) => l.check())
    }

    get composited() {
        return this.active
    }

    get drawing() {
        return !this.active || this.releasing
    }

    /** call after drawing a fresh frame */
    drawn() {
        if (!this.releasing) return
        this.releasing = false
        this.wanted = false
        this.active = false
        this.onChange()
        // stop the composite only after a frame with the canvas shown has painted
        requestAnimationFrame(() => requestAnimationFrame(() => send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: false, source: this.sourceId })))
    }

    update(canvas: HTMLElement | undefined, frameWidth: number, frameHeight: number) {
        if (!this.outputId || !canvas) return
        this.canvas = canvas
        this.lastWidth = frameWidth
        this.lastHeight = frameHeight
        // geometry only changes with layout
        if (Date.now() - this.checkedAt < 250) return
        this.check()
    }

    private check() {
        if (!this.canvas || !this.lastWidth) return
        this.checkedAt = Date.now()
        const plain = outputLayers.get(this.outputId)?.size === 1 && drawnPlainly(this.canvas, this.lastWidth, this.lastHeight)
        if (plain) {
            if (this.wanted && !this.releasing) return
            this.wanted = true
            this.releasing = false
            send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: true, source: this.sourceId })
            return
        }
        if (!this.wanted || this.releasing) return
        if (this.active) {
            // keep compositing until the page draws a fresh frame
            this.releasing = true
            send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: true, source: this.sourceId, release: true })
            return
        }
        this.wanted = false
        send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: false, source: this.sourceId })
    }

    // an offscreen page only paints when dirty: a 1px canvas redrawn per frame tick keeps it painting
    private damage: HTMLCanvasElement | null = null
    private damageCtx: CanvasRenderingContext2D | null = null
    private flip = false
    private pending = false
    private raf = 0

    // a tick means a frame reached the worker; the repaint runs on rAF (offscreen has no vsync)
    private tick = (id: string) => {
        if (id === this.outputId) this.pending = true
    }

    private loop = () => {
        this.raf = requestAnimationFrame(this.loop)
        // a flag, not a deadline: rAF jitter around the source interval would drop every other frame
        if (!this.damageCtx || !this.pending) return
        this.pending = false
        this.flip = !this.flip
        this.damageCtx.clearRect(0, 0, 1, 1)
        // both alphas round to zero on screen
        this.damageCtx.fillStyle = this.flip ? "rgba(0,0,0,0.001)" : "rgba(0,0,0,0.002)"
        this.damageCtx.fillRect(0, 0, 1, 1)
    }

    private driveDamage(on: boolean) {
        if (!on) {
            tickListeners.delete(this.tick)
            if (this.raf) cancelAnimationFrame(this.raf)
            this.raf = 0
            this.pending = false
            this.damage?.remove()
            this.damage = null
            this.damageCtx = null
            return
        }
        if (this.damage) return
        const parent = this.canvas?.parentElement
        if (!parent) return
        const el = document.createElement("canvas")
        el.width = 1
        el.height = 1
        el.style.cssText = "position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none;"
        parent.appendChild(el)
        this.damage = el
        this.damageCtx = el.getContext("2d")
        tickListeners.add(this.tick)
        if (!this.raf) this.raf = requestAnimationFrame(this.loop)
    }

    destroy() {
        this.driveDamage(false)
        if (this.timer) clearInterval(this.timer)
        this.timer = null
        listeners.delete(this.listener)
        if (this.wanted) send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: false, source: this.sourceId })
        this.wanted = false
        this.active = false
        this.releasing = false
        const layers = outputLayers.get(this.outputId)
        layers?.delete(this)
        if (layers && !layers.size) outputLayers.delete(this.outputId)
        layers?.forEach((l) => l.check())
    }
}
