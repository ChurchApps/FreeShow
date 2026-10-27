import type { BrowserWindow, WebContents } from "electron"
import path from "path"
import { OUTPUT } from "../../../types/Channels"
import type { MediaStyle } from "../../../types/Main"
import type { Message } from "../../../types/Socket"
import { SenderCapture } from "../../capture/SenderCapture"
import { SenderThread } from "../../capture/SenderThread"
import { OutputHelper } from "../OutputHelper"
import { RenderGroups } from "./RenderGroups"

// One hidden media window per shared background video, composited under each output page by the capture worker.

type Layer = { path: string; mediaStyle: MediaStyle; startAt: number; clock?: number | null; alpha: number }
type Spec = { outputId: string; path: string; mediaStyle: MediaStyle; startAt: number; width: number; height: number; clock: number | null }
type Source = { key: string; base: string; win: BrowserWindow; spec: Spec; members: Set<string>; held: Map<number, any>; frames: number; size: string }

const STATS = !!process.env.FS_CAP_STATS

export class MediaLayers {
    private static sources = new Map<string, Source>()
    private static used = new Map<string, Set<string>>()
    private static seq = 0
    private static hooked = false

    /** layers are bottom to top */
    static update(outputId: string, layers: Layer[], fill: number[]) {
        this.hook()
        if (STATS) console.info(`[MEDIA] ${outputId} shows ${layers.map((l) => `${path.basename(l.path)}@${l.alpha}`).join(", ") || "no media layer"}`)
        const size = OutputHelper.getOutput(outputId)?.intendedBounds
        if (!size?.width || !size?.height) return
        const keys = layers.map((l) => {
            const spec: Spec = { outputId, path: l.path, mediaStyle: l.mediaStyle || {}, startAt: l.startAt || 0, width: size.width, height: size.height, clock: l.clock ?? null }
            const base = JSON.stringify({ path: spec.path, mediaStyle: spec.mediaStyle, startAt: spec.startAt, width: spec.width, height: spec.height })
            return this.acquire(base, outputId, spec)
        })
        for (const key of this.used.get(outputId) || []) if (!keys.includes(key)) this.release(key, outputId)
        this.used.set(outputId, new Set(keys))
        SenderThread.post({ type: "mediaAssign", outputId, layers: keys.map((key, i) => ({ key, alpha: layers[i].alpha })), fill })
        OutputHelper.Lifecycle.updateRenderBackground(outputId)
    }

    static showsMedia(outputId: string): boolean {
        return (this.used.get(outputId)?.size || 0) > 0
    }

    static removeOutput(outputId: string) {
        for (const key of this.used.get(outputId) || []) this.release(key, outputId)
        this.used.delete(outputId)
        SenderThread.post({ type: "mediaAssign", outputId, layers: [], fill: [0, 0, 0] })
    }

    /** media windows need the same playback state, media and styles as outputs */
    static broadcast(msg: Message) {
        for (const src of this.sources.values()) if (!src.win.isDestroyed()) src.win.webContents.send(OUTPUT, msg)
    }

    static sourceReady(sender: WebContents) {
        for (const src of this.sources.values()) {
            if (!src.win.isDestroyed() && src.win.webContents === sender) src.win.webContents.send(OUTPUT, { channel: "MEDIA_SOURCE", data: src.spec })
        }
    }

    // max clock drift to share a source; the drift videoSync.ts tolerates before seeking
    private static readonly SAME_PLAYBACK_MS = 800

    /** returns the key of the source joined or started */
    private static acquire(base: string, outputId: string, spec: Spec): string {
        const mine = [...this.used.get(outputId) || []].find((k) => this.sources.get(k)?.base === base)
        if (mine) return mine
        for (const src of this.sources.values()) {
            if (src.base !== base) continue
            const inStep = src.spec.clock === null || spec.clock === null || Math.abs(src.spec.clock - spec.clock) < this.SAME_PLAYBACK_MS
            if (!inStep) continue
            src.members.add(outputId)
            return src.key
        }
        const key = `${base}#${++this.seq}`
        const win = OutputHelper.Lifecycle.createMediaWindow(spec.width, spec.height)
        if (!win) {
            if (STATS) console.info("[MEDIA] media layers unavailable here; the page keeps its own video")
            return key
        }
        const src: Source = { key, base, win, spec, members: new Set([outputId]), held: new Map(), frames: 0, size: "" }
        this.sources.set(key, src)
        if (STATS) console.info(`[MEDIA] source for ${spec.path} at ${spec.width}x${spec.height}, sources=${this.sources.size}`)
        this.startStats()

        win.webContents.on("paint", (event: any) => {
            const tex = event?.texture
            const info = tex?.textureInfo
            if (!info) return
            if (!this.sources.has(key)) {
                tex.release()
                return
            }
            const seq = ++this.seq
            src.held.set(seq, tex)
            src.frames++
            if (STATS) src.size = `${info.codedSize.width}x${info.codedSize.height}`
            const handle = process.platform === "linux" ? { planes: info.planes, modifier: info.modifier } : info.sharedTextureHandle
            SenderThread.post({ type: "mediaFrame", key, seq, handle, width: info.codedSize.width, height: info.codedSize.height })
            // the tick repaints the page, which drives its capture; followers are not captured
            for (const m of src.members) if (RenderGroups.isRenderer(m)) OutputHelper.Send.sendToWindow(m, { channel: "MEDIA_TICK", data: { outputId: m } })
        })
        return key
    }

    private static release(key: string, outputId: string) {
        const src = this.sources.get(key)
        if (!src) return
        src.members.delete(outputId)
        if (src.members.size) return
        this.sources.delete(key)
        if (STATS) console.info(`[MEDIA] source for ${src.spec.path} released, sources=${this.sources.size}`)
        SenderThread.post({ type: "mediaDrop", key })
        // the worker returns the textures it holds; release the ones it never received
        setTimeout(() => {
            for (const tex of src.held.values()) {
                try {
                    tex.release()
                } catch {}
            }
            src.held.clear()
            if (!src.win.isDestroyed()) src.win.destroy()
        }, 1000)
    }

    private static statsTimer: NodeJS.Timeout | null = null
    private static startStats() {
        if (!STATS || this.statsTimer) return
        this.statsTimer = setInterval(() => {
            for (const src of this.sources.values()) {
                console.info(`[MEDIA-STATS] ${path.basename(src.spec.path)} frames/s ${src.frames} at ${src.size} outputs=[${[...src.members].join(",")}] held ${src.held.size}`)
                src.frames = 0
            }
        }, 1000)
    }

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.mediaMessageHandler = (msg) => {
            if (msg.type !== "mediaRelease") return
            const src = [...this.sources.values()].find((s) => s.key === msg.key)
            const tex = src?.held.get(msg.seq)
            if (!src || !tex) return
            src.held.delete(msg.seq)
            try {
                tex.release()
            } catch {}
        }
    }
}
