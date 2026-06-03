import type { NativeImage, Size } from "electron"
import os from "os"
import { toApp } from "../.."
import { OUTPUT, OUTPUT_STREAM } from "../../../types/Channels"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OutputHelper } from "../../output/OutputHelper"
import { getConnections, toServer } from "../../servers"
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { WebRtcHost } from "../../webrtc/WebRtcHost"
import { CaptureHelper } from "../CaptureHelper"

export type Channel = {
    key: string
    captureId: string
    timer?: NodeJS.Timeout
    lastFrameTime: number
}
export class CaptureTransmitter {
    private static readonly AUDIO_PRESENT_MARKER = Buffer.from([1])
    private static readonly IS_BIG_ENDIAN = os.endianness() === "BE"
    private static readonly UNCHANGED_KEEPALIVE_MS = 250
    private static readonly SERVER_RESIZE_THRESHOLDS = [
        { connections: 20, scale: 0.3 },
        { connections: 10, scale: 0.5 },
        { connections: 5, scale: 0.7 }
    ]
    private static readonly DEFAULT_SERVER_SCALE = 0.8
    private static readonly FPS_EPSILON_HIGH = 10.0
    private static readonly FPS_EPSILON_LOW = 1.0
    private static readonly SIGNATURE_GRID_X = 24
    private static readonly SIGNATURE_GRID_Y = 14
    private static readonly FNV_OFFSET_BASIS = 2166136261
    private static readonly FNV_PRIME = 16777619
    private static readonly SIGNATURE_FALLBACK_SAMPLES = 128

    static stageWindows: string[] = []
    static requestList: string[] = []
    static channels: { [key: string]: Channel } = {}
    private static lastFrameState: { [channelId: string]: { signature: number; sizeKey: string; lastSentAt: number } } = {}
    private static signatureOffsetCache: { [sizeKey: string]: number[] } = {}

    static startTransmitting(captureId: string) {
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const channelKeys = ["ndi", "blackmagic", "server", "stage", "webrtc"]
        channelKeys.forEach((key) => {
            if (captureOptions.options[key]) this.startChannel(captureId, key)
        })
    }

    static startChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (this.channels[combinedKey]) return

