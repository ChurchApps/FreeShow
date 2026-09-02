import { join } from "path"
import { Worker } from "worker_threads"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// The actual NDI engine (grandiose sender lifecycle, colour-convert, 16-byte padding
// and send-dispatch) now runs in a worker_thread (./ndiWorker) so it stays OFF the main thread. This class
// is a thin main-thread proxy: it forwards create/video/audio/destroy messages, keeps a lightweight mirror
// of each sender (name/status/busy) so existing callers can check state cheaply, and relays connection
// status back to the app. Video frame buffers are transferred (zero-copy) to the worker.

export class NdiSender {
    private static worker: Worker | null = null

    // How many video sends may be posted to the worker before its completions (videoDone) come back. The
    // send round-trip is dominated by main<->worker messaging latency (not the ~4-7ms send itself) and can
    // exceed a 60fps frame interval, so single-in-flight aliases the rate down. With MULTIPLE senders sharing
    // one worker, each sender's sends also queue behind the others, so 2 occasionally busy-skips; 3 hides that
    // while still bounding the worker's queue (a stalled receiver can't accumulate more than 3 frames).
    private static readonly MAX_INFLIGHT_SENDS = 3

    // main-side mirror of the worker's senders (existence + status + count of sends in flight)
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
                // Both grandiose's video() send AND osr-capture's readback run as napi async work on the
                // worker's libuv THREAD POOL. The default of 4 threads serializes multiple 4K outputs (e.g.
                // 3 outputs = 3 readbacks + 3 sends contending for 4 threads). Enlarge the pool so per-output
                // readbacks and sends run truly in parallel — the key to many concurrent 4K outputs.
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
        if (!msg?.type) return

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
        } else if (msg.type === "releaseTexture") {
            // off-main capture: the GPU has consumed the shared texture -> release it (frees the frame pool)
            this.releaseTextureCallbacks[msg.id]?.(msg.seq)
        } else if (msg.type === "captureDone") {
            // off-main capture fully done -> a pipeline slot frees (the lifecycle may forward the next frame).
            // msg.tl = FS_CAP_STATS per-frame worker timeline (hop timestamps) for the [TIMELINE] attribution.
            this.captureDoneCallbacks[msg.id]?.(msg.seq, msg.tl)
        } else if (msg.type === "scaledFrame") {
            // the worker GPU-downscaled the 4K readback to a small BGRA (server/stage) and copied it here;
            // main wraps the small image once and fans it out to every group member's server/stage consumers
            CaptureHelper.Transmitter.receiveScaledFrame(msg.members || [msg.id], msg.buffer, msg.byteOffset, msg.byteLength, msg.size)
        }
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    // true once the max number of sends are already in flight in the worker (posting more would just queue/
    // drop-to-latest); callers skip producing a frame while busy
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

        // hand the frame buffer to the worker zero-copy via transfer. Only transfer when this Buffer owns
        // its entire backing ArrayBuffer (toBitmap() normally does); otherwise copy just the frame region so
        // a transfer can never detach an unrelated (pooled/shared) buffer.
        let arrayBuffer: ArrayBuffer
        if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
            arrayBuffer = buffer.buffer as ArrayBuffer
        } else {
            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
        }
        this.worker.postMessage({ type: "video", id, buffer: arrayBuffer, byteOffset: 0, byteLength: arrayBuffer.byteLength, opts: { size, ratio, framerate, transparent, format } }, [arrayBuffer])
    }

    // Off-main capture (NDI-only outputs): forward just the shared-texture handle to the worker, which does the
    // readback AND the send itself so the main process never touches 4K pixel data. The worker replies with
    // "captureDone" (relayed via captureDoneCallbacks) so the capture lifecycle can release the texture.
    // tl (FS_CAP_STATS only): worker-side per-frame hop timestamps — recv (message handled), cS/cE (around
    // readbackConsume), fS/fE (around readbackFinish), enq (pacer enqueue complete; 0/absent on error paths).
    static captureDoneCallbacks: { [id: string]: (seq: number, tl?: { recv: number; cS: number; cE: number; fS: number; fE: number; enq: number } | null) => void } = {}
    static releaseTextureCallbacks: { [id: string]: (seq: number) => void } = {}
    // opts.depth = the renderer's derived in-flight depth_r (OutputLifecycle) — sizes the worker's pace queue.
    // opts.memberFramerates = each group member's OWN resolved NDI framerate (configured when connected, idle
    // floor when not) — the worker paces each member's sender at ITS rate, never the renderer's.
    static captureFrameNDI(id: string, source: any, opts: { size: { width: number; height: number }; ratio: number; framerate: number; memberFramerates?: { [id: string]: number }; format: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[]; depth?: number }) {
        const data = this.NDI[id]
        if (!data?.sender || !this.worker) return false
        this.worker.postMessage({ type: "captureFrame", id, source, opts })
        return true
    }

    // `buffer` arrives already as planar/float32/little-endian PCM (the renderer converts). Audio buffers
    // are small; clone (do not transfer) to avoid detaching a possibly-pooled ArrayBuffer.
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
