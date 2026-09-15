import { type BrowserWindow } from "electron"
import { SenderCapture } from "./SenderCapture"
import { getMainWindow } from ".."
import { NdiSender } from "../ndi/NdiSender"

// The main window's output previews are fed from the capture, not from their own decode: the readback
// worker already produces a GPU-downscaled frame of each render and serves it to the previewing window
// over the shared-memory transport (capture/FrameServer.ts, streamLink.ts); main relays only the socket.
export class PreviewStream {
    private static refs: { [outputId: string]: number } = {}
    // widest pixel width any subscriber of an output currently draws its preview at (0 = unknown yet)
    private static widths: { [outputId: string]: { [subscriber: string]: number } } = {}

    // set by OutputLifecycle: a subscriber arriving or leaving changes the rate the render must run at, and
    // nothing else re-applies it until a receiver connects or disconnects
    static onSubscribersChanged: ((outputId: string) => void) | null = null

    static subscribe(outputId: string, subscriber = "", width = 0) {
        this.refs[outputId] = (this.refs[outputId] || 0) + 1
        this.setWidth(outputId, subscriber, width)
        this.ensurePort()
        this.onSubscribersChanged?.(outputId)
    }

    static unsubscribe(outputId: string, subscriber = "") {
        const refs = (this.refs[outputId] || 0) - 1
        if (refs > 0) this.refs[outputId] = refs
        else delete this.refs[outputId]
        if (this.widths[outputId]) {
            delete this.widths[outputId][subscriber]
            if (!Object.keys(this.widths[outputId]).length) delete this.widths[outputId]
        }
        this.onSubscribersChanged?.(outputId)
    }

    // a subscriber's preview element was (re)sized: the frame it is sent need be no wider than that
    static setWidth(outputId: string, subscriber: string, width: number) {
        if (!width || !subscriber) return
        ;(this.widths[outputId] ||= {})[subscriber] = Math.round(width)
    }

    // the widest preview any subscriber of these outputs draws (0 = no size known yet)
    static requestedWidth(outputIds: string[]): number {
        let best = 0
        for (const id of outputIds) for (const w of Object.values(this.widths[id] || {})) if (w > best) best = w
        return best
    }

    static hasSubscribers(outputId?: string): boolean {
        if (outputId) return (this.refs[outputId] || 0) > 0
        return Object.keys(this.refs).length > 0
    }

    // the worker asks once per output, so one subscribed before the socket existed is remembered
    private static wsInfo: { port: number; token: string } | null = null
    private static wired = new Set<string>()
    private static wanted = new Set<string>()
    private static hooked = false

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.previewMessageHandler = (msg) => {
            if (msg.type === "previewWs") {
                this.wsInfo = { port: msg.port, token: msg.token }
                for (const id of [...this.wanted]) this.wire(id)
            } else if (msg.type === "previewNeedTarget") {
                this.wire(msg.targetId)
            }
        }
    }

    private static wire(outputId: string) {
        const window = getMainWindow()
        if (!this.hasSubscribers(outputId) || !this.wsInfo || !window || window.isDestroyed()) {
            this.wanted.add(outputId)
            return
        }
        this.wanted.delete(outputId)
        this.wired.add(outputId)
        this.portWindow = window
        window.webContents.send("STREAM_WS", { targetId: outputId, port: this.wsInfo.port, token: this.wsInfo.token })
    }

    // a reloaded or closed window takes its sockets with it; its components re-subscribe when they mount
    private static reset() {
        this.wired.clear()
        this.wanted.clear()
        this.portWindow = null
        NdiSender.postToWorker({ type: "previewReset" })
    }

    private static portWindow: BrowserWindow | null = null

    private static ensurePort() {
        this.hook()
        const window = getMainWindow()
        if (!window || window.isDestroyed()) return
        if (this.portWindow !== window) {
            this.reset()
            const drop = () => {
                if (this.portWindow !== window) return
                this.reset()
                this.refs = {}
            }
            window.once("closed", drop)
            window.webContents.once("render-process-gone", drop)
            window.webContents.on("did-start-navigation", (details) => {
                if (details.isMainFrame && !details.isSameDocument) drop()
            })
        }
        for (const id of Object.keys(this.refs)) if (!this.wired.has(id)) this.wire(id)
    }
}