        this.channels[combinedKey] = { key, captureId, lastFrameTime: 0 }
    }

    static stopChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey]) return

        delete this.channels[combinedKey]
        if (key !== "blackmagic") delete this.lastFrameState[combinedKey]
    }

    private static getSignatureOffsets(width: number, height: number): number[] {
        const sizeKey = `${width}x${height}`
        const cached = this.signatureOffsetCache[sizeKey]
        if (cached) return cached

        const stride = width * 4
        const offsets: number[] = []
        const xStep = Math.max(1, Math.floor(width / this.SIGNATURE_GRID_X))
        const yStep = Math.max(1, Math.floor(height / this.SIGNATURE_GRID_Y))

        for (let y = Math.floor(yStep / 2); y < height; y += yStep) {
            const rowOffset = y * stride
            for (let x = Math.floor(xStep / 2); x < width; x += xStep) {
                offsets.push(rowOffset + x * 4)
            }
        }

        this.signatureOffsetCache[sizeKey] = offsets
        return offsets
    }

    /**
     * Public method for computing frame signatures (used by CaptureLifecycle)
     */
    static computeFrameSignature(buffer: Buffer, size: { width: number; height: number }): number {
        return this.getQuickSignature(buffer, size)
    }

    private static getQuickSignature(buffer: Buffer, size: { width: number; height: number }): number {
        const len = buffer.length
        if (len === 0) return 0

        const width = Math.max(1, size.width | 0)
        const height = Math.max(1, size.height | 0)
        const expectedLen = width * height * 4
        if (expectedLen <= 0 || len < 4) return len >>> 0

        if (len < expectedLen) return this.calculateFallbackHash(buffer, len)
        return this.calculateFullHash(buffer, width, height, len)
    }

    private static calculateFallbackHash(buffer: Buffer, len: number): number {
        let hash = this.FNV_OFFSET_BASIS
        const step = Math.max(1, Math.floor(len / this.SIGNATURE_FALLBACK_SAMPLES))
        for (let i = 0; i < len; i += step) {
            hash ^= buffer[i]
            hash = Math.imul(hash, this.FNV_PRIME)
        }
        hash ^= len
        return hash >>> 0
    }

    private static calculateFullHash(buffer: Buffer, width: number, height: number, len: number): number {
        let hash = this.FNV_OFFSET_BASIS
        const offsets = this.getSignatureOffsets(width, height)

        for (const pixelOffset of offsets) {
            if (pixelOffset + 2 >= len) break
            // Sample B, G and R bytes (alpha is often constant)
            hash ^= buffer[pixelOffset]
            hash = Math.imul(hash, this.FNV_PRIME)
            hash ^= buffer[pixelOffset + 1]
            hash = Math.imul(hash, this.FNV_PRIME)
            hash ^= buffer[pixelOffset + 2]
            hash = Math.imul(hash, this.FNV_PRIME)
        }

        hash ^= width
        hash = Math.imul(hash, this.FNV_PRIME)
        hash ^= height
        hash = Math.imul(hash, this.FNV_PRIME)
        hash ^= len
        return hash >>> 0
    }

    private static shouldSkipUnchangedNonBlackmagicFrame(channelKey: string, captureId: string, buffer: Buffer, size: { width: number; height: number }): boolean {
        const channelId = `${captureId}-${channelKey}`
        const sizeKey = `${size.width}x${size.height}`
        const now = performance.now()
        const previous = this.lastFrameState[channelId]

        // Skip unchanged frames for still content, but keep low-rate keepalive frames.
        if (previous && previous.sizeKey === sizeKey && now - previous.lastSentAt < this.UNCHANGED_KEEPALIVE_MS) {
            const signature = this.getQuickSignature(buffer, size)
            if (previous.signature === signature) {
                return true
            }

            this.lastFrameState[channelId] = { signature, sizeKey, lastSentAt: now }
        } else {
            const signature = this.getQuickSignature(buffer, size)
            this.lastFrameState[channelId] = { signature, sizeKey, lastSentAt: now }
        }

        return false
    }

    static transmitFrame(captureId: string, image: NativeImage, captureTimestamp?: number) {
        const frameTimestamp = captureTimestamp ?? performance.now()
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const framerates = captureOptions.framerates

        // free the lifecycle loop immediately
        setImmediate(() => {
            if (image.isEmpty()) return

            const baseCaptureFrameRate = CaptureHelper.getMaxActiveFramerate(framerates || {}, captureOptions.options || {})

            for (const channel of Object.values(this.channels)) {
                if (channel.captureId !== captureId) continue

                const fps = framerates?.[channel.key] || 30
                const minInterval = 1000 / fps
                const timeSinceLastFrame = frameTimestamp - channel.lastFrameTime

                const epsilon = fps >= baseCaptureFrameRate ? this.FPS_EPSILON_HIGH : this.FPS_EPSILON_LOW
                if (timeSinceLastFrame < minInterval - epsilon) {
                    continue
                }

                channel.lastFrameTime = frameTimestamp

                this.sendFrameToChannel(captureId, channel.key, image)
            }
        })
    }

    private static sendFrameToChannel(captureId: string, key: string, image: NativeImage) {
        const size = image.getSize()
        if (!size.width || !size.height) return

        switch (key) {
            case "ndi":
                this.sendBufferToNdi(captureId, image, { size })
                break
            case "blackmagic":
                this.sendBufferToBlackmagic(captureId, image)
                break
            case "server":
                const scale = this.getServerScale()
                this.sendBufferToServer(captureId, image.resize({ width: size.width * scale, height: size.height * scale, quality: "good" }))
                break
            case "stage":
                this.sendBufferToMain(captureId, image)
                break
            case "webrtc":
                this.sendBufferToWebRtcHost(captureId, image)
                break
        }
    }

    private static getServerScale(): number {
        const connections = getConnections("OUTPUT_STREAM")
        for (const { connections: threshold, scale } of this.SERVER_RESIZE_THRESHOLDS) {
            if (connections > threshold) return scale
        }
        return this.DEFAULT_SERVER_SCALE
    }

    // NDI
    static sendBufferToNdi(captureId: string, image: NativeImage, { size }: { size: { width: number; height: number } }) {
        if (!NdiSender.NDI[captureId]?.sender) return

        const buffer = image.toBitmap()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("ndi", captureId, buffer, size)) return

        const output = OutputHelper.getOutput(captureId)
        const ratio = image.getAspectRatio()
        const transparent = output?.transparent !== false
        const framerate = output?.captureOptions?.framerates?.ndi || 30

        NdiSender.sendVideoBufferNDI(captureId, buffer, { size, ratio, framerate, transparent })
    }

    private static convertToRGBA(buffer: Buffer): void {
        if (this.IS_BIG_ENDIAN) util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width, quality: "good" })
        else image = image.resize({ height: newSize.height, quality: "good" })

        return image
    }

    static sendToStageOutputs(msg: any, excludeId = "") {
        const seen = new Set<string>()
        for (const id of this.stageWindows) {
            if (id === excludeId || seen.has(id)) continue
            seen.add(id)
            OutputHelper.Send.sendToWindow(id, msg)
        }
    }

    static sendToRequested(msg: any) {
        const newList: string[] = []

        const seen = new Set<string>()
        for (const dataString of this.requestList) {
            if (seen.has(dataString)) continue
            seen.add(dataString)
            const data: { id: string; previewId: string } = JSON.parse(dataString)

            if (data.previewId !== msg.data?.id) {
                newList.push(JSON.stringify(data))
                continue
            }

            OutputHelper.Send.sendToWindow(data.id, msg)
        }

        this.requestList = newList
    }

    // BLACKMAGIC
    static sendBufferToBlackmagic(captureId: string, image: NativeImage) {
        if (!image || !BlackmagicSender.canAcceptFrame(captureId)) return

        const buffer = image.toBitmap({ scaleFactor: 1 })
        // release immediately to prevent memory accumulation
        image = null as any

        const framerate = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.blackmagic
        if (!framerate) return

        const audioBuffer = BlackmagicSender.audioQueueLength > 0 ? this.AUDIO_PRESENT_MARKER : null
        BlackmagicSender.scheduleFrame(captureId, buffer, audioBuffer, framerate)
    }

    // MAIN (STAGE OUTPUT)
    static sendBufferToMain(captureId: string, image: NativeImage) {
        if (!image) return
        // image = this.resizeImage(image, options.size, previewSize)

        const buffer = image.toBitmap()
        const size = image.getSize()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("stage", captureId, buffer, size)) return

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)

        const msg = { channel: "BUFFER", data: { id: captureId, time: Date.now(), buffer, size } }
        toApp(OUTPUT, msg)
        this.sendToStageOutputs(msg, captureId)
        this.sendToRequested(msg)
    }

    // SERVER
    static sendBufferToServer(outputId: string, image: NativeImage) {
        if (!image) return

        // send output image size
        // image = image.resize({ width: size.width / 3, height: size.height / 3, quality: "good" })
        // image = this.resizeImage(image, size, { width: size.width / 3, height: size.height / 3 })

        const buffer = image.toBitmap() // {scaleFactor: 0.5}
        const size = image.getSize()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("server", outputId, buffer, size)) return

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)
        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, time: Date.now(), buffer, size } })
    }

    // WEBRTC
    static sendBufferToWebRtcHost(outputId: string, image: NativeImage) {
        if (!image || !WebRtcHost.isRunning()) return

        const buffer = image.toBitmap()
        const size = image.getSize()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("webrtc", outputId, buffer, size)) return

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)
        WebRtcHost.sendFrame(outputId, buffer, size)
    }

    static requestPreview(data: { id: string; previewId: string }) {
        this.requestList.push(JSON.stringify(data))
    }

    static removeAllChannels(captureId: string) {
        const keysToRemove = Object.keys(this.channels).filter((key) => key.startsWith(`${captureId}-`))
        for (const key of keysToRemove) {
            delete this.channels[key]
        }
    }
}
