import { join } from "path"
import { Worker } from "worker_threads"
import { SenderCapture } from "./SenderCapture"

// The single worker thread that owns every network sender (./senderWorkerHost). Outputs showing the
// same content share one render and so one shared texture, which only one thread can open, so the
// senders those outputs feed all live here whatever protocol each of them speaks. Blackmagic playback,
// RTMP and the stream receive host run on it too.

export class SenderThread {
    private static worker: Worker | null = null
    private static listeners: ((msg: any) => void)[] = []
    private static exitHandlers: (() => void)[] = []

    static get(): Worker | null {
        if (this.worker) return this.worker

        try {
            this.worker = new Worker(join(__dirname, "senderWorkerHost.js"), {
                env: { ...process.env, UV_THREADPOOL_SIZE: "32" }
            })
            this.worker.on("message", (msg: any) => {
                if (!msg?.type) return
                if (SenderCapture.handleMessage(msg)) return
                for (const fn of this.listeners) fn(msg)
            })
            this.worker.on("error", (err) => console.error("Sender worker error:", err))
            this.worker.on("exit", (code) => {
                if (code !== 0) console.error(`Sender worker exited with code ${code}`)
                this.worker = null
                for (const fn of this.exitHandlers) fn()
            })
        } catch (err) {
            console.error("Could not start sender worker:", err)
            this.worker = null
        }

        return this.worker
    }

    static subscribe(onMessage: (msg: any) => void, onExit: () => void) {
        this.listeners.push(onMessage)
        this.exitHandlers.push(onExit)
    }

    static post(msg: any, transfer?: any[]) {
        if (transfer) this.get()?.postMessage(msg, transfer)
        else this.get()?.postMessage(msg)
    }
}
