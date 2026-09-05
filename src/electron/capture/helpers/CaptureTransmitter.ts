import { nativeImage, type NativeImage, type Size } from "electron"
import os from "os"
import { OUTPUT_STREAM } from "../../../types/Channels"
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OutputHelper } from "../../output/OutputHelper"
import { slugifyStreamPath } from "../../output/OutputStreamRouter"
import { getConnections, getStageStreamSubscriberIds, toServer, toStageStreamSubscribers } from "../../servers"
import { RtmpStreamer } from "../../streaming/RtmpStreamer"
import { WebRtcHost } from "../../streaming/WebRtcHost"
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
    private static readonly UNCHANGED_KEEPALIVE_MS = 1000
    private static readonly REQUEST_LIST_MAX = 100
    // StageShow "Output window" items: push JPEG frames directly to connected clients
    private static readonly STAGE_PUSH_MIN_INTERVAL_MS = 100 // max 10fps
    private static readonly STAGE_FRAME_MAX_WIDTH = 1280

    private static readonly SERVER_RESIZE_THRESHOLDS = [
        { connections: 20, scale: 0.3 },
        { connections: 10, scale: 0.5 },
        { connections: 5, scale: 0.7 }
    ]
    private static readonly DEFAULT_SERVER_SCALE = 0.8
    private static readonly FPS_EPSILON_HIGH = 10.0
    private static readonly FPS_EPSILON_LOW = 1.0
    private static readonly SIGNATURE_GRID_X = 64
    private static readonly SIGNATURE_GRID_Y = 36
    private static readonly FNV_OFFSET_BASIS = 2166136261
    private static readonly FNV_PRIME = 16777619
    private static readonly SIGNATURE_FALLBACK_SAMPLES = 128
    private static readonly SIGNATURE_JITTER_STEPS = 4

    static requestList: string[] = []
    static channels: { [key: string]: Channel } = {}
    private static lastFrameState: { [channelId: string]: { signature: number; sizeKey: string; lastSentAt: number } } = {}
    private static signatureOffsetCache: { [sizeKey: string]: number[] } = {}
    // last time any channel of a capture observed changed frame content (used for idle frame rate backoff)
    private static lastChangeTimes: { [captureId: string]: number } = {}
    private static lastStagePushTimes: { [captureId: string]: number } = {}

    static startTransmitting(captureId: string) {
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const channelKeys = ["ndi", "blackmagic", "server", "stage", "webrtc", "rtmp"]
        channelKeys.forEach((key) => {
            if (captureOptions.options[key]) this.startChannel(captureId, key)
        })
    }

    static startChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (this.channels[combinedKey]) return

        this.channels[combinedKey] = { key, captureId, lastFrameTime: 0 }
        // start at full frame rate until content proves static
        this.lastChangeTimes[captureId] = performance.now()
    }

    static stopChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey]) return

        delete this.channels[combinedKey]
        if (key !== "blackmagic") delete this.lastFrameState[combinedKey]
        if (key === "stage") {
            delete this.lastStagePushTimes[captureId]
        }

        const hasRemainingChannels = Object.keys(this.channels).some((k) => k.startsWith(`${captureId}-`))
        if (!hasRemainingChannels) delete this.lastChangeTimes[captureId]
    }

    // Choose shared-texture readback/convert target: 0=BGRA, 1=UYVY (opaque), 2=UYVA (transparency), 3=RGBA
    static getReadbackFormat(captureId: string, size?: Size): number {
        const keys = Object.keys(this.channels)
            .filter((k) => k.startsWith(`${captureId}-`))
            .map((k) => this.channels[k].key)
        if (keys.length !== 1) return 0
        const only = keys[0]
        if (only === "ndi") {
            const transparent = OutputHelper.getOutput(captureId)?.transparent === true
            return transparent ? 2 : 1
        }
        if (only === "blackmagic" && size && BlackmagicSender.canAcceptRawUyvy(captureId, size)) return 1
        if (only === "webrtc") return 3
        return 0
    }

    // Returns non-NDI consumers eligible for off-main capture (server/stage), or null if full-res path needed
    static getHeavyOffMainConsumers(captureId: string): string[] | null {
        const nonNdi = Object.keys(this.channels)
            .filter((k) => k.startsWith(`${captureId}-`))
            .map((k) => this.channels[k].key)
            .filter((key) => key !== "ndi")
        if (nonNdi.some((key) => key !== "server" && key !== "stage")) return null
        return nonNdi
    }

    // Downscale target for server/stage previews
    static getScaledTarget(size: Size): { dstW: number; dstH: number } {
        const dstW = Math.min(size.width, this.HEAVY_IMAGE_MAX_WIDTH)
        const dstH = Math.max(1, Math.round((dstW * size.height) / size.width))
        return { dstW, dstH }
    }

    // Checks if all members of a group only use NDI, server, or stage
    static groupOffMainInfo(memberIds: string[]): { eligible: boolean; needsScaled: boolean } {
        let needsScaled = false
        for (const id of memberIds) {
            const nonNdi = Object.keys(this.channels)
                .filter((k) => k.startsWith(`${id}-`))
                .map((k) => this.channels[k].key)
                .filter((key) => key !== "ndi")
            if (nonNdi.some((key) => key !== "server" && key !== "stage")) return { eligible: false, needsScaled: false }
            if (nonNdi.length) needsScaled = true
        }
        return { eligible: true, needsScaled }
    }

    // Dispatches downscaled frame from worker to server/stage channels
    static receiveScaledFrame(memberIds: string[], buffer: ArrayBuffer, byteOffset: number, byteLength: number, size: Size) {
        const image = nativeImage.createFromBitmap(Buffer.from(buffer, byteOffset, byteLength), size)
        if (image.isEmpty()) return
        for (const id of memberIds) {
            for (const key of ["server", "stage"]) {
                if (this.channels[`${id}-${key}`]) this.sendFrameToChannel(id, key, image)
            }
        }
    }

    static getTimeSinceLastChange(captureId: string): number {
        const lastChange = this.lastChangeTimes[captureId]
        if (lastChange === undefined) return 0
        return performance.now() - lastChange
    }

    private static getSignatureOffsets(width: number, height: number): number[] {
        const sizeKey = `${width}x${height}`
        const cached = this.signatureOffsetCache[sizeKey]
        if (cached) return cached

        const stride = width * 4
        const offsets: number[] = []
        const xStep = Math.max(1, Math.floor(width / this.SIGNATURE_GRID_X))
        const yStep = Math.max(1, Math.floor(height / this.SIGNATURE_GRID_Y))

        // Basic grid
        for (let y = Math.floor(yStep / 2); y < height; y += yStep) {
            const rowOffset = y * stride
            for (let x = Math.floor(xStep / 2); x < width; x += xStep) {
                offsets.push(rowOffset + x * 4)
            }
        }

        // Add additional sample points for jitter/interlacing
        // This samples slightly different locations that rotate over time
        for (let i = 1; i < this.SIGNATURE_JITTER_STEPS; i++) {
            const xOffset = Math.floor((xStep * i) / this.SIGNATURE_JITTER_STEPS)
            const yOffset = Math.floor((yStep * i) / this.SIGNATURE_JITTER_STEPS)
            for (let y = yOffset; y < height; y += yStep * 2) {
                const rowOffset = y * stride
                for (let x = xOffset; x < width; x += xStep * 2) {
                    offsets.push(rowOffset + x * 4)
                }
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

        // Calculate hash using all pre-calculated offsets.
        // Given we increased the count with jittered sampling, using all is safest for detection.
        for (const pixelOffset of offsets) {
            if (pixelOffset + 2 >= len) break
            hash ^= buffer[pixelOffset]
            hash = Math.imul(hash, this.FNV_PRIME)
            hash ^= buffer[pixelOffset + 1]
            hash = Math.imul(hash, this.FNV_PRIME)
            hash ^= buffer[pixelOffset + 2]
            hash = Math.imul(hash, this.FNV_PRIME)
        }

        // Add a salt based on dimensions to ensure that even if pixel content matches,
        // a resize is detected as a change (though sizeKey also handles this).
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

        const signature = this.getQuickSignature(buffer, size)
        const changed = !previous || previous.sizeKey !== sizeKey || previous.signature !== signature
        if (changed) this.lastChangeTimes[captureId] = now

        // skip unchanged frames, but still send a keepalive frame at a regular interval
        if (!changed && previous && now - previous.lastSentAt < this.UNCHANGED_KEEPALIVE_MS) return true

        this.lastFrameState[channelId] = { signature, sizeKey, lastSentAt: now }
        return false
    }

    // buffer-consumers need only raw BGRA bytes (no NativeImage resize/toJPEG), so on the shared-texture
    // path they can take the readback buffer directly instead of a createFromBitmap -> toBitmap round-trip.
    private static readonly BUFFER_CONSUMERS = new Set(["ndi", "webrtc", "rtmp", "blackmagic"])

    private static osrModule: any = null
    private static loadOsr(): any {
        if (this.osrModule !== null) return this.osrModule
        try {
            const m = require("osr-capture")
            this.osrModule = typeof m?.downscaleBgra === "function" ? m : false
        } catch {
            this.osrModule = false
        }
        return this.osrModule
    }

    private static readonly HEAVY_IMAGE_MAX_WIDTH = 1280
    // Downscale 4K buffer natively if possible before creating NativeImage for server/stage
    private static buildHeavyImage(image: NativeImage | null, raw: { buffer: Buffer; size: Size; format?: number } | undefined): NativeImage | null {
        if (image) return image
        if (!raw || (raw.format ?? 0) !== 0) return null
        if (raw.size.width > this.HEAVY_IMAGE_MAX_WIDTH) {
            const osr = this.loadOsr()
            if (osr) {
                const dstW = this.HEAVY_IMAGE_MAX_WIDTH
                const dstH = Math.max(1, Math.round((dstW * raw.size.height) / raw.size.width))
                try {
                    const small: Buffer = osr.downscaleBgra(raw.buffer, raw.size.width, raw.size.height, dstW, dstH)
                    return nativeImage.createFromBitmap(small, { width: dstW, height: dstH })
                } catch {
                    // fall through to full-res createFromBitmap
                }
            }
        }
        return nativeImage.createFromBitmap(raw.buffer, raw.size)
    }

    static transmitFrame(captureId: string, image: NativeImage | null, captureTimestamp?: number, raw?: { buffer: Buffer; size: Size; format?: number }) {
        const frameTimestamp = captureTimestamp ?? performance.now()
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const framerates = captureOptions.framerates

        setImmediate(() => {
            if (!raw && (!image || image.isEmpty())) return
            this.transmitFrameBody(captureId, image, raw, frameTimestamp, captureOptions, framerates)
        })
    }

    private static transmitFrameBody(captureId: string, image: NativeImage | null, raw: { buffer: Buffer; size: Size; format?: number } | undefined, frameTimestamp: number, captureOptions: any, framerates: any) {
        {
            const baseCaptureFrameRate = CaptureHelper.getMaxActiveFramerate(framerates || {}, captureOptions.options || {})
            const px = raw?.size ? raw.size.width * raw.size.height : image ? image.getSize().width * image.getSize().height : 0
            const heavyConsumerCap = px > 4_000_000 ? 12 : px > 2_000_000 ? 20 : Infinity

            const firing: Channel[] = []
            for (const channel of Object.values(this.channels)) {
                if (channel.captureId !== captureId) continue

                let fps = framerates?.[channel.key] || 30
                if (!this.BUFFER_CONSUMERS.has(channel.key)) fps = Math.min(fps, heavyConsumerCap)
                const minInterval = 1000 / fps
                const timeSinceLastFrame = frameTimestamp - channel.lastFrameTime

                const epsilon = fps >= baseCaptureFrameRate ? this.FPS_EPSILON_HIGH : this.FPS_EPSILON_LOW
                if (timeSinceLastFrame < minInterval - epsilon) continue

                channel.lastFrameTime = frameTimestamp
                firing.push(channel)
            }
            if (firing.length === 0) return

            let frameImage: NativeImage | null | undefined = undefined
            for (const channel of firing) {
                if (raw && this.BUFFER_CONSUMERS.has(channel.key)) {
                    this.sendRawToChannel(captureId, channel.key, raw.buffer, raw.size, raw.format ?? 0)
                    continue
                }
                if (frameImage === undefined) frameImage = this.buildHeavyImage(image, raw)
                if (frameImage && !frameImage.isEmpty()) this.sendFrameToChannel(captureId, channel.key, frameImage)
            }
        }
    }

    // send a raw BGRA readback buffer straight to a buffer-consumer. `buffer` is the shared latest-frame
    // buffer, so any consumer that mutates (convertToRGBA) or transfers (NDI worker) it must copy first.
    private static sendRawToChannel(captureId: string, key: string, buffer: Buffer, size: Size, format: number) {
        switch (key) {
            case "ndi":
                this.sendRawToNdi(captureId, buffer, size, format)
                break
            case "webrtc":
                this.sendRawToWebRtc(captureId, buffer, size, format)
                break
            case "rtmp":
                this.sendRawToRtmp(captureId, buffer, size)
                break
            case "blackmagic":
                this.sendRawToBlackmagic(captureId, buffer, size, format)
                break
        }
    }

    // Blackmagic fast path: `format 1` means osr-capture already produced UYVY at the card's display mode
    // (getReadbackFormat gated this via BlackmagicSender.canAcceptRawUyvy), so schedule it without the CPU
    // BGRA->UYVY convert. `format 0` (BGRA) still works — it just goes through the standard NativeImage path
    // (resize-to-display-mode + convert), same as when Blackmagic shares the frame with another consumer.
    private static sendRawToBlackmagic(captureId: string, buffer: Buffer, size: Size, format: number) {
        if (format === 1) {
            if (!BlackmagicSender.canAcceptFrame(captureId)) return
            const framerate = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.blackmagic
            if (!framerate) return
            const audioBuffer = BlackmagicSender.audioQueueLength > 0 ? this.AUDIO_PRESENT_MARKER : null
            // own copy: the native scheduler must not retain/mutate the shared readback buffer
            BlackmagicSender.scheduleFrame(captureId, Buffer.from(buffer), audioBuffer, framerate, true)
            return
        }
        // BGRA: build a NativeImage once and use the standard converter path
        const image = nativeImage.createFromBitmap(buffer, size)
        if (!image.isEmpty()) this.sendBufferToBlackmagic(captureId, image)
    }

    private static sendRawToNdi(captureId: string, buffer: Buffer, size: Size, format: number) {
        if (!NdiSender.NDI[captureId]?.sender) return
        if (NdiSender.isBusyNDI(captureId)) return
        const output = OutputHelper.getOutput(captureId)
        const ratio = size.height ? size.width / size.height : 16 / 9
        const transparent = output?.transparent === true
        const framerate = output?.captureOptions?.framerates?.ndi || 30
        NdiSender.sendVideoBufferNDI(captureId, Buffer.from(buffer), { size, ratio, framerate, transparent, format })
    }

    private static sendRawToWebRtc(captureId: string, buffer: Buffer, size: Size, format = 0) {
        if (!WebRtcHost.isRunning()) return
        if (this.shouldSkipUnchangedNonBlackmagicFrame("webrtc", captureId, buffer, size)) return
        if (format === 3) {
            WebRtcHost.sendFrame(captureId, buffer, size)
            return
        }
        const owned = Buffer.from(buffer)
        this.convertToRGBA(owned)
        WebRtcHost.sendFrame(captureId, owned, size)
    }

    private static sendRawToRtmp(captureId: string, buffer: Buffer, size: Size) {
        if (!RtmpStreamer.isRunning(captureId)) return
        if (this.shouldSkipUnchangedNonBlackmagicFrame("rtmp", captureId, buffer, size)) return
        RtmpStreamer.updateFrame(captureId, Buffer.from(buffer), size)
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
            case "rtmp":
                this.sendBufferToRtmpStreamer(captureId, image)
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

        // NDI drops to the latest frame while a send is in flight; skip the expensive toBitmap readback
        // for frames that would be dropped anyway (avoids ~33MB/frame of throwaway allocation at 4K).
        if (NdiSender.isBusyNDI(captureId)) return

        const buffer = image.toBitmap()

        const output = OutputHelper.getOutput(captureId)
        const ratio = image.getAspectRatio()
        const transparent = output?.transparent === true
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

        // match the Blackmagic device display mode. The capturePage poll resizes in
        // captureAndProcessFrame; OSR outputs are captured at their render resolution, so resize here to
        // cover both paths (no-op when the sizes already match).
        const targetSize = BlackmagicSender.getTargetDimensions(captureId)
        const currentSize = image.getSize()
        if (targetSize?.width && (currentSize.width !== targetSize.width || currentSize.height !== targetSize.height)) {
            image = image.resize({ width: targetSize.width, height: targetSize.height })
        }

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

        const buffer = image.toBitmap()
        const size = image.getSize()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("stage", captureId, buffer, size)) return

        // push compressed frames directly to connected web StageShow clients ("current output" mirrors)
        this.sendFrameToStageClients(captureId, image, size)

        const hasPreviewRequests = this.requestList.length > 0
        if (!hasPreviewRequests) return

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)

        const msg = { channel: "BUFFER", data: { id: captureId, time: Date.now(), buffer, size } }
        this.sendToRequested(msg)
    }

    // push a downscaled JPEG frame to subscribed web StageShow clients
    // clients without a visible "current output" mirror never subscribe, so text-only stage displays receive nothing
    private static sendFrameToStageClients(captureId: string, image: NativeImage, size: Size) {
        if (getConnections("STAGE") === 0 || getStageStreamSubscriberIds().length === 0) return

        const now = performance.now()
        if (now - (this.lastStagePushTimes[captureId] || 0) < this.STAGE_PUSH_MIN_INTERVAL_MS) return
        this.lastStagePushTimes[captureId] = now

        let frameImage = image
        if (size.width > this.STAGE_FRAME_MAX_WIDTH) {
            frameImage = image.resize({ width: this.STAGE_FRAME_MAX_WIDTH, quality: "good" })
        }

        const jpeg = frameImage.toJPEG(70) // 70% quality
        toStageStreamSubscribers({ channel: "STREAM_FRAME", data: { id: captureId, jpeg, size: frameImage.getSize(), time: Date.now() } })
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

        // the client displaying this output is identified by the URL path it opened (falls back to the output name)
        const output = OutputHelper.getOutput(outputId)
        const name = output?.name || ""
        const path = output?.htmlData?.path || `/${slugifyStreamPath(name) || "output"}`
        const transparent = output?.transparent ?? false

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)
        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, path, name, transparent, time: Date.now(), buffer, size } })
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

    // RTMP
    static sendBufferToRtmpStreamer(outputId: string, image: NativeImage) {
        if (!image || !RtmpStreamer.isRunning(outputId)) return

        const buffer = image.toBitmap()
        const size = image.getSize()
        if (this.shouldSkipUnchangedNonBlackmagicFrame("rtmp", outputId, buffer, size)) return

        RtmpStreamer.updateFrame(outputId, buffer, size)
    }

    static requestPreview(data: { id: string; previewId: string }) {
        this.requestList.push(JSON.stringify(data))
        // prevent unbounded growth if requested frames never arrive (e.g. capture not running)
        if (this.requestList.length > this.REQUEST_LIST_MAX) this.requestList = this.requestList.slice(-this.REQUEST_LIST_MAX)
    }

    static removeAllChannels(captureId: string) {
        const keysToRemove = Object.keys(this.channels).filter((key) => key.startsWith(`${captureId}-`))
        for (const key of keysToRemove) {
            delete this.channels[key]
        }
    }
}
