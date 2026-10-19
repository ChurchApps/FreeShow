import { nativeImage, type NativeImage, type Size } from "electron"
import os from "os"
import { CONTROLLER, OUTPUT_STREAM } from "../../../types/Channels"
import { BlackmagicBridge as BlackmagicSender } from "../../blackmagic/BlackmagicBridge"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OmtSender } from "../../omt/OmtSender"
import { OutputHelper } from "../../output/OutputHelper"
import { getConnections, getStageStreamSubscriberIds, toServer, toStageStreamSubscribers } from "../../servers"
import { RtmpBridge as RtmpStreamer } from "../../streaming/RtmpBridge"
import { WebRtcHost } from "../../streaming/WebRtcHost"
import { CaptureHelper } from "../CaptureHelper"
import { ruleViolation } from "../../utils/ruleCheck"
import { PreviewStream } from "../PreviewStream"
import { blankFrame } from "../outputsOff"

export type Channel = {
    key: string
    captureId: string
    timer?: NodeJS.Timeout
    lastFrameTime: number
}
export class CaptureTransmitter {
    private static readonly IS_BIG_ENDIAN = os.endianness() === "BE"
    // StageShow "Output window" items: push JPEG frames directly to connected clients
    private static readonly STAGE_FRAME_MAX_WIDTH = 1280

    private static readonly FPS_EPSILON_HIGH = 10.0
    private static readonly FPS_EPSILON_LOW = 1.0

    static channels: { [key: string]: Channel } = {}
    private static lastStagePushTimes: { [captureId: string]: number } = {}

    static startTransmitting(captureId: string) {
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const channelKeys = ["ndi", "omt", "blackmagic", "server", "stage", "webrtc", "rtmp", "recorder"]
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
        if (key === "stage") {
            delete this.lastStagePushTimes[captureId]
        }

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
        if (only === "omt") return OutputHelper.getOutput(captureId)?.transparent === true ? 2 : 1
        if (only === "blackmagic" && size && BlackmagicSender.canAcceptRawUyvy(captureId, size)) return 1
        if (only === "webrtc") return 3
        return 0
    }

    // Returns non-NDI/OMT/RTMP consumers eligible for off-main capture (server/stage), or null if full-res path needed
    static getHeavyOffMainConsumers(captureId: string): string[] | null {
        const heavy = Object.keys(this.channels)
            .filter((k) => k.startsWith(`${captureId}-`))
            .map((k) => this.channels[k].key)
            .filter((key) => key !== "ndi" && key !== "omt" && key !== "rtmp" && key !== "blackmagic" && key !== "webrtc" && key !== "recorder")
        if (heavy.some((key) => key !== "server" && key !== "stage")) return null
        return heavy
    }

    // Downscale target for server/stage viewers and the main window's previews. Web/stage viewers get the
    // full preview width; when only previews are subscribed, the frame is no wider than the widest preview
    // actually drawn (even width, since the packed formats pair pixels), so the relay costs what it must.
    static getScaledTarget(size: Size, memberIds: string[] = []): { dstW: number; dstH: number } {
        let dstW = Math.min(size.width, this.HEAVY_IMAGE_MAX_WIDTH)
        if (!this.previewViewersConnected()) {
            const wanted = PreviewStream.requestedWidth(memberIds)
            if (wanted > 0) dstW = Math.min(dstW, Math.max(2, wanted + (wanted % 2)))
        }
        const dstH = Math.max(1, Math.round((dstW * size.height) / size.width))
        return { dstW, dstH }
    }

    // Someone is actually watching a web output stream or a stage "current output" mirror. Without a
    // viewer the server/stage channels stay registered (the servers are enabled) but no preview frame is
    // produced, shipped or converted for them: that work only exists for a connected viewer.
    static previewViewersConnected(): boolean {
        if (getConnections("OUTPUT_STREAM") > 0) return true
        return getConnections("STAGE") > 0 && getStageStreamSubscriberIds().length > 0
    }

    // Checks if all members of a group only use NDI, server, or stage
    static groupOffMainInfo(memberIds: string[]): { eligible: boolean; needsScaled: boolean } {
        let needsScaled = false
        const viewers = this.previewViewersConnected()
        for (const id of memberIds) {
            const heavy = Object.keys(this.channels)
                .filter((k) => k.startsWith(`${id}-`))
                .map((k) => this.channels[k].key)
                .filter((key) => key !== "ndi" && key !== "omt" && key !== "rtmp" && key !== "blackmagic" && key !== "webrtc" && key !== "recorder")
            if (heavy.some((key) => key !== "server" && key !== "stage")) return { eligible: false, needsScaled: false }
            // a previewed output needs the downscaled frame whether or not it has a server/stage channel:
            // without it the preview falls back to a mirror that decodes the output's media all over again
            if (PreviewStream.hasSubscribers(id) || (heavy.length && viewers)) needsScaled = true
        }
        return { eligible: true, needsScaled }
    }


