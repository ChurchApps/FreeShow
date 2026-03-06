import type { NativeImage, Size } from "electron"
import os from "os"
import { toApp } from "../.."
import { OUTPUT, OUTPUT_STREAM } from "../../../types/Channels"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OutputHelper } from "../../output/OutputHelper"
import { getConnections, toServer } from "../../servers"
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"

export type Channel = {
    key: string
    captureId: string
    timer: NodeJS.Timeout
    lastFrameTime: number
}
export class CaptureTransmitter {
    private static readonly AUDIO_PRESENT_MARKER = Buffer.from([1])
    private static readonly IS_BIG_ENDIAN = os.endianness() === "BE"
    private static transmitCount = 0

    static stageWindows: string[] = []
    static requestList: string[] = []
    // static ndiFrameCount = 0
    static channels: { [key: string]: Channel } = {}
    private static lastFrameState: { [channelId: string]: { signature: number; sizeKey: string; lastSentAt: number } } = {}
    private static readonly UNCHANGED_KEEPALIVE_MS = 1000

    static getTransmitCount() {
        return this.transmitCount
    }

    static startTransmitting(captureId: string) {
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return
        // this.startChannel(captureId, "preview")

        const { ndi, blackmagic, server, stage } = captureOptions.options
        if (ndi) this.startChannel(captureId, "ndi")
        if (blackmagic) this.startChannel(captureId, "blackmagic")
        if (server) this.startChannel(captureId, "server")
        if (stage) this.startChannel(captureId, "stage")

        if (ndi) {
            // ENABLE TO TRACK NDI FRAME RATES
            /*
            console.log("SETTING INTERVAL");
            setInterval(() => {
                console.log("NDI FRAMES:", this.ndiFrameCount, " - ", captureId);
                this.ndiFrameCount = 0
            },1000);
            */
        }
    }

    // WIP one global capture (on the highest frame rate) instead of multiple per frame rate - but using multipe at once is probably an edge case
    static startChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        const fps = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.[key] || 30
        const interval = Math.max(1, Math.round(1000 / Math.max(1, fps)))
        // console.log("START CHANNEL:", key, interval)

