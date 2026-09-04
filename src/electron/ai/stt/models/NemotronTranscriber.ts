import path from "path"
import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import type { TranscriberSegment } from "../sttHelper"
import { NemotronDriver, type NemotronWorkerRequest, type NemotronWorkerResponse } from "./nemotronWorker"

// the worker loads ~650 MB of ONNX models from disk before it can answer
const WORKER_START_TIMEOUT = 30000
// stop() waits this long for the worker to flush the utterance still being spoken
const WORKER_FLUSH_TIMEOUT = 3000
// the worker heartbeats every 5s - this much silence means it hung (a native decode that never
// returns leaves no exit event, just a process that stops answering) and gets restarted
const WORKER_STALL_TIMEOUT = 20000
const WORKER_STALL_CHECK_INTERVAL = 5000

/**
 * Runs the Nemotron engine in an Electron utilityProcess, so its synchronous native decodes can
 * never freeze the app - audio goes out as messages, segments come back as messages. When the
 * worker cannot be spawned, decoding falls back in-process (the previous behavior).
 */
export class NemotronTranscriber {
    private options: SttEngineOptions
    private onSegment: (segment: TranscriberSegment) => void
    private onError: (message: string) => void
    private onInterim?: (text: string) => void

    private child: Electron.UtilityProcess | null = null
    private fallback: NemotronDriver | null = null
    private stopped = false

    private readyResolve: ((ok: boolean) => void) | null = null
    private stoppedResolve: (() => void) | null = null
    private startErrorMessage = ""

    private lastWorkerMessageAt = 0
    private stallTimer: NodeJS.Timeout | null = null
    private restarting = false

    constructor(options: SttEngineOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void, onInterim?: (text: string) => void) {
        this.options = options
        this.onSegment = onSegment
        this.onError = onError
        this.onInterim = onInterim
    }

    async start() {
        if (await this.startWorker()) return true
        // the worker answered with a real engine error (bad model files etc.) - in-process would fail identically
        if (this.startErrorMessage) throw new Error(this.startErrorMessage)

        console.warn("[nemotron] Decode process unavailable - decoding in the main process instead")
        this.fallback = new NemotronDriver({
            language: this.options.language || "en",
            onSegment: this.onSegment,
            onInterim: this.onInterim,
            onError: this.onError
        })
        await this.fallback.start()
        return true
    }

    async stop() {
        this.stopped = true
        if (this.stallTimer) {
            clearInterval(this.stallTimer)
            this.stallTimer = null
        }

        const child = this.child
        this.child = null
        if (child) {
            // ask for a flush (the final segment message arrives before "stopped"), then end the process
            try {
                this.post(child, { type: "stop" })
                await new Promise<void>((resolve) => {
                    const timer = setTimeout(resolve, WORKER_FLUSH_TIMEOUT)
                    this.stoppedResolve = () => {
                        clearTimeout(timer)
                        resolve()
                    }
                })
            } catch {}
            try {
                child.kill()
            } catch {}
        }

        if (this.fallback) {
            await this.fallback.stop()
            this.fallback = null
        }
        return true
    }

    pushAudio(buffer: Uint8Array) {
        if (this.child) {
            this.post(this.child, { type: "audio", data: buffer })
            return true
        }
        if (!this.fallback) return false
        this.fallback.pushAudio(buffer)
        return true
    }

    // WORKER LIFECYCLE

    private async startWorker(): Promise<boolean> {
        let child: Electron.UtilityProcess
        try {
            // required lazily so this module stays importable outside Electron (tests)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { utilityProcess } = require("electron") as typeof import("electron")
            if (!utilityProcess?.fork) return false
            child = utilityProcess.fork(path.join(__dirname, "./nemotronWorker.js"), [], { serviceName: "FreeShow AI transcription" })
        } catch (err) {
            console.error("[nemotron] Could not spawn the decode process:", err)
            return false
        }

        this.child = child
        this.lastWorkerMessageAt = Date.now()
        this.armStallWatchdog()
        child.on("message", (message: NemotronWorkerResponse) => this.handleWorkerMessage(message))
        child.on("exit", (code) => {
            if (this.child !== child) return
            this.child = null
            this.readyResolve?.(false)
            this.stoppedResolve?.()
            // an exit while the session is live is a crash (native addons can bring a process down)
            if (!this.stopped) this.onError(`Nemotron transcription process exited unexpectedly (code ${code})`)
        })

        this.post(child, { type: "start", language: this.options.language || "en" })

        const ok = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                this.readyResolve = null
                resolve(false)
            }, WORKER_START_TIMEOUT)
            this.readyResolve = (value: boolean) => {
                clearTimeout(timer)
                this.readyResolve = null
                resolve(value)
            }
        })

        if (!ok) {
            this.child = null
            try {
                child.kill()
            } catch {}
        }
        return ok
    }

    private handleWorkerMessage(message: NemotronWorkerResponse) {
        if (!message || typeof message !== "object") return
        this.lastWorkerMessageAt = Date.now()

        if (message.type === "alive") return // heartbeat - the timestamp above is its whole job
        if (message.type === "segment") this.onSegment(message.segment)
        else if (message.type === "interim") this.onInterim?.(message.text)
        else if (message.type === "ready") this.readyResolve?.(true)
        else if (message.type === "stopped") this.stoppedResolve?.()
        else if (message.type === "error") {
            // an error during start means the engine itself cannot run (surfaced by start());
            // later ones are live session failures
            if (this.readyResolve) {
                this.startErrorMessage = message.message
                this.readyResolve(false)
            } else if (!this.stopped) this.onError(message.message)
        }
    }

    private post(child: Electron.UtilityProcess, message: NemotronWorkerRequest) {
        try {
            child.postMessage(message)
        } catch (err) {
            console.error("[nemotron] Failed to reach the decode process:", err)
        }
    }

    // a hung worker (a native decode that never returns) emits no exit event - it just goes
    // silent. The heartbeat exposes that, and a silent worker is killed and replaced so the
    // session continues with a gap instead of freezing until someone restarts the app
    private armStallWatchdog() {
        if (this.stallTimer) clearInterval(this.stallTimer)
        this.stallTimer = setInterval(() => void this.checkStall(), WORKER_STALL_CHECK_INTERVAL)
        this.stallTimer.unref?.()
    }

    private async checkStall() {
        if (this.stopped || this.restarting || !this.child) return
        if (Date.now() - this.lastWorkerMessageAt < WORKER_STALL_TIMEOUT) return

        this.restarting = true
        console.error(`[nemotron] Decode process went silent for ${Math.round((Date.now() - this.lastWorkerMessageAt) / 1000)}s - restarting it (transcript will have a gap)`)

        const child = this.child
        this.child = null
        try {
            child.kill()
        } catch {}
        this.onInterim?.("") // whatever tail was showing died with the worker

        try {
            const ok = await this.startWorker()
            if (!ok && !this.stopped) this.onError(this.startErrorMessage || "Nemotron transcription process could not be restarted")
        } finally {
            this.restarting = false
        }
    }
}