    // buffer-consumers need only raw BGRA bytes (no NativeImage resize/toJPEG), so on the shared-texture
    // path they can take the readback buffer directly instead of a createFromBitmap -> toBitmap round-trip.
    private static readonly BUFFER_CONSUMERS = new Set(["ndi", "omt", "webrtc", "rtmp", "blackmagic", "recorder"])

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

    // legacy path only: cap main-thread consumers at this share of the thread, from their measured cost
    private static readonly HEAVY_MAIN_SHARE = 0.5
    private static readonly HEAVY_COST_SMOOTHING = 0.2
    private static heavyCostMs: { [captureId: string]: number } = {}
    private static heavyServedByWorker: { [captureId: string]: boolean } = {}

    // The two ways of serving these consumers cost wildly different amounts, and the smoothed cost is
    // what caps the rate. Carrying a measurement across a switch throttles the cheap path to the speed of
    // the expensive one - and then measures too rarely to ever recover.
    private static noteHeavyMode(captureId: string, viaWorker: boolean) {
        if (this.heavyServedByWorker[captureId] === viaWorker) return
        this.heavyServedByWorker[captureId] = viaWorker
        delete this.heavyCostMs[captureId]
    }

    private static noteHeavyCost(captureId: string, ms: number) {
        const previous = this.heavyCostMs[captureId]
        this.heavyCostMs[captureId] = previous === undefined ? ms : previous + (ms - previous) * this.HEAVY_COST_SMOOTHING
    }

