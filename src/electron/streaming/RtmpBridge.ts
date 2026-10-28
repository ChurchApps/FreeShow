import { execFile } from "child_process"
import { SenderCapture } from "../capture/SenderCapture"
import type { RtmpDestination, RtmpStatus } from "../../types/Output"
import { NdiSender } from "../ndi/NdiSender"
import { resolveEncoder } from "./encoderDetection"
import { resolveFfmpegPath } from "./ffmpegManager"
import type { EncoderId } from "./encoderProfiles"
import type { StreamConfig } from "./RtmpStreamer"

// Main-side proxy for the RTMP engine in the capture worker: resolves ffmpeg and the encoder, mirrors status.
type StatusListener = (outputId: string, destinations: RtmpStatus) => void
type NoticeListener = (message: string) => void

export class RtmpBridge {
    private static running = new Map<string, { config: StreamConfig; destinations: RtmpDestination[] }>()
    private static status = new Map<string, RtmpStatus>()
    private static statusListener: StatusListener | null = null
    private static noticeListener: NoticeListener | null = null
    private static hooked = false

    static setStatusListener(listener: StatusListener) {
        this.statusListener = listener
    }
    static setNoticeListener(listener: NoticeListener) {
        this.noticeListener = listener
    }

    static isRunning(outputId: string): boolean {
        return this.running.has(outputId)
    }
    static anyRunning(): boolean {
        return this.running.size > 0
    }
    /** config of a running stream; the capture produces frames at its size */
    static runningConfig(outputId: string): StreamConfig | null {
        return this.running.get(outputId)?.config || null
    }
    static getStatus(outputId: string): RtmpStatus {
        return this.status.get(outputId) || {}
    }

    private static worker() {
        this.hook()
        return NdiSender.getSharedWorker()
    }

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.rtmpMessageHandler = (msg) => this.onWorkerMessage(msg)
    }

    private static onWorkerMessage(msg: any) {
        switch (msg?.type) {
            case "rtmpStatus":
                this.status.set(msg.outputId, msg.destinations || {})
                this.statusListener?.(msg.outputId, msg.destinations || {})
                break
            case "rtmpStopped":
                // the engine stopped on its own (no destinations left, encoder gave up)
                this.running.delete(msg.outputId)
                this.status.delete(msg.outputId)
                this.statusListener?.(msg.outputId, {})
                break
            case "rtmpNotice":
                this.noticeListener?.(String(msg.message || ""))
                break
        }
    }

    /** resolves ffmpeg and the encoder on main (Electron-bound), then hands the stream to the worker */
    static async update(outputId: string, config: StreamConfig, destinations: RtmpDestination[]) {
        const worker = this.worker()
        if (!worker) return
        this.running.set(outputId, { config, destinations })
        const ffmpegPath = await resolveFfmpegPath()
        if (!ffmpegPath) {
            console.error("[RtmpBridge] Cannot start: FFmpeg is not installed.")
            this.running.delete(outputId)
            return
        }
        const encoderId: EncoderId = await resolveEncoder(config.encoder)
        if (!this.running.has(outputId)) return // stopped while resolving
        worker.postMessage({ type: "rtmpUpdate", outputId, config, destinations, ffmpegPath: await this.absolutePath(ffmpegPath), encoderId })
    }

    // the worker spawns with an absolute path: resolve a bare "ffmpeg" from main's PATH
    private static absoluteCache = new Map<string, string>()
    private static absolutePath(binary: string): Promise<string> {
        if (binary.includes("/") || binary.includes("\\")) return Promise.resolve(binary)
        const cached = this.absoluteCache.get(binary)
        if (cached) return Promise.resolve(cached)
        return new Promise((resolve) => {
            execFile(process.platform === "win32" ? "where" : "which", [binary], { windowsHide: true }, (err, stdout) => {
                const lines = !err && stdout ? String(stdout).split(String.fromCharCode(10)) : []
                const first = lines.map((l) => l.split(String.fromCharCode(13)).join("").trim()).find((l) => l.length > 0) || ""
                const found = first || binary
                this.absoluteCache.set(binary, found)
                resolve(found)
            })
        })
    }

    static stop(outputId: string) {
        if (!this.running.has(outputId)) return
        this.running.delete(outputId)
        this.status.delete(outputId)
        this.worker()?.postMessage({ type: "rtmpStop", outputId })
    }

    static stopAll() {
        for (const id of [...this.running.keys()]) this.stop(id)
        this.worker()?.postMessage({ type: "rtmpStopAll" })
    }

    /** interleaved int16 audio; copied, so the caller may reuse its buffer */
    static updateAudio(outputId: string | undefined, buffer: Buffer, sampleRate = 48000) {
        if (!this.running.size) return
        const copy = new Uint8Array(buffer.byteLength)
        copy.set(buffer)
        this.worker()?.postMessage({ type: "rtmpAudio", outputId, buffer: copy.buffer, byteOffset: 0, byteLength: copy.byteLength, sampleRate }, [copy.buffer])
    }

    /** CPU capture path only (no GPU capture) */
    static updateFrame(outputId: string, buffer: Buffer, size: { width: number; height: number }) {
        if (!this.running.has(outputId)) return
        const copy = new Uint8Array(buffer.byteLength)
        copy.set(buffer)
        this.worker()?.postMessage({ type: "rtmpFrame", outputId, buffer: copy.buffer, byteOffset: 0, byteLength: copy.byteLength, size }, [copy.buffer])
    }
}
