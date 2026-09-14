import { CaptureHelper } from "./CaptureHelper"

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
}

/** FS_CAP_STATS per-frame worker timeline (hop timestamps) */
export type CaptureTimeline = { recv: number; cS: number; cE: number; fS: number; fE: number; enq: number }

export class SenderCapture {
    static captureDoneCallbacks: { [id: string]: (seq: number, tl?: CaptureTimeline | null) => void } = {}
    static releaseTextureCallbacks: { [id: string]: (seq: number) => void } = {}

    /** returns true when the message was a capture reply */
    static handleMessage(msg: any): boolean {
        if (msg.type === "releaseTexture") {
            // the GPU has consumed the shared texture: releasing it frees the frame pool
            this.releaseTextureCallbacks[msg.id]?.(msg.seq)
        } else if (msg.type === "captureDone") {
            // a pipeline slot frees, so the lifecycle may forward the next frame
            this.captureDoneCallbacks[msg.id]?.(msg.seq, msg.tl)
        } else if (msg.type === "scaledFrame") {
            // the worker's GPU-downscaled BGRA copy, fanned out to every group member's server/stage consumers
            CaptureHelper.Transmitter.receiveScaledFrame(msg.members || [msg.id], msg.buffer, msg.byteOffset, msg.byteLength, msg.size)
        } else return false
        return true
    }
}
