import path from "path"
import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { LocalModelManager } from "../../setup/LocalModelManager"
import type { TranscriberSegment } from "../sttHelper"
import { NemotronDriver, type NemotronWorkerRequest, type NemotronWorkerResponse } from "./nemotronWorker"

const WORKER_START_TIMEOUT = 30000
const WORKER_FLUSH_TIMEOUT = 3000
const WORKER_STALL_TIMEOUT = 20000
const WORKER_STALL_CHECK_INTERVAL = 5000

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
    private modelDir = ""

    constructor(options: SttEngineOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void, onInterim?: (text: string) => void) {
        this.options = options
        this.onSegment = onSegment
        this.onError = onError
        this.onInterim = onInterim
    }

    async start() {
        this.modelDir = LocalModelManager.getModelDir("nemotron")
        if (await this.startWorker()) return true
        if (this.startErrorMessage) throw new Error(this.startErrorMessage)

        console.warn("[nemotron] Decode process unavailable - decoding in the main process instead")
        this.fallback = new NemotronDriver({
            language: this.options.language || "en",
            modelDir: this.modelDir,
            onSegment: this.onSegment,
            onInterim: this.onInterim,
            onError: this.onError
        })
        await this.fallback.start()
        return true
    }

    async stop() {
        this.stopped = true
        this.clearStallTimer()

        const { child } = this
        this.child = null

        if (child) {
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

    private async startWorker(): Promise<boolean> {
        let child: Electron.UtilityProcess
        try {
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
            if (!this.stopped) this.onError(`Nemotron transcription process exited unexpectedly (code ${code})`)
        })

        this.post(child, { type: "start", language: this.options.language || "en", modelDir: this.modelDir })

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

        switch (message.type) {
            case "alive":
                return
            case "segment":
                this.onSegment(message.segment)
                break
            case "interim":
                this.onInterim?.(message.text)
                break
            case "ready":
                this.readyResolve?.(true)
                break
            case "stopped":
                this.stoppedResolve?.()
                break
            case "error":
                if (this.readyResolve) {
                    this.startErrorMessage = message.message
                    this.readyResolve(false)
                } else if (!this.stopped) {
                    this.onError(message.message)
                }
                break
        }
    }

    private post(child: Electron.UtilityProcess, message: NemotronWorkerRequest) {
        try {
            child.postMessage(message)
        } catch (err) {
            console.error("[nemotron] Failed to reach the decode process:", err)
        }
    }

    private clearStallTimer() {
        if (this.stallTimer) {
            clearInterval(this.stallTimer)
            this.stallTimer = null
        }
    }

    private armStallWatchdog() {
        this.clearStallTimer()
        this.stallTimer = setInterval(() => void this.checkStall(), WORKER_STALL_CHECK_INTERVAL)
        this.stallTimer.unref?.()
    }

    private async checkStall() {
        if (this.stopped || this.restarting || !this.child) return
        if (Date.now() - this.lastWorkerMessageAt < WORKER_STALL_TIMEOUT) return

        this.restarting = true
        console.error(`[nemotron] Decode process went silent for ${Math.round((Date.now() - this.lastWorkerMessageAt) / 1000)}s - restarting process`)

        const { child } = this
        this.child = null
        try {
            child?.kill()
        } catch {}
        this.onInterim?.("")

        try {
            const ok = await this.startWorker()
            if (!ok && !this.stopped) this.onError(this.startErrorMessage || "Nemotron transcription process could not be restarted")
        } finally {
            this.restarting = false
        }
    }
}
