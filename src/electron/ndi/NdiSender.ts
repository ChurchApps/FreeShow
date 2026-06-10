import os from "os"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import util from "./vingester-util"

// Dynamic import for grandiose ES module to prevent TypeScript compilation issues
let warned = false
let grandioseModule: any | null = null
let grandiosePromise: Promise<any | null> | null = null
const loadGrandiose = async () => {
    if (grandioseModule) return grandioseModule
    if (grandiosePromise) return grandiosePromise

    grandiosePromise = import("grandiose")
        .then((imported) => {
            grandioseModule = imported
            return imported
        })
        .catch((err: any) => {
            if (!warned) console.warn("NDI not available:", err?.message || err)
            warned = true
            return null
        })
        .finally(() => {
            grandiosePromise = null
        })

    return grandiosePromise
}

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

export class NdiSender {
    private static readonly BYTES_PER_PIXEL = 4
    private static readonly BYTES_PER_FLOAT32 = 4
    private static readonly PADDING_ALIGNMENT = 16
    private static readonly CONNECTION_POLL_INTERVAL_MS = 1000
    private static readonly TIMECODE_DIVISOR = BigInt(100)

    static NDI: {
        [key: string]: {
            name: string
            groups?: string
            status?: string
            previousStatus?: string
            sender?: any
            timer?: NodeJS.Timeout
            sendAudio?: boolean
            sendingVideo?: boolean
            pendingVideoFrame?: any
            paddedVideoBuffer?: Buffer
            paddedVideoBufferStride?: number
            paddedVideoBufferHeight?: number
            timeStart?: bigint
            frameNumber?: number
            lastFramerate?: number
            audioSamplesSent?: bigint
        }
    } = {}

    static stopSenderNDI(id: string) {
        if (!this.NDI[id]?.timer) return

        console.info("NDI - stopping sender: " + this.NDI[id].name)
        clearInterval(this.NDI[id].timer)

        try {
            this.NDI[id].sender.destroy()
        } catch (err) {
            console.error("ERROR", err)
        }

        delete this.NDI[id]
    }

    private static async sendQueuedVideoFrameNDI(id: string) {
        const senderData = this.NDI[id]
        if (!senderData?.sender || senderData.sendingVideo) return

        const frame = senderData.pendingVideoFrame
        if (!frame) return

        senderData.pendingVideoFrame = undefined
        senderData.sendingVideo = true

        try {
            await senderData.sender.video(frame)
        } catch (err) {
            console.error("Error sending NDI video frame:", err)
        } finally {
            senderData.sendingVideo = false
            if (senderData.pendingVideoFrame) {
                void this.sendQueuedVideoFrameNDI(id)
            }
        }
    }

    private static calculateTimeStart(): bigint {
        return BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
    }

    private static calculateTimecode(timeStart: bigint, frameNumber: number, framerate: number): bigint {
        const frameIntervalNs = BigInt(Math.round((1000 / framerate) * 1e6))
        return (timeStart + BigInt(frameNumber) * frameIntervalNs) / this.TIMECODE_DIVISOR
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    static async createSenderNDI(id: string, name = "", groups?: string) {
        if (this.NDI[id]) return

        this.NDI[id] = {
            name,
            groups,
            timeStart: this.calculateTimeStart(),
            frameNumber: 0,
            lastFramerate: 0
        }
        console.info("NDI - creating sender: " + this.NDI[id].name, groups ? `; In group: ${groups}` : "")

        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return

            /* eslint @typescript-eslint/await-thenable: 0 */
            this.NDI[id].sender = await grandiose.send({
                name: this.NDI[id].name,
                groups: this.NDI[id].groups,
                clockVideo: false,
                clockAudio: false
            })
        } catch (err) {
            console.error("Could not create NDI sender:", err)
            delete this.NDI[id]
            return
        }

        this.NDI[id].timer = setInterval(() => {
            /*  poll NDI for connections  */
            const conns: number = this.NDI[id].sender?.connections() || 0
            this.NDI[id].status = conns > 0 ? "connected" : "unconnected"

            const newStatus = String(this.NDI[id].status) + conns.toString()
            if (newStatus !== this.NDI[id].previousStatus) {
                toApp("NDI", { channel: "SEND_DATA", data: { id, status: this.NDI[id].status, connections: conns } })
                CaptureHelper.updateFramerate(id)

                this.NDI[id].previousStatus = newStatus

                if (this.NDI[id].status === "connected") {
                    console.log(`[NDI] Reconnected for ${id}`)
                }
            }
        }, this.CONNECTION_POLL_INTERVAL_MS)
    }