    private static heavyRateCap(captureId: string): number {
        const cost = this.heavyCostMs[captureId]
        if (!cost || cost <= 0) return Infinity // nothing measured yet: let the first frames through and find out
        return Math.max(1, Math.floor((1000 * this.HEAVY_MAIN_SHARE) / cost))
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

    // every consumer below reads the frame back with toBitmap and may resize or encode it, all on main
    static transmitFrame(captureId: string, image: NativeImage | null, captureTimestamp?: number, raw?: { buffer: Buffer; size: Size; format?: number }) {
        const frameTimestamp = captureTimestamp ?? performance.now()
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return

        const framerates = captureOptions.framerates

        // the worker serves every consumer while it owns this output; serving them here too would
        // double-send. Checked before anything is scheduled, so such a frame costs main no timer either.
        if (OutputHelper.Lifecycle.isOffMainActive(captureId)) return
        if (!raw && (!image || image.isEmpty())) return

        // an output the user turned off sends black in place of its picture (capture/outputsOff.ts)
        if (!OutputHelper.Lifecycle.isOutputOn(captureId)) {
            const size = raw?.size || image!.getSize()
            raw = { buffer: this.blankFor(size, OutputHelper.getOutput(captureId)?.transparent === true), size, format: 0 }
            image = null
        }

        setImmediate(() => {
            this.transmitFrameBody(captureId, image, raw, frameTimestamp, captureOptions, framerates)
        })
    }

    private static blanks = new Map<string, Buffer>()
    private static blankFor(size: Size, transparent: boolean): Buffer {
        const key = `${size.width}x${size.height}:${transparent}`
        let buf = this.blanks.get(key)
        if (!buf) this.blanks.set(key, (buf = blankFrame(size.width, size.height, 0, transparent)))
        return buf
    }

    private static transmitFrameBody(captureId: string, image: NativeImage | null, raw: { buffer: Buffer; size: Size; format?: number } | undefined, frameTimestamp: number, captureOptions: any, framerates: any) {
        {
            const baseCaptureFrameRate = CaptureHelper.getMaxActiveFramerate(framerates || {}, captureOptions.options || {})
            const heavyConsumerCap = this.heavyRateCap(captureId)

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

            // Consumers that need the frame resized, converted or encoded go to the worker even when the
            // capture could not be a shared texture: main reads the frame back once and hands it over,
            // and does no per-consumer work at all.
            const heavy = firing.filter((c) => !this.BUFFER_CONSUMERS.has(c.key)).map((c) => c.key)
            let servedByWorker = false
            if (heavy.length > 0) {
                // measured like any other main-thread frame work, so the rate cap reflects what this path
                // actually costs (one readback) rather than what the per-consumer path used to
                const started = performance.now()
                servedByWorker = this.serveHeavyViaWorker(captureId, image, raw, heavy)
                this.noteHeavyMode(captureId, servedByWorker)
                if (servedByWorker) this.noteHeavyCost(captureId, performance.now() - started)
            }

            let frameImage: NativeImage | null | undefined
            for (const channel of firing) {
                if (raw && this.BUFFER_CONSUMERS.has(channel.key)) {
                    this.sendRawToChannel(captureId, channel.key, raw.buffer, raw.size, raw.format ?? 0)
                    continue
                }
                if (servedByWorker) continue
                const started = performance.now()
                if (frameImage === undefined) frameImage = this.buildHeavyImage(image, raw)
                if (frameImage && !frameImage.isEmpty()) this.sendFrameToChannel(captureId, channel.key, frameImage)
                this.noteHeavyCost(captureId, performance.now() - started)
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
            case "omt":
                this.sendRawToOmt(captureId, buffer, size, format)
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
            case "recorder":
                // the recording is a destination of the output's RTMP encode; feed it once
                if (!this.channels[`${captureId}-rtmp`]) this.sendRawToRtmp(captureId, buffer, size)
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
            BlackmagicSender.scheduleFrame(captureId, buffer, size, framerate, true)
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
        const framerate = output?.captureOptions?.framerates?.ndi || CaptureHelper.defaultFramerates().ndi
        NdiSender.sendVideoBufferNDI(captureId, Buffer.from(buffer), { size, ratio, framerate, transparent, format })
    }

    private static sendRawToOmt(captureId: string, buffer: Buffer, size: Size, format: number) {
        if (!OmtSender.OMT[captureId]?.sender) return
        const output = OutputHelper.getOutput(captureId)
        const ratio = size.height ? size.width / size.height : 16 / 9
        const transparent = output?.transparent !== false
        const framerate = output?.captureOptions?.framerates?.omt || 30
        OmtSender.sendVideoBufferOMT(captureId, Buffer.from(buffer), { size, ratio, framerate, transparent, format })
    }

    private static sendRawToWebRtc(captureId: string, buffer: Buffer, size: Size, format = 0) {
        if (!WebRtcHost.isRunning()) return
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
        RtmpStreamer.updateFrame(captureId, Buffer.from(buffer), size)
    }

    // Ensure frames match configured output size (resampling if display scaling altered dimensions)
    private static sizeMismatchLogged: { [captureId: string]: string } = {}
    private static toConfiguredSize(captureId: string, image: NativeImage): { image: NativeImage; size: Size } {
        const size = image.getSize()
        const out = OutputHelper.getOutput(captureId)
        const intended = out?.sendSize || out?.intendedBounds
        if (!intended?.width || !intended?.height || (intended.width === size.width && intended.height === size.height)) return { image, size }
        const target = { width: intended.width, height: intended.height }
        const tag = `${size.width}x${size.height}->${target.width}x${target.height}`
        if (this.sizeMismatchLogged[captureId] !== tag) {
            this.sizeMismatchLogged[captureId] = tag
            console.warn(`Output ${captureId} rendered ${size.width}x${size.height} but is configured ${target.width}x${target.height}; resampling frames for NDI/OMT`)
        }
        return { image: image.resize({ ...target, quality: "good" }), size: target }
    }

    private static sendFrameToChannel(captureId: string, key: string, image: NativeImage) {
        const size = image.getSize()
        if (!size.width || !size.height) return

        switch (key) {
            case "ndi": {
                const fitted = this.toConfiguredSize(captureId, image)
                this.sendBufferToNdi(captureId, fitted.image, { size: fitted.size })
                break
            }
            case "omt": {
                const fitted = this.toConfiguredSize(captureId, image)
                this.sendBufferToOmt(captureId, fitted.image, { size: fitted.size })
                break
            }
            case "blackmagic":
                this.sendBufferToBlackmagic(captureId, image)
                break
            case "server": {
                if (getConnections("OUTPUT_STREAM") === 0) break // nobody watching: no resize, no convert, no send
                const width = Math.min(size.width, this.serverFrameWidth())
                this.sendBufferToServer(captureId, image.resize({ width, height: Math.max(1, Math.round((size.height * width) / size.width)), quality: "good" }))
                break
            }
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

    // A viewer costs its area, so bandwidth is viewers x width^2; holding that constant means the width
    // falls with the square root of the viewer count.
    // Hand ONE readback of this frame to the capture worker and let it derive every consumer's version.
    // The readback cannot be avoided here - a frame captured from a real window exists only as a
    // NativeImage on this thread - but it happens once, and no resize, convert or encode happens here.
    private static serveHeavyViaWorker(captureId: string, image: NativeImage | null, raw: { buffer: Buffer; size: Size; format?: number } | undefined, keys: string[]): boolean {
        if (!NdiSender.hasWorker()) return false

        const server = keys.includes("server") ? this.serverStreamRequest(captureId) : null
        const stage = keys.includes("stage") ? this.stageStreamRequest() : null
        const previewWidth = PreviewStream.hasSubscribers(captureId) ? Math.max(2, PreviewStream.requestedWidth([captureId]) || this.HEAVY_IMAGE_MAX_WIDTH) : 0
        if (!server && !stage && !previewWidth) return false

        let source: Buffer
        let size: Size
        if (raw && (raw.format ?? 0) === 0) {
            source = raw.buffer
            size = raw.size
        } else {
            if (!image || image.isEmpty()) return false
            ruleViolation("main-frame", "readback of a window with no shared texture")
            source = image.toBitmap()
            size = image.getSize()
        }
        if (!size.width || !size.height) return false

        const copy = Buffer.from(source)
        NdiSender.postToWorker(
            {
                type: "cpuFrame",
                id: captureId,
                members: OutputHelper.Lifecycle.groupMembers(captureId),
                buffer: copy.buffer,
                byteOffset: copy.byteOffset,
                byteLength: copy.byteLength,
                size,
                server: server ? { width: Math.min(server.width, size.width) } : null,
                stage: stage ? { width: Math.min(stage.width, size.width), quality: stage.quality, intervalMs: stage.intervalMs } : null,
                preview: previewWidth ? { width: Math.min(previewWidth, size.width) } : null
            },
            [copy.buffer]
        )
        return true
    }

    static serverFrameWidth(): number {
        const viewers = Math.max(1, getConnections("OUTPUT_STREAM"))
        const width = Math.round(this.HEAVY_IMAGE_MAX_WIDTH / Math.sqrt(viewers))
        return Math.max(2, width - (width % 2)) // even, since the packed formats pair pixels
    }

    // NDI
    static sendBufferToNdi(captureId: string, image: NativeImage, { size }: { size: { width: number; height: number } }) {
        if (!NdiSender.NDI[captureId]?.sender) return

        // NDI drops to the latest frame while a send is in flight; skip the expensive toBitmap readback
        // for frames that would be dropped anyway (avoids ~33MB/frame of throwaway allocation at 4K).
        if (NdiSender.isBusyNDI(captureId)) return

        ruleViolation("main-frame", "toBitmap")
        const buffer = image.toBitmap()

        const output = OutputHelper.getOutput(captureId)
        const ratio = image.getAspectRatio()
        const transparent = output?.transparent === true
        const framerate = output?.captureOptions?.framerates?.ndi || CaptureHelper.defaultFramerates().ndi

        NdiSender.sendVideoBufferNDI(captureId, buffer, { size, ratio, framerate, transparent })
    }

    // OMT
    static sendBufferToOmt(captureId: string, image: NativeImage, { size }: { size: { width: number; height: number } }) {
        if (!OmtSender.OMT[captureId]?.sender) return
        // skip the toBitmap readback for frames the busy worker would drop anyway
        if (OmtSender.isBusyOMT(captureId)) return

        ruleViolation("main-frame", "toBitmap")
        const buffer = image.toBitmap()

        const output = OutputHelper.getOutput(captureId)
        const ratio = image.getAspectRatio()
        const transparent = output?.transparent !== false
        const framerate = output?.captureOptions?.framerates?.omt || 30

        // toBitmap always yields BGRA
        OmtSender.sendVideoBufferOMT(captureId, buffer, { size, ratio, framerate, transparent, format: 0 })
    }

    private static convertToRGBA(buffer: Buffer): void {
        // a full-frame channel swap, on the main thread
        ruleViolation("main-frame", "convertToRGBA")
        if (this.IS_BIG_ENDIAN) util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width, quality: "good" })
        else image = image.resize({ height: newSize.height, quality: "good" })

        return image
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
        const frameSize = image.getSize()
        // release immediately to prevent memory accumulation
        image = null as any

        const framerate = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.blackmagic
        if (!framerate) return

        BlackmagicSender.scheduleFrame(captureId, buffer, frameSize, framerate, false)
    }

    // MAIN (STAGE OUTPUT)
    // legacy path only: an output that cannot be captured offscreen, whose frame the worker never sees
    static sendBufferToMain(captureId: string, image: NativeImage) {
        if (!image) return
        if (getConnections("STAGE") === 0 || getStageStreamSubscriberIds().length === 0) return

        this.sendFrameToStageClients(captureId, image, image.getSize())
    }

    // push a downscaled JPEG frame to subscribed web StageShow clients
    // clients without a visible "current output" mirror never subscribe, so text-only stage displays receive nothing
    // what connected OutputShow clients want; they take raw RGBA, which the GPU produces directly
    static serverStreamRequest(captureId: string): { width: number; intervalMs: number } | null {
        if (getConnections("OUTPUT_STREAM") === 0) return null
        const fps = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.server || CaptureHelper.defaultFramerates().server
        return { width: this.serverFrameWidth(), intervalMs: 1000 / Math.max(1, fps) }
    }

    // The worker produced the RGBA frame OutputShow clients want; main only forwards it.
    static sendServerFrame(outputId: string, buffer: Buffer, size: Size) {
        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, time: Date.now(), buffer, size } })
    }

