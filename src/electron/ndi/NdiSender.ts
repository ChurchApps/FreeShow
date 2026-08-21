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

    static timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
    static NDI: {
        [key: string]: {
            name: string
            groups?: string
            status?: string
            previousStatus?: string
            sender?: any
            timer?: NodeJS.Timeout
            sendingVideo?: boolean
            pendingVideoFrame?: any
            sendingAudio?: boolean
            audioQueue?: any[]
            paddedVideoBuffer?: Buffer
            paddedVideoBufferStride?: number
            paddedVideoBufferHeight?: number
        }
    } = {}

    static stopSenderNDI(id: string) {
        const senderData = this.NDI[id]
        if (!senderData) return

        console.info("NDI - stopping sender: " + (senderData.name || id))
        if (senderData.timer) {
            clearInterval(senderData.timer)
        }

        if (senderData.sender) {
            try {
                senderData.sender.destroy()
            } catch (err) {
                console.error("ERROR", err)
            }
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

    private static async sendQueuedAudioFrameNDI(id: string) {
        const senderData = this.NDI[id]
        if (!senderData?.sender || senderData.sendingAudio) return

        senderData.sendingAudio = true

        try {
            while (senderData.audioQueue && senderData.audioQueue.length > 0) {
                if (!this.NDI[id]?.sender) break

                // Limit queue to prevent excessive memory/latency if sending is falling behind
                if (senderData.audioQueue.length > 50) {
                    senderData.audioQueue.splice(0, senderData.audioQueue.length - 20)
                }

                const frame = senderData.audioQueue.shift()
                if (frame) {
                    await senderData.sender.audio(frame)
                }
            }
        } catch (err) {
            console.error("Error sending NDI audio frame:", err)
        } finally {
            senderData.sendingAudio = false
            if (this.NDI[id]?.sender && senderData.audioQueue && senderData.audioQueue.length > 0) {
                void this.sendQueuedAudioFrameNDI(id)
            }
        }
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    static async createSenderNDI(id: string, name = "", groups?: string) {
        if (this.NDI[id]) {
            this.stopSenderNDI(id)
        }

        this.NDI[id] = {
            name,
            groups
        }
        console.info("NDI - creating sender: " + this.NDI[id].name, groups ? `; In group: ${groups}` : "")

        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return

            /* eslint @typescript-eslint/await-thenable: 0 */
            const sender = await grandiose.send({
                name: this.NDI[id].name,
                groups: this.NDI[id].groups,
                clockVideo: false,
                clockAudio: false
            })

            // If stopSenderNDI was called while await grandiose.send was in progress
            if (!this.NDI[id]) {
                try {
                    sender.destroy()
                } catch {}
                return
            }

            this.NDI[id].sender = sender
        } catch (err) {
            console.error("Could not create NDI sender:", err)
            delete this.NDI[id]
            return
        }

        this.NDI[id].timer = setInterval(() => {
            if (!this.NDI[id]?.sender) return
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
        if (!senderData?.sender) return

        const grandiose = grandioseModule || (await loadGrandiose())
        if (!grandiose) return

        // Convert buffer format for NDI
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoBGRA(buffer)

        const fourCC = transparent ? grandiose.FOURCC_BGRA : grandiose.FOURCC_BGRX
        if (!transparent) util.ImageBufferAdjustment.BGRAtoBGRX(buffer)

        const timecode = (this.timeStart + process.hrtime.bigint()) / this.TIMECODE_DIVISOR

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

    static async sendAudioBufferNDITarget(id: string, buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        const senderData = this.NDI[id]
        if (!senderData?.sender || !buffer || buffer.length === 0) return

        const grandiose = grandioseModule || (await loadGrandiose())
        if (!grandiose) return

        const noSamples = Math.trunc(buffer.length / (channelCount * this.BYTES_PER_FLOAT32))
        if (noSamples <= 0) return

        const frame = {
            sampleRate,
            noChannels: channelCount,
            noSamples,
            channelStrideBytes: noSamples * this.BYTES_PER_FLOAT32,
            fourCC: grandiose.FOURCC_FLTp,
            data: buffer
        }

        if (!senderData.audioQueue) senderData.audioQueue = []
        senderData.audioQueue.push(frame)
        void this.sendQueuedAudioFrameNDI(id)
    }

    static async sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        const hasSender = Object.values(this.NDI).some((s) => s?.sender)
        if (!hasSender || !buffer || buffer.length === 0) return

        const grandiose = grandioseModule || (await loadGrandiose())
        if (!grandiose) return

        const noSamples = Math.trunc(buffer.length / (channelCount * this.BYTES_PER_FLOAT32))
        if (noSamples <= 0) return

        const frame = {
            sampleRate,
            noChannels: channelCount,
            noSamples,
            channelStrideBytes: noSamples * this.BYTES_PER_FLOAT32,
            fourCC: grandiose.FOURCC_FLTp,
            data: buffer
        }

        Object.keys(this.NDI).forEach((id) => {
            const senderData = this.NDI[id]
            if (!senderData?.sender) return

            if (!senderData.audioQueue) senderData.audioQueue = []
            senderData.audioQueue.push({ ...frame })
            void this.sendQueuedAudioFrameNDI(id)
        })
    }
}
