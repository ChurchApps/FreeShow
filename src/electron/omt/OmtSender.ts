import { join } from "path"
import { Worker } from "worker_threads"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import { SenderCapture, type CaptureFrameOpts } from "../capture/SenderCapture"
import { ensureOmtCodecSearchPath } from "./omtModule"

// Resources:
// https://github.com/openmediatransport/libomtnet
// https://github.com/schplay/openmediatransport-node

// OMT sender proxy: delegates OMT encoding and dispatch to a worker thread (./omtWorker)

export class OmtSender {
    private static readonly MAX_INFLIGHT_SENDS = 3

    // main-side mirror of the worker's OMT senders
    static OMT: {
        [key: string]: {
            name: string
            quality?: number | string
            status?: string
            previousStatus?: string
            sender?: boolean
            inFlight?: number
            connections?: number
        }
    } = {}

    private static worker: Worker | null = null

    private static getWorker(): Worker | null {
        if (this.worker) return this.worker

        try {
            this.worker = new Worker(join(__dirname, "omtWorker.js"), {
                env: { ...process.env, UV_THREADPOOL_SIZE: "32" }
            })
            this.worker.on("message", (msg: any) => this.onWorkerMessage(msg))
            this.worker.on("error", (err) => console.error("OMT worker error:", err))
            this.worker.on("exit", (code) => {
                if (code !== 0) console.error(`OMT worker exited with code ${code}`)
                this.worker = null
                this.OMT = {}
            })
        } catch (err) {
            console.error("Could not start OMT worker:", err)
            this.worker = null
        }

        return this.worker
    }

    private static onWorkerMessage(msg: any) {
        if (!msg?.type) return
        if (SenderCapture.handleMessage(msg)) return
        if (msg.type === "status") {
            const data = this.OMT[msg.id]
            if (!data) return

            data.status = msg.status
            data.connections = msg.connections
            const newStatus = String(msg.status) + String(msg.connections)
            if (newStatus !== data.previousStatus) {
                toApp("OMT", { channel: "SEND_DATA", data: { id: msg.id, status: msg.status, connections: msg.connections } })
                CaptureHelper.updateFramerate(msg.id)
                data.previousStatus = newStatus
            }
        } else if (msg.type === "createFailed") {
            delete this.OMT[msg.id]
        } else if (msg.type === "videoDone") {
            const data = this.OMT[msg.id]
            if (data) data.inFlight = Math.max(0, (data.inFlight ?? 0) - 1)
        }
    }

    static initNameOMT(name?: string, outputName?: string) {
        return name || `FreeShow OMT${outputName ? ` - ${outputName}` : ""}`
    }

    static isBusyOMT(id: string): boolean {
        return (this.OMT[id]?.inFlight ?? 0) >= this.MAX_INFLIGHT_SENDS
    }

    static async createSenderOMT(id: string, name = "", quality?: number | string) {
        // let the worker retire a live sender as part of the create, so its port and discovery registration free up first
        delete this.OMT[id]

        // the worker cannot set this itself (its process.env is a copy), so do it here first
        ensureOmtCodecSearchPath()

        const worker = this.getWorker()
        if (!worker) return

        this.OMT[id] = { name, quality, sender: true, status: "unconnected" }
        worker.postMessage({ type: "create", id, name, quality })
    }

    static stopSenderOMT(id: string) {
        if (!this.OMT[id]) return

        delete this.OMT[id]
        this.worker?.postMessage({ type: "destroy", id })
    }

    // the worker reads the output's shared texture back, converts and sends it
    static captureFrameOMT(id: string, source: any, opts: CaptureFrameOpts) {
        if (!this.OMT[id]?.sender || !this.getWorker()) return false
        this.worker!.postMessage({ type: "captureFrame", id, source, opts })
        return true
    }

    // transferred zero-copy when the buffer owns its whole ArrayBuffer, copied otherwise (a transfer must never detach a pooled buffer)
    static sendVideoBufferOMT(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1, transparent = true, format = 0 }: { size?: { width: number; height: number }; ratio?: number; framerate?: number; transparent?: boolean; format?: number } = {}) {
        const data = this.OMT[id]
        const worker = this.getWorker()
        if (!data?.sender || !worker) return

        data.inFlight = (data.inFlight ?? 0) + 1

        let arrayBuffer: ArrayBuffer
        if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
            arrayBuffer = buffer.buffer as ArrayBuffer
        } else {
            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
        }
        worker.postMessage({ type: "video", id, buffer: arrayBuffer, byteOffset: 0, byteLength: arrayBuffer.byteLength, opts: { size, ratio, framerate, transparent, format } }, [arrayBuffer])
    }

    // planar Float32 LE (the processAudio contract) is OMT's FPA1 format directly; clone rather than transfer, as these may be pooled
    static async sendAudioBufferOMT(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        const hasSender = Object.values(this.OMT).some((s) => s?.sender)
        const worker = hasSender ? this.getWorker() : null
        if (!worker || !buffer || buffer.length === 0) return

        worker.postMessage({ type: "audio", buffer: buffer.buffer, byteOffset: buffer.byteOffset, byteLength: buffer.byteLength, opts: { sampleRate, channelCount } })
    }
}
