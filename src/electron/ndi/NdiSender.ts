import { join } from "path"
import { Worker } from "worker_threads"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import { SenderCapture, type CaptureFrameOpts } from "../capture/SenderCapture"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// NDI sender proxy: delegates NDI encoding and dispatch to a worker thread (./ndiWorker)
// one readback of a shared render, fanned out to every member at that member's size and format

export class NdiSender {
    private static worker: Worker | null = null
    private static readonly MAX_INFLIGHT_SENDS = 3

    static NDI: {
        [key: string]: {
            name: string
            groups?: string
            status?: string
            previousStatus?: string
            sender?: boolean
            inFlight?: number
            connections?: number
        }
    } = {}

    private static getWorker(): Worker | null {
        if (this.worker) return this.worker

        try {
            this.worker = new Worker(join(__dirname, "ndiWorker.js"), {
                env: { ...process.env, UV_THREADPOOL_SIZE: "32" }
            })
            this.worker.on("message", (msg: any) => this.onWorkerMessage(msg))
            this.worker.on("error", (err) => console.error("NDI worker error:", err))
            this.worker.on("exit", (code) => {
                if (code !== 0) console.error(`NDI worker exited with code ${code}`)
                this.worker = null
                this.NDI = {}
            })
        } catch (err) {
            console.error("Could not start NDI worker:", err)
            this.worker = null
        }

        return this.worker
    }

    private static onWorkerMessage(msg: any) {
        const t0 = process.env.FS_CAP_STATS ? performance.now() : 0
        try {
            this.onWorkerMessageBody(msg)
        } finally {
            if (t0) {
                const dt = performance.now() - t0
                this.mainDiag.msgMs += dt
                this.mainDiag.msgN++
                if (dt > this.mainDiag.msgMax) this.mainDiag.msgMax = dt
                const t = (this.mainDiag.byType[msg?.type || "?"] ||= { ms: 0, n: 0, max: 0 })
                t.ms += dt
                t.n++
                if (dt > t.max) t.max = dt
            }
        }
    }

    private static onWorkerMessageBody(msg: any) {
        if (!msg?.type) return
        if (SenderCapture.handleMessage(msg)) return

        if (msg.type === "status") {
            const data = this.NDI[msg.id]
            if (!data) return

            data.status = msg.status
            data.connections = msg.connections
            const newStatus = String(msg.status) + String(msg.connections)
            if (newStatus !== data.previousStatus) {
                toApp("NDI", { channel: "SEND_DATA", data: { id: msg.id, status: msg.status, connections: msg.connections } })
                CaptureHelper.updateFramerate(msg.id)
                data.previousStatus = newStatus
            }
        } else if (msg.type === "createFailed") {
            delete this.NDI[msg.id]
        } else if (msg.type === "videoDone") {
            const data = this.NDI[msg.id]
            if (data) data.inFlight = Math.max(0, (data.inFlight ?? 0) - 1)
        }
    }


    // Blackmagic playback and the stream receive host run on this worker too, so they need a handle to it
    static getSharedWorker(): import("worker_threads").Worker | null {
        return this.getWorker()
    }

    static hasWorker(): boolean {
        return !!this.getWorker()
    }

