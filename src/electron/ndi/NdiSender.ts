import { join } from "path"
import { Worker } from "worker_threads"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// render-overhaul #17: the actual NDI engine (grandiose sender lifecycle, colour-convert, 16-byte padding
// and send-dispatch) now runs in a worker_thread (./ndiWorker) so it stays OFF the main thread. This class
// is a thin main-thread proxy: it forwards create/video/audio/destroy messages, keeps a lightweight mirror
// of each sender (name/status/busy) so existing callers can check state cheaply, and relays connection
// status back to the app. Video frame buffers are transferred (zero-copy) to the worker.

export class NdiSender {
    private static worker: Worker | null = null

    // main-side mirror of the worker's senders (existence + status + in-flight flag)
    static NDI: {
        [key: string]: {
            name: string
            groups?: string
            status?: string
            previousStatus?: string
            sender?: boolean
            sendingVideo?: boolean
        }
    } = {}

    private static getWorker(): Worker | null {
        if (this.worker) return this.worker

        try {
            this.worker = new Worker(join(__dirname, "ndiWorker.js"))
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
        if (!msg?.type) return

        if (msg.type === "status") {
            const data = this.NDI[msg.id]
            if (!data) return

            data.status = msg.status
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
            if (data) data.sendingVideo = false
        }
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    // true while a video() send is in flight in the worker (its next frame would be dropped-to-latest)
    static isBusyNDI(id: string): boolean {
        return !!this.NDI[id]?.sendingVideo
    }

    static async createSenderNDI(id: string, name = "", groups?: string) {
        if (this.NDI[id]) return

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

    static sendVideoBufferNDI(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1, transparent = true }: { size?: { width: number; height: number }; ratio?: number; framerate?: number; transparent?: boolean } = {}) {
        const data = this.NDI[id]
        if (!data?.sender || !this.worker) return

        data.sendingVideo = true

        // hand the frame buffer to the worker zero-copy via transfer. Only transfer when this Buffer owns
        // its entire backing ArrayBuffer (toBitmap() normally does); otherwise copy just the frame region so
        // a transfer can never detach an unrelated (pooled/shared) buffer.
        let arrayBuffer: ArrayBuffer
        if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
            arrayBuffer = buffer.buffer as ArrayBuffer
        } else {
            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
        }
        this.worker.postMessage({ type: "video", id, buffer: arrayBuffer, byteOffset: 0, byteLength: arrayBuffer.byteLength, opts: { size, ratio, framerate, transparent } }, [arrayBuffer])
    }

    static async sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        if (!this.worker) return

        const ndiAudioBuffer = convertPCMtoPlanarFloat32(buffer, channelCount)
        if (!ndiAudioBuffer) return

        // audio buffers are small; clone (do not transfer) to avoid detaching a possibly-pooled ArrayBuffer
        this.worker.postMessage({ type: "audio", buffer: ndiAudioBuffer.buffer, byteOffset: ndiAudioBuffer.byteOffset, byteLength: ndiAudioBuffer.byteLength, opts: { sampleRate, channelCount } })
    }
}

// convert from PCM/signed-16-bit/little-endian data to NDI's "PCM/planar/signed-float32/little-endian"
function convertPCMtoPlanarFloat32(buffer: Buffer, channels: number) {
    try {
        const pcmconvert = require("pcm-convert")
        return pcmconvert(buffer, { channels, dtype: "int16", endianness: "le", interleaved: true }, { dtype: "float32", endianness: "le", interleaved: false }) as Buffer
    } catch (err) {
        console.error("Could not convert audio")
        return null
    }
}
