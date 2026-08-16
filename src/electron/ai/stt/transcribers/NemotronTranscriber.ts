import path from "path"
import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { NemotronDriver } from "../../speech/nemotron/driver"
import type { NemotronModelPaths } from "../../speech/nemotron/manager"
import type { NemotronWorkerRequest, NemotronWorkerResponse } from "../../speech/nemotron/worker"
import type { TranscriberSegment } from "../../speech/types"

interface NemotronTranscriberOptions extends SttEngineOptions {
    nemotron: NemotronModelPaths
    vadModelPath: string // resolved by the manager - a file path, not the model directory
}

// the worker loads ~650 MB of ONNX models from disk before it can answer
const WORKER_START_TIMEOUT = 30000
// stop() waits this long for the worker to flush the utterance still being spoken
const WORKER_FLUSH_TIMEOUT = 3000

/**
 * Runs the Nemotron engine in an Electron utilityProcess, so its synchronous native decodes can
 * never freeze the app - audio goes out as messages, segments come back as messages. When the
 * worker cannot be spawned, decoding falls back in-process (the previous behavior).
 */
export class NemotronTranscriber {
    private options: NemotronTranscriberOptions
    private onSegment: (segment: TranscriberSegment) => void
    private onError: (message: string) => void

    private child: Electron.UtilityProcess | null = null
    private fallback: NemotronDriver | null = null
    private stopped = false

    private readyResolve: ((ok: boolean) => void) | null = null
    private stoppedResolve: (() => void) | null = null
    private startErrorMessage = ""

    constructor(options: NemotronTranscriberOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void) {
        this.options = options
        this.onSegment = onSegment
        this.onError = onError
    }

    async start() {
        if (await this.startWorker()) return true
        // the worker answered with a real engine error (bad model files etc.) - in-process would fail identically
        if (this.startErrorMessage) throw new Error(this.startErrorMessage)

        console.warn("[nemotron] Decode process unavailable - decoding in the main process instead")
        this.fallback = new NemotronDriver({
            paths: this.options.nemotron,
            vadModelPath: this.options.vadModelPath,
            language: this.options.language || "en",
            onSegment: this.onSegment,
            onError: this.onError
        })
        await this.fallback.start()
        return true
    }

    async stop() {
        this.stopped = true

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
            child = utilityProcess.fork(path.join(__dirname, "../../speech/nemotron/worker.js"), [], { serviceName: "FreeShow AI transcription" })
        } catch (err) {
            console.error("[nemotron] Could not spawn the decode process:", err)
            return false
        }

        this.child = child
        child.on("message", (message: NemotronWorkerResponse) => this.handleWorkerMessage(message))
        child.on("exit", (code) => {
            if (this.child !== child) return
            this.child = null
            this.readyResolve?.(false)
            this.stoppedResolve?.()
            // an exit while the session is live is a crash (native addons can bring a process down)
            if (!this.stopped) this.onError(`Nemotron transcription process exited unexpectedly (code ${code})`)
        })

        this.post(child, { type: "start", paths: this.options.nemotron, vadModelPath: this.options.vadModelPath, language: this.options.language || "en" })

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

        if (message.type === "segment") this.onSegment(message.segment)
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
}