    // a controller asks for a thumbnail and waits; the worker encodes the frame it already has
    private static thumbWanted = new Set<string>()

    static requestControllerThumbnail(outputId: string) {
        this.thumbWanted.add(outputId)
    }

    static thumbRequest(captureId: string): { width: number; quality: number } | null {
        if (!this.thumbWanted.has(captureId)) return null
        return { width: this.STAGE_FRAME_MAX_WIDTH, quality: 70 }
    }

    static sendControllerThumbnail(outputId: string, jpeg: Buffer, size: Size) {
        this.thumbWanted.delete(outputId)
        toServer(CONTROLLER, { channel: "OUTPUT_FRAME", data: { frame: "data:image/jpeg;base64," + jpeg.toString("base64"), width: size.width, height: size.height } })
    }

    // What subscribed stage clients want, so the capture worker can produce and encode it. Returning
    // null means nobody is watching and no frame should be made for them at all.
    private static stagePushIntervalMs() {
        return 1000 / Math.max(1, CaptureHelper.defaultFramerates().stage)
    }

    static stageStreamRequest(): { width: number; quality: number; intervalMs: number } | null {
        if (getConnections("STAGE") === 0 || getStageStreamSubscriberIds().length === 0) return null
        return { width: this.STAGE_FRAME_MAX_WIDTH, quality: 70, intervalMs: this.stagePushIntervalMs() }
    }