        if (this.channels[combinedKey]?.timer) {
            clearInterval(this.channels[combinedKey].timer)
            this.channels[combinedKey].timer = setInterval(() => {}, interval)
        } else {
            this.channels[combinedKey] = {
                key,
                captureId,
                timer: setInterval(() => {}, interval), // Placeholder
                lastFrameTime: 0
            }
        }
    }

    static stopChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey]?.timer) return

        // console.log("STOP CHANNEL:", key)
        clearInterval(this.channels[combinedKey].timer)
        // Clear buffer reference to allow GC
        delete this.channels[combinedKey]

        if (key !== "blackmagic") delete this.lastFrameState[combinedKey]
    }

    private static getQuickSignature(buffer: Buffer): number {
        // Lightweight sampled hash to detect unchanged frames with low overhead.
        const len = buffer.length
        if (len === 0) return 0

        let hash = 2166136261
        const sampleCount = 64
        const step = Math.max(1, Math.floor(len / sampleCount))

        for (let i = 0; i < len; i += step) {
            hash ^= buffer[i]
            hash = Math.imul(hash, 16777619)
        }

        // Fold in length to avoid collisions across different sizes.
        hash ^= len
        return hash >>> 0
    }

    private static shouldSkipUnchangedNonBlackmagicFrame(channelKey: string, captureId: string, buffer: Buffer, size: { width: number; height: number }): boolean {
        const channelId = `${captureId}-${channelKey}`
        const signature = this.getQuickSignature(buffer)
        const sizeKey = `${size.width}x${size.height}`
        const now = Date.now()
        const previous = this.lastFrameState[channelId]

        // Skip unchanged frames for still content, but keep low-rate keepalive frames.
        if (previous && previous.signature === signature && previous.sizeKey === sizeKey && now - previous.lastSentAt < this.UNCHANGED_KEEPALIVE_MS) {
            return true
        }

        this.lastFrameState[channelId] = {
            signature,
            sizeKey,
            lastSentAt: now
        }

        return false
    }

    // New method: transmit frame immediately to all active channels
    static transmitFrame(captureId: string, image: NativeImage) {
        const now = Date.now()

        for (const [, channel] of Object.entries(this.channels)) {
            if (channel.captureId !== captureId) continue

            // Respect channel framerate - only send if enough time has passed
            const fps = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.[channel.key] || 30
            const minInterval = 1000 / fps
            if (now - channel.lastFrameTime < minInterval) continue

            channel.lastFrameTime = now
            this.transmitCount++
            this.sendFrameToChannel(captureId, channel.key, image)
        }
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
                const outputshowConnections = getConnections("OUTPUT_STREAM")
                const reduceSize = outputshowConnections > 20 ? 0.3 : outputshowConnections > 10 ? 0.5 : outputshowConnections > 5 ? 0.7 : 0.8
                this.sendBufferToServer(captureId, image.resize({ width: size.width * reduceSize, height: size.height * reduceSize, quality: "good" }))
                break
            case "stage":
                this.sendBufferToMain(captureId, image)
                break
        }
    }

    // NDI
    static sendBufferToNdi(captureId: string, image: NativeImage, { size }: { size: { width: number; height: number } }) {
        if (!NdiSender.NDI[captureId]?.sender) return

        const buffer = image.toBitmap()
        const ratio = image.getAspectRatio()

        if (this.shouldSkipUnchangedNonBlackmagicFrame("ndi", captureId, buffer, size)) return

        // this.ndiFrameCount++
        // WIP refresh on enable?
        NdiSender.sendVideoBufferNDI(captureId, buffer, { size, ratio, framerate: OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.ndi || 10 })
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
        if (!image) return

        // Check if Blackmagic can accept frame BEFORE expensive bitmap conversion
        if (!BlackmagicSender.canAcceptFrame(captureId)) {
            return
        }

        // Force 1x extraction to avoid Retina/HiDPI oversized buffers.
        const buffer = image.toBitmap({ scaleFactor: 1 })

        // CRITICAL: Release the NativeImage immediately after conversion to prevent memory accumulation
        // NativeImage holds external memory that won't be GC'd until explicitly released
        image = null as any

        const framerate = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.blackmagic
        if (!framerate) return

        // Pass a non-null marker to indicate audio should be extracted from queued audio.
        const audioBuffer = BlackmagicSender.audioQueueLength > 0 ? this.AUDIO_PRESENT_MARKER : null

        BlackmagicSender.scheduleFrame(captureId, buffer, audioBuffer, framerate)
    }

    // MAIN (STAGE OUTPUT)
    static sendBufferToMain(captureId: string, image: NativeImage) {
        if (!image) return
        // image = this.resizeImage(image, options.size, previewSize)

        const buffer = image.toBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (this.IS_BIG_ENDIAN) util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        if (this.shouldSkipUnchangedNonBlackmagicFrame("stage", captureId, buffer, size)) return

        // DEBUG YUV
        // // console.log(os.endianness()) // LE
        // // if (os.endianness() === "BE") buffer = ImageBufferConverter.BGRAtoYUV(buffer)
        // // else buffer = ImageBufferConverter.ARGBtoYUV(buffer)
        // if (os.endianness() === "BE") buffer = ImageBufferConverter.ARGBtoYUV(buffer, size)
        // else buffer = ImageBufferConverter.BGRAtoYUV(buffer, size)

        const msg = { channel: "BUFFER", data: { id: captureId, time: Date.now(), buffer, size } }
        toApp(OUTPUT, msg)
        this.sendToStageOutputs(msg, captureId) // don't send to itself
        this.sendToRequested(msg)
    }

    // SERVER

    // const outputServerSize: Size = { width: 1280, height: 720 }
    static sendBufferToServer(outputId: string, image: NativeImage) {
        // capture: CaptureOptions
        if (!image) return

        // send output image size
        // image = image.resize({ width: size.width / 3, height: size.height / 3, quality: "good" })
        // image = this.resizeImage(image, size, { width: size.width / 3, height: size.height / 3 })

        const buffer = image.toBitmap() // {scaleFactor: 0.5}
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (this.IS_BIG_ENDIAN) util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        if (this.shouldSkipUnchangedNonBlackmagicFrame("server", outputId, buffer, size)) return

        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, time: Date.now(), buffer, size } })
    }

    static requestPreview(data: { id: string; previewId: string }) {
        this.requestList.push(JSON.stringify(data))
    }

    static removeAllChannels(captureId: string) {
        Object.keys(this.channels).forEach((key) => {
            if (key.includes(captureId)) this.removeChannel(captureId, key)
        })
    }

    static removeChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey]) return
        if (this.channels[combinedKey].timer) clearInterval(this.channels[combinedKey].timer)
        delete this.channels[combinedKey]
    }
}
