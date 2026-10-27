import type { Size } from "electron"
import { cardFormat } from "./cardFormat"
import { CaptureHelper } from "../capture/CaptureHelper"
import { SenderCapture } from "../capture/SenderCapture"
import { OutputHelper } from "../output/OutputHelper"
import { NdiSender } from "../ndi/NdiSender"
import { BlackmagicManager } from "./BlackmagicManager"

// Main-side proxy for Blackmagic output, which runs in the capture worker; device state is mirrored from it.
export type BmdState = {
    ready: boolean
    displayMode: string
    pixelFormat: string
    enableKeying: boolean
    colorSpace: string
    targetSize: Size
    stable: boolean
    framerate: number
}

export class BlackmagicBridge {
    private static states = new Map<string, BmdState>()
    private static initWaiters = new Map<string, ((ok: boolean) => void)[]>()
    private static hooked = false
    private static audioQueued = 0

    private static worker() {
        this.hook()
        return NdiSender.getSharedWorker()
    }

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.bmdMessageHandler = (msg) => this.onWorkerMessage(msg)
        BlackmagicManager.senderControl = { isDeviceStable: (id) => this.isDeviceStable(id), resetProblematicDevice: (id) => this.resetProblematicDevice(id) }
    }

    private static onWorkerMessage(msg: any) {
        switch (msg?.type) {
            case "bmdState": {
                const st: BmdState = { ready: !!msg.ready, displayMode: msg.displayMode || "", pixelFormat: msg.pixelFormat || "", enableKeying: !!msg.enableKeying, colorSpace: msg.colorSpace || "", targetSize: msg.targetSize || { width: 0, height: 0 }, stable: msg.stable !== false, framerate: Number(msg.framerate) || 0 }
                const was = this.states.get(msg.outputId)
                if (st.ready) this.states.set(msg.outputId, st)
                else this.states.delete(msg.outputId)
                if (!!was?.ready !== st.ready) console.info(st.ready ? `[BMD] ${msg.outputId} playing out: ${st.displayMode} ${st.pixelFormat} ${st.targetSize.width}x${st.targetSize.height} at ${st.framerate}fps${OutputHelper.Lifecycle.isOutputOn(msg.outputId) ? "" : " (output is off: black until it is turned on)"}` : `[BMD] ${msg.outputId} has no device playing out (frames for it are dropped)`)
                if (st.ready) {
                    this.applyFramerate(msg.outputId, st.framerate)
                    // the card plays out from the first frame it is given, and a still page sends none
                    if (!was?.ready) OutputHelper.Lifecycle.requestRepaint(msg.outputId)
                }
                const waiters = this.initWaiters.get(msg.outputId) || []
                this.initWaiters.delete(msg.outputId)
                for (const w of waiters) w(st.ready)
                break
            }
            case "bmdAudioQueued":
                this.audioQueued = Number(msg.length) || 0
                break
        }
    }

    // the card plays out at its mode's rate, so capture must run at that rate
    private static applyFramerate(outputId: string, framerate: number) {
        if (!(framerate > 0)) return
        const output = OutputHelper.getOutput(outputId)
        if (!output?.captureOptions || output.captureOptions.framerates.blackmagic === framerate) return
        output.captureOptions.framerates.blackmagic = framerate
        OutputHelper.setOutput(outputId, output)
        CaptureHelper.updateFramerate(outputId)
    }

    static hasOutputs(): boolean {
        return this.states.size > 0
    }
    static isReady(outputId: string): boolean {
        return !!this.states.get(outputId)?.ready
    }
    static state(outputId: string): BmdState | undefined {
        return this.states.get(outputId)
    }
    static get audioQueueLength(): number {
        return this.audioQueued
    }

    static getTargetDimensions(outputId: string): Size {
        const st = this.states.get(outputId)
        return st?.targetSize?.width ? st.targetSize : { width: 1920, height: 1080 }
    }
    static canAcceptRawUyvy(outputId: string, size: Size): boolean {
        const st = this.states.get(outputId)
        if (!st?.ready || st.enableKeying) return false
        const fmt = st.pixelFormat || ""
        const is8bit422 = fmt.includes("YUV") && fmt.includes("422") && !fmt.includes("10") && !fmt.includes("12")
        if (!is8bit422) return false
        const cs = (st.colorSpace || "").toLowerCase()
        if (!(cs.includes("601") || cs.includes("170"))) return false
        return st.targetSize.width === size.width && st.targetSize.height === size.height
    }
    /** GPU card format (cardFormat.ts), or 0 for BGRA */
    static cardFormat(outputId: string): number {
        const st = this.states.get(outputId)
        if (!st?.ready) return 0
        return cardFormat(st.pixelFormat || "", st.colorSpace || "", !!st.enableKeying)
    }
    static isDeviceStable(outputId: string): boolean {
        return this.states.get(outputId)?.stable !== false
    }
    // the per-frame gate is in the worker
    static canAcceptFrame(outputId: string): boolean {
        return this.isReady(outputId)
    }

    static initialize(outputId: string, deviceIndex: number, displayMode: string, pixelFormat: string, enableKeying: boolean, audioChannels = 2, colorSpace = "rec709"): Promise<boolean> {
        const worker = this.worker()
        if (!worker) return Promise.resolve(false)
        return new Promise((resolve) => {
            const list = this.initWaiters.get(outputId) || []
            list.push(resolve)
            this.initWaiters.set(outputId, list)
            worker.postMessage({ type: "bmdInit", outputId, deviceIndex, displayMode, pixelFormat, enableKeying, audioChannels, colorSpace })
        })
    }

    static stop(outputId: string) {
        this.states.delete(outputId)
        this.worker()?.postMessage({ type: "bmdStop", outputId })
    }
    static stopAll() {
        this.states.clear()
        this.worker()?.postMessage({ type: "bmdStopAll" })
    }
    static shutdown() {
        this.states.clear()
        this.worker()?.postMessage({ type: "bmdShutdown" })
    }
    static resetProblematicDevice(outputId: string): boolean {
        this.worker()?.postMessage({ type: "bmdReset", outputId })
        const st = this.states.get(outputId)
        const wasUnstable = st?.stable === false
        if (st) st.stable = true
        return wasUnstable
    }

    /** interleaved int16 PCM; copied because the caller may reuse its buffer */
    static sendAudioBuffer(buffer: Buffer, opts: { sampleRate: number; channelCount: number }) {
        if (!this.states.size || !buffer.length) return
        const copy = new Uint8Array(buffer.byteLength)
        copy.set(buffer)
        this.worker()?.postMessage({ type: "bmdAudio", buffer: copy.buffer, byteOffset: 0, byteLength: copy.byteLength, opts }, [copy.buffer])
    }

    /** CPU capture path only */
    static scheduleFrame(outputId: string, videoFrame: Buffer, size: Size, framerate: number, preConverted: boolean) {
        if (!this.states.has(outputId)) return
        const copy = new Uint8Array(videoFrame.byteLength)
        copy.set(videoFrame)
        this.worker()?.postMessage({ type: "bmdFrame", outputId, buffer: copy.buffer, byteOffset: 0, byteLength: copy.byteLength, size, framerate, preConverted }, [copy.buffer])
    }
}