    // The worker encoded a frame for the stage clients; main only forwards the bytes.
    static sendStageJpeg(captureId: string, jpeg: Buffer, size: Size) {
        toStageStreamSubscribers({ channel: "STREAM_FRAME", data: { id: captureId, jpeg, size, time: Date.now() } })
    }

    // Legacy path only: an output captured with capturePage has no worker to encode for it.
    private static sendFrameToStageClients(captureId: string, image: NativeImage, size: Size) {
        if (getConnections("STAGE") === 0 || getStageStreamSubscriberIds().length === 0) return

        const now = performance.now()
        if (now - (this.lastStagePushTimes[captureId] || 0) < this.stagePushIntervalMs()) return
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

        ruleViolation("main-frame", "toBitmap")
        const buffer = image.toBitmap() // {scaleFactor: 0.5}
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)
        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, time: Date.now(), buffer, size } })
    }

    // WEBRTC
    static sendBufferToWebRtcHost(outputId: string, image: NativeImage) {
        if (!image || !WebRtcHost.isRunning()) return

        ruleViolation("main-frame", "toBitmap")
        const buffer = image.toBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        this.convertToRGBA(buffer)
        WebRtcHost.sendFrame(outputId, buffer, size)
    }

    // RTMP
    static sendBufferToRtmpStreamer(outputId: string, image: NativeImage) {
        if (!image || !RtmpStreamer.isRunning(outputId)) return

        ruleViolation("main-frame", "toBitmap")
        const buffer = image.toBitmap()
        const size = image.getSize()

        RtmpStreamer.updateFrame(outputId, buffer, size)
    }

    static removeAllChannels(captureId: string) {
        const keysToRemove = Object.keys(this.channels).filter((key) => key.startsWith(`${captureId}-`))
        for (const key of keysToRemove) {
            delete this.channels[key]
        }
        delete this.heavyCostMs[captureId]
        delete this.heavyServedByWorker[captureId]
    }
}
