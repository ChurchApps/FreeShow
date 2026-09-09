import { writable } from "svelte/store"

// Preview deduplication: group renderer decodes once, follower mirrors paint from it via canvas
const elements = new Map<string, HTMLVideoElement>()

// bumped on every register/unregister so Svelte components re-query reactively
export const mirrorRegistryTick = writable(0)

export function mirrorVideoKey(outputId: string, path: string): string {
    return `${outputId}|${path}`
}

export function registerMirrorVideo(key: string, el: HTMLVideoElement) {
    elements.set(key, el)
    mirrorRegistryTick.update((n) => n + 1)
}

export function unregisterMirrorVideo(key: string, el: HTMLVideoElement | null) {
    if (el && elements.get(key) !== el) return
    elements.delete(key)
    mirrorRegistryTick.update((n) => n + 1)
}

export function getMirrorVideo(key: string): HTMLVideoElement | null {
    return elements.get(key) || null
}

// the render group this output FOLLOWS (null when it is the renderer itself, or ungrouped)
export function findGroupRendererId(groups: { [rendererId: string]: string[] }, outputId: string): string | null {
    return Object.entries(groups).find(([rendererId, members]) => rendererId !== outputId && members.includes(outputId))?.[0] ?? null
}

// keeps the registry in sync with a mirror's <video> element across reactive updates
export class MirrorRegistration {
    private key: string | null = null
    private el: HTMLVideoElement | null = null

    update(nextKey: string | null, video: HTMLVideoElement | null, cloneActive: boolean) {
        if (nextKey === this.key && (!nextKey || video === this.el)) return

        if (this.key) unregisterMirrorVideo(this.key, this.el)
        // clone mode unmounts the <video>; unload it so its decoder is released now, not at GC
        if (!nextKey && cloneActive && this.el) {
            try {
                this.el.pause()
                this.el.removeAttribute("src")
                this.el.load()
            } catch {
                // already detached
            }
        }
        this.key = nextKey
        this.el = nextKey ? video : null
        if (nextKey && video) registerMirrorVideo(nextKey, video)
    }

    destroy() {
        if (this.key) unregisterMirrorVideo(this.key, this.el)
        this.key = null
        this.el = null
    }
}

// paints a source <video>'s frames onto a canvas, honoring the media fit like object-fit would
export class MirrorCloneDrawer {
    private canvas: HTMLCanvasElement | null = null
    private source: HTMLVideoElement | null = null
    private fit = "contain"
    private raf = 0

    setFit(fit: string | undefined) {
        this.fit = fit === "fill" || fit === "cover" ? fit : "contain"
    }

    start(canvas: HTMLCanvasElement, source: HTMLVideoElement) {
        this.stop()
        this.canvas = canvas
        this.source = source
        const step = () => {
            this.draw()
            this.raf = requestAnimationFrame(step)
        }
        this.raf = requestAnimationFrame(step)
    }

    stop() {
        if (this.raf) cancelAnimationFrame(this.raf)
        this.raf = 0
    }

    private draw() {
        const src = this.source
        const c = this.canvas
        if (!src || !c || src.readyState < 2) return
        const cw = c.clientWidth
        const ch = c.clientHeight
        const vw = src.videoWidth
        const vh = src.videoHeight
        if (!cw || !ch || !vw || !vh) return
        if (c.width !== cw || c.height !== ch) {
            c.width = cw
            c.height = ch
        }
        const ctx = c.getContext("2d")
        if (!ctx) return
        let dw = cw
        let dh = ch
        if (this.fit !== "fill") {
            const scale = this.fit === "cover" ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh)
            dw = vw * scale
            dh = vh * scale
            ctx.clearRect(0, 0, cw, ch)
        }
        ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }
}