    static async sendVideoBufferNDI(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1, transparent = true }) {
        const senderData = this.NDI[id]
        if (!senderData?.timeStart || !senderData.sender) return

        const grandiose = await loadGrandiose()
        if (!grandiose) return

        // Convert buffer format for NDI
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoBGRA(buffer)

        const fourCC = transparent ? grandiose.FOURCC_BGRA : grandiose.FOURCC_BGRX
        if (!transparent) util.ImageBufferAdjustment.BGRAtoBGRX(buffer)

        // reset frame counter on framerate change to prevent accumulated delay
        if (senderData.lastFramerate !== framerate) {
            senderData.frameNumber = 0
            senderData.lastFramerate = framerate
            senderData.timeStart = this.calculateTimeStart()
            senderData.audioSamplesSent = BigInt(0)
        }

        const timecode = this.calculateTimecode(senderData.timeStart, senderData.frameNumber ?? 0, framerate)
        senderData.frameNumber = (senderData.frameNumber ?? 0) + 1

        // Pad width to 16-byte alignment for NDI
        const paddedWidth = (size.width + this.PADDING_ALIGNMENT - 1) & ~(this.PADDING_ALIGNMENT - 1)
        const stride = paddedWidth * this.BYTES_PER_PIXEL
        const sendBuffer = this.getPaddedBuffer(senderData, buffer, size, stride, paddedWidth)

        senderData.pendingVideoFrame = {
            timecode,
            xres: paddedWidth,
            yres: size.height,
            frameRateN: framerate * 1000,
            frameRateD: 1000,
            pictureAspectRatio: ratio,
            frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
            lineStrideBytes: stride,
            fourCC,
            data: sendBuffer
        }

        void this.sendQueuedVideoFrameNDI(id)
    }

    private static getPaddedBuffer(senderData: any, buffer: Buffer, size: { width: number; height: number }, stride: number, paddedWidth: number): Buffer {
        if (paddedWidth === size.width) return buffer

        // reuse cached buffer if dimensions match
        if (senderData.paddedVideoBuffer && senderData.paddedVideoBufferStride === stride && senderData.paddedVideoBufferHeight === size.height) {
            const cachedBuffer = senderData.paddedVideoBuffer
            this.copyRowsToPaddedBuffer(buffer, cachedBuffer, size, stride)
            return cachedBuffer
        }

        const paddedBuffer = Buffer.alloc(stride * size.height)
        senderData.paddedVideoBuffer = paddedBuffer
        senderData.paddedVideoBufferStride = stride
        senderData.paddedVideoBufferHeight = size.height

        this.copyRowsToPaddedBuffer(buffer, paddedBuffer, size, stride)
        return paddedBuffer
    }

    private static copyRowsToPaddedBuffer(source: Buffer, dest: Buffer, size: { width: number; height: number }, stride: number): void {
        const rowBytes = size.width * this.BYTES_PER_PIXEL
        for (let y = 0; y < size.height; y++) {
            source.copy(dest, y * stride, y * rowBytes, (y + 1) * rowBytes)
        }
    }

    static enableAudio(id: string) {
        if (!this.NDI[id]) return
        this.NDI[id].sendAudio = true
    }

    static disableAudio(id: string) {
        if (!this.NDI[id]) return
        this.NDI[id].sendAudio = false
    }

    static async sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        const activeSender = Object.values(this.NDI).find((s) => s?.sendAudio && s?.timeStart)
        if (!activeSender?.timeStart) return

        const ndiAudioBuffer = convertPCMtoPlanarFloat32(buffer, channelCount)
        if (!ndiAudioBuffer) return

        const grandiose = await loadGrandiose()
        if (!grandiose) return

        const noSamples = Math.trunc(ndiAudioBuffer.byteLength / channelCount / this.BYTES_PER_FLOAT32)

        if (activeSender.audioSamplesSent === undefined) activeSender.audioSamplesSent = BigInt(0)

        const timecode = (activeSender.timeStart + (activeSender.audioSamplesSent * BigInt(1000000000)) / BigInt(sampleRate)) / this.TIMECODE_DIVISOR
        activeSender.audioSamplesSent += BigInt(noSamples)

        const frame = {
            timecode,
            sampleRate,
            noChannels: channelCount,
            noSamples: Math.trunc(ndiAudioBuffer.byteLength / channelCount / this.BYTES_PER_FLOAT32),
            channelStrideBytes: Math.trunc(ndiAudioBuffer.byteLength / channelCount),
            fourCC: grandiose.FOURCC_FLTp,
            data: ndiAudioBuffer
        }

        Object.values(this.NDI).forEach((data) => {
            if (!data?.sendAudio || !data?.sender) return

            try {
                data.sender.audio(frame)
            } catch (err) {
                console.error("Error sending NDI audio frame:", err)
            }
        })
    }
}

// convert from PCM/signed-16-bit/little-endian data to NDI's "PCM/planar/signed-float32/little-endian"
function convertPCMtoPlanarFloat32(buffer: Buffer, channels: number) {
    try {
        const pcmconvert = require("pcm-convert")
        return pcmconvert(buffer, { channels, dtype: "int16", endianness: "le", interleaved: true }, { dtype: "float32", endianness: "le", interleaved: false }) as Buffer
    } catch (err) {
        console.error("Could not convert audio")
        return null
    }
}