    static postToWorker(msg: any, transfer?: any[]) {
        if (transfer) this.getWorker()?.postMessage(msg, transfer)
        else this.getWorker()?.postMessage(msg)
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    static isBusyNDI(id: string): boolean {
        return (this.NDI[id]?.inFlight ?? 0) >= this.MAX_INFLIGHT_SENDS
    }

    static async createSenderNDI(id: string, name = "", groups?: string) {
        if (this.NDI[id]) {
            this.stopSenderNDI(id)
        }

        const worker = this.getWorker()
        if (!worker) return

        this.NDI[id] = { name, groups, sender: true, status: "unconnected" }
        worker.postMessage({ type: "create", id, name, groups })
    }

    static stopSenderNDI(id: string) {
        if (!this.NDI[id]) return

        delete this.NDI[id]
        this.worker?.postMessage({ type: "destroy", id })
    }

    static sendVideoBufferNDI(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1, transparent = true, format = 0 }: { size?: { width: number; height: number }; ratio?: number; framerate?: number; transparent?: boolean; format?: number } = {}) {
        const data = this.NDI[id]
        if (!data?.sender || !this.worker) return

        data.inFlight = (data.inFlight ?? 0) + 1

        let arrayBuffer: ArrayBuffer
        if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
            arrayBuffer = buffer.buffer as ArrayBuffer
        } else {
            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
        }
        this.worker.postMessage({ type: "video", id, buffer: arrayBuffer, byteOffset: 0, byteLength: arrayBuffer.byteLength, opts: { size, ratio, framerate, transparent, format } }, [arrayBuffer])
    }

    // FS_CAP_STATS: how congested the MAIN JS thread is. lag = how late a 5ms timer fires (0 = idle);
    // paint/msg = synchronous time spent in the OSR paint handler and in worker-message handling per second.
    static mainDiag = { lagSum: 0, lagMax: 0, lagN: 0, paintMs: 0, paintN: 0, paintMax: 0, msgMs: 0, msgN: 0, msgMax: 0, lastTick: 0, started: false, byType: {} as { [type: string]: { ms: number; n: number; max: number } } }
    static startMainDiag() {
        if (this.mainDiag.started || !process.env.FS_CAP_STATS) return
        this.mainDiag.started = true
        const d = this.mainDiag
        d.lastTick = performance.now()
        setInterval(() => {
            const now = performance.now()
            const lag = Math.max(0, now - d.lastTick - 5)
            d.lastTick = now
            d.lagSum += lag
            d.lagN++
            if (lag > d.lagMax) d.lagMax = lag
        }, 5)
        setInterval(() => {
            if (!d.lagN) return
            const types = Object.entries(d.byType).map(([k, v]) => `${k}:n${v.n}/${v.ms.toFixed(0)}ms/max${v.max.toFixed(1)}`).join(" ")
            console.info(`[MAIN-LOOP] lag(mean=${(d.lagSum / d.lagN).toFixed(2)}ms max=${d.lagMax.toFixed(1)}ms) paint(n=${d.paintN} ${d.paintMs.toFixed(1)}ms/s max=${d.paintMax.toFixed(1)}ms) workerMsg(n=${d.msgN} ${d.msgMs.toFixed(1)}ms/s max=${d.msgMax.toFixed(1)}ms) ${types}`)
            d.lagSum = d.lagMax = d.lagN = d.paintMs = d.paintN = d.paintMax = d.msgMs = d.msgN = d.msgMax = 0
            d.byType = {}
        }, 1000)
    }

    static captureFrameNDI(id: string, source: any, opts: CaptureFrameOpts) {
        // the render is shared: any member with an NDI sender, or any OMT sender in the shared worker
        // (opts.omt), keeps the capture going without an NDI sender on the renderer itself
        const anySender = (opts.members?.length ? opts.members : [id]).some((m) => this.NDI[m]?.sender)
        // an output with no sender at all still has work for the worker when something asked the GPU for a
        // scaled frame: an OutputShow or stage viewer, or a preview. Refusing those sent the frame back to
        // main to be read, converted and encoded there.
        const wantsScaled = !!opts.stageStream || !!opts.serverStream || ((opts.dstW || 0) > 0 && (opts.dstH || 0) > 0)
        const anyWorkerConsumer = Object.keys(opts.webrtcMembers || {}).length > 0 || Object.keys(opts.rtmpMembers || {}).length > 0 || Object.keys(opts.presentMembers || {}).length > 0 || !!opts.thumbStream || wantsScaled
        if ((!anySender && !anyWorkerConsumer) || !this.getWorker()) return false
        this.worker!.postMessage({ type: "captureFrame", id, source, opts })
        return true
    }

    static async sendAudioBufferNDITarget(id: string, buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        if (!this.NDI[id]?.sender || !this.worker || !buffer || buffer.length === 0) return

        this.worker.postMessage({ type: "audioTarget", id, buffer: buffer.buffer, byteOffset: buffer.byteOffset, byteLength: buffer.byteLength, opts: { sampleRate, channelCount } })
    }

    static async sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        const hasSender = Object.values(this.NDI).some((s) => s?.sender)
        if (!hasSender || !this.worker || !buffer || buffer.length === 0) return

        this.worker.postMessage({ type: "audio", buffer: buffer.buffer, byteOffset: buffer.byteOffset, byteLength: buffer.byteLength, opts: { sampleRate, channelCount } })
    }
}
