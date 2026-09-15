import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import { SenderThread } from "../capture/SenderThread"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// NDI sender proxy: delegates NDI encoding and dispatch to the shared sender worker (./ndiWorker is
// its adapter there); one readback of a shared render, fanned out to every member at its size and format

export class NdiSender {
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

    private static subscribed = false
    private static get worker() {
        if (!this.subscribed) {
            this.subscribed = true
            SenderThread.subscribe(
                (msg) => this.onWorkerMessage(msg),
                () => (this.NDI = {})
            )
        }
        return SenderThread.get()
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
        return this.worker
    }

    static hasWorker(): boolean {
        return !!this.worker
    }

    static postToWorker(msg: any, transfer?: any[]) {
        SenderThread.post(msg, transfer)
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

        const worker = this.worker
        if (!worker) return

        this.NDI[id] = { name, groups, sender: true, status: "unconnected" }
        worker.postMessage({ type: "create", protocol: "ndi", id, name, groups })
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
