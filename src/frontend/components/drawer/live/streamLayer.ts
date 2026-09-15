import { writable } from "svelte/store"
import { OUTPUT } from "../../../../types/Channels"
import { receive, send } from "../../../utils/request"

// A live stream shown full-screen on a captured output does not have to be drawn by the page at all: the
// capture worker composites the frame into the capture itself (osr-capture's video layer), which keeps a
// 4K frame out of the browser's GPU thread. That only holds while the element covers the output with the
// frame's own aspect and nothing is applied on top of it, so the page checks that and keeps drawing
// whenever it is not true. It also keeps drawing until the worker confirms it is compositing, so the
// output is never blank.

/**
 * Outputs whose stream the capture worker is compositing. The output paints its background transparent
 * then, so the composited video shows through where the page has nothing of its own.
 */
export const compositedOutputs = writable<{ [id: string]: boolean }>({})

const LISTENER_ID = "STREAM_LAYER"
const listeners = new Set<(id: string, active: boolean) => void>()
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

/**
 * True when the composite would land exactly where the page draws this canvas: it covers the output, the
 * frame's aspect matches it (so there is no letterboxing to reproduce), and no ancestor fades, filters,
 * blends or reshapes it. Pure translation is allowed, since it only moves an element that still covers
 * the output.
 */
function drawnPlainly(canvas: HTMLElement, frameWidth: number, frameHeight: number) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height || !frameWidth || !frameHeight) return false
    // the composite fills the output, so it only matches while the frame's aspect is the element's
    if (Math.abs(rect.width / rect.height - frameWidth / frameHeight) > 0.01) return false
    // ... and while that element covers the whole output
    const slack = 1
    if (rect.left > slack || rect.top > slack || rect.right < window.innerWidth - slack || rect.bottom < window.innerHeight - slack) return false

    let node: HTMLElement | null = canvas
    for (let depth = 0; node && depth < 12; depth++) {
        const style = getComputedStyle(node)
        if (style.filter !== "none" || style.backdropFilter !== "none") return false
        if (style.opacity !== "1") return false
        if (style.mixBlendMode !== "normal") return false
        // translation keeps the pixels where they are; anything else (scale, rotation, skew) does not
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

/**
 * Tracks whether this output's stream can be composited by the worker instead of drawn here.
 * `update` is called with each frame; `composited` says whether to skip the draw.
 */
export class StreamLayer {
    private outputId = ""
    private canvas: HTMLElement | null = null
    private wanted = false
    private active = false
    private checkedAt = 0
    private lastWidth = 0
    private lastHeight = 0
    private timer: ReturnType<typeof setInterval> | null = null
    private onChange: () => void
    private listener = (id: string, active: boolean) => {
        if (id !== this.outputId) return
        this.active = active
        this.onChange()
        this.driveDamage(active)
        // frames stop arriving here while the worker composites them, so keep checking on a timer:
        // a transition or a filter has to put the drawing back in this page
        if (active && !this.timer) this.timer = setInterval(() => this.check(), 250)
        else if (!active && this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    constructor(outputId: string, onChange: () => void) {
        this.outputId = outputId
        this.onChange = onChange
        if (!outputId) return
        listen()
        listeners.add(this.listener)
    }

    /** true while the worker composites this stream, so the page must not draw it */
    get composited() {
        return this.active
    }

    update(canvas: HTMLElement | undefined, frameWidth: number, frameHeight: number) {
        if (!this.outputId || !canvas) return
        this.canvas = canvas
        this.lastWidth = frameWidth
        this.lastHeight = frameHeight
        // the element's geometry only changes with layout, so this does not run per frame
        if (Date.now() - this.checkedAt < 250) return
        this.check()
    }

    private check() {
        if (!this.canvas || !this.lastWidth) return
        this.checkedAt = Date.now()
        const plain = drawnPlainly(this.canvas, this.lastWidth, this.lastHeight)
        if (plain === this.wanted) return
        this.wanted = plain
        send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: plain })
        if (!plain) {
            this.active = false
            this.onChange()
        }
    }

    // The page stops drawing while the worker composites, so nothing marks the window dirty — and an
    // offscreen window only paints when it is. A 1px canvas redrawn on each frame tick keeps the paints
    // coming at the source's rate; it paints nothing visible itself.
    private damage: HTMLCanvasElement | null = null
    private damageCtx: CanvasRenderingContext2D | null = null
    private flip = false
    private pending = false
    private raf = 0

    // A tick says a frame reached the worker: it sets the pace. The repaint runs on this page's own
    // animation loop, so a paint never waits on the round trip that announced it, and never free-runs
    // either (offscreen rendering has no vsync to throttle it).
    private tick = (id: string) => {
        if (id === this.outputId) this.pending = true
    }

    private loop = () => {
        this.raf = requestAnimationFrame(this.loop)
        // one repaint per frame that arrived. A flag rather than a due time: animation frames jitter
        // either side of the source's interval, and comparing against a deadline drops every other one
        if (!this.damageCtx || !this.pending) return
        this.pending = false
        this.flip = !this.flip
        this.damageCtx.clearRect(0, 0, 1, 1)
        // two values that both round to nothing on screen, so the pixel never changes visibly
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
        if (this.wanted) send(OUTPUT, ["STREAM_LAYER"], { id: this.outputId, active: false })
        this.wanted = false
        this.active = false
    }
}
