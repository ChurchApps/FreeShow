import { runSenderWorker, frameTimestamp, type SenderAdapter, type VideoFrameOpts } from "../capture/senderWorker"
import { loadOMT } from "./omtModule"

// OMT adapter for the shared sender engine (../capture/senderWorker): everything libomt-specific.
//
// Resources:
// https://github.com/openmediatransport/libomtnet
// https://github.com/schplay/openmediatransport-node

const BYTES_PER_FLOAT32 = 4

function mapQuality(omt: any, quality?: number | string): number {
    if (typeof quality === "number") return quality
    const q = omt.Quality
    switch (String(quality || "").toLowerCase()) {
        case "low":
            return q.Low
        case "medium":
            return q.Medium
        case "high":
            return q.High
        default:
            return q.Default
    }
}

const omtAdapter: SenderAdapter = {
    tag: "omt",
    label: "OMT",
    load: loadOMT,
    // a quality change recreates the sender, and the replacement rebinds the same port
    recreateDelayMs: 250,

    async create(omt: any, _id: string, msg: any) {
        const sender = new omt.Sender(msg.name, mapQuality(omt, msg.quality))
        if (!sender) return null
        return { sender, sendFrame: (frame: any) => sender.send(frame), sendAudio: (frame: any) => sender.send(frame), tsKey: "timestamp" }
    },
    connections: (sender: any) => sender?.connections || 0,
    destroy: (sender: any) => sender.destroy(),

    // the encoder takes the readback in whatever format it arrived
    prepareVideo: (_omt: any, buffer: Buffer, _size, format: number) => ({ data: buffer, format }),

    videoFrame(omt: any, data: Buffer, { size, ratio, framerate, transparent, format }: VideoFrameOpts) {
        const uyvy = format === 1 || format === 2
        const hasAlpha = format === 2 || (format === 0 && transparent)
        return {
            type: omt.FrameType.Video,
            timestamp: frameTimestamp(),
            codec: uyvy ? (format === 2 ? omt.Codec.UYVA : omt.Codec.UYVY) : omt.Codec.BGRA,
            width: size.width,
            height: size.height,
            stride: size.width * (uyvy ? 2 : 4),
            flags: hasAlpha ? omt.VideoFlags.Alpha : omt.VideoFlags.None,
            frameRateN: Math.round(framerate * 1000),
            frameRateD: 1000,
            aspectRatio: ratio,
            colorSpace: omt.ColorSpace.Undefined,
            data
        }
    },

    // planar Float32 LE (the processAudio contract) is OMT's FPA1 format directly
    audioFrame(omt: any, buffer: Buffer, sampleRate: number, channelCount: number) {
        const samplesPerChannel = Math.trunc(buffer.byteLength / channelCount / BYTES_PER_FLOAT32)
        if (samplesPerChannel <= 0) return null

        return {
            type: omt.FrameType.Audio,
            timestamp: frameTimestamp(),
            codec: omt.Codec.FPA1,
            sampleRate,
            channels: channelCount,
            samplesPerChannel,
            data: buffer
        }
    }
}

runSenderWorker(omtAdapter)
