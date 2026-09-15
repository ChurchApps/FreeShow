import { CaptureHelper } from "./CaptureHelper"
import { SenderThread } from "./SenderThread"

// Main-thread side of the off-main capture path, shared by the network sender proxies (NdiSender,
// OmtSender), whose workers report the same things about a capture.

/** off-main capture request: the worker reads the shared texture back, converts and sends it */
export type CaptureFrameOpts = {
    size: { width: number; height: number }
    ratio: number
    framerate: number
    memberFramerates?: { [id: string]: number }
    format: number
    transparent?: boolean
    dstW?: number
    dstH?: number
    seq?: number
    members?: string[]
    depth?: number
    /** the format the readback itself is taken in, when targets are derived from a plain BGRA copy */
    mainFormat?: number
    /** FS_CONVERT_CHECK: also take the frame as BGRA so the worker can check the GPU convert */
    convertCheck?: boolean
    /** per-consumer sizes and formats produced in the same GPU pass */
    targets?: { width: number; height: number; format: number }[]
    memberTarget?: { [id: string]: number }
    memberFormats?: { [id: string]: number }
    memberSizes?: { [id: string]: { width: number; height: number } }
    /** the backend cannot produce targets: derive them from the readback instead */
    cpuTargets?: boolean
    /** consumers the worker serves directly */
    rtmpMembers?: { [id: string]: { width: number; height: number } }
    bmdMembers?: { [id: string]: { width: number; height: number; format: number; framerate: number } }
    webrtcMembers?: { [id: string]: { width: number; height: number } }
    presentMembers?: { [id: string]: { width: number; height: number } }
    stageStream?: { width: number; height: number; quality: number; intervalMs: number } | null
    serverStream?: { width: number; height: number; intervalMs: number } | null
    thumbStream?: { width: number; height: number; quality: number } | null
}

/** FS_CAP_STATS per-frame worker timeline (hop timestamps) */
export type CaptureTimeline = { recv: number; cS: number; cE: number; fS: number; fE: number; enq: number }

export class SenderCapture {
    /**
     * hand one readback of a shared render to the worker. `anySender` says whether any member of the
     * render has a network sender; an output with none still has work here when something asked for a
     * scaled frame: an OutputShow or stage viewer, a preview, or a window drawing the capture.
     */
    static captureFrame(id: string, source: any, opts: CaptureFrameOpts, anySender: boolean): boolean {
        const wantsScaled = !!opts.stageStream || !!opts.serverStream || ((opts.dstW || 0) > 0 && (opts.dstH || 0) > 0)
        const anyWorkerConsumer = Object.keys(opts.webrtcMembers || {}).length > 0 || Object.keys(opts.rtmpMembers || {}).length > 0 || Object.keys(opts.presentMembers || {}).length > 0 || !!opts.thumbStream || wantsScaled
        const worker = SenderThread.get()
        if ((!anySender && !anyWorkerConsumer) || !worker) return false
        worker.postMessage({ type: "captureFrame", id, source, opts })
        return true
    }

    static captureDoneCallbacks: { [id: string]: (seq: number, tl?: CaptureTimeline | null) => void } = {}
    static releaseTextureCallbacks: { [id: string]: (seq: number) => void } = {}

    // The features that own these replies register here rather than being imported, which would make a
    // cycle: the senders import this, and these features import the senders.
    static rtmpMessageHandler: ((msg: any) => void) | null = null
    static bmdMessageHandler: ((msg: any) => void) | null = null
    static webrtcMessageHandler: ((msg: any) => void) | null = null
    static presentMessageHandler: ((msg: any) => void) | null = null
    static previewMessageHandler: ((msg: any) => void) | null = null
    static videoLayerHandler: ((msg: any) => void) | null = null

    /** returns true when the message was a capture reply */
    static handleMessage(msg: any): boolean {
        if (msg.type === "releaseTexture") {
            // the GPU has consumed the shared texture: releasing it frees the frame pool
            this.releaseTextureCallbacks[msg.id]?.(msg.seq)
        } else if (msg.type === "captureDone") {
            // a pipeline slot frees, so the lifecycle may forward the next frame
            this.captureDoneCallbacks[msg.id]?.(msg.seq, msg.tl)
        } else if (msg.type === "serverFrame") {
            // produced as RGBA by the GPU; main forwards the bytes untouched
            CaptureHelper.Transmitter.sendServerFrame(msg.id, msg.buffer, msg.size)
        } else if (msg.type === "stageJpeg") {
            CaptureHelper.Transmitter.sendStageJpeg(msg.id, msg.jpeg, msg.size)
        } else if (msg.type === "thumbJpeg") {
            CaptureHelper.Transmitter.sendControllerThumbnail(msg.id, msg.jpeg, msg.size)
        } else if (String(msg.type).startsWith("rtmp")) {
            this.rtmpMessageHandler?.(msg)
        } else if (String(msg.type).startsWith("bmd")) {
            this.bmdMessageHandler?.(msg)
        } else if (String(msg.type).startsWith("preview")) {
            this.previewMessageHandler?.(msg)
        } else if (String(msg.type).startsWith("present")) {
            this.presentMessageHandler?.(msg)
        } else if (String(msg.type).startsWith("webrtc")) {
            this.webrtcMessageHandler?.(msg)
        } else if (msg.type === "videoFrame" || msg.type === "videoLayerActive") {
            this.videoLayerHandler?.(msg)
        } else return false
        return true
    }
}
