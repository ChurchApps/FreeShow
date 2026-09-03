import { isAudioEnabled } from "../../audio/processAudio"
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { OutputHelper } from "../../output/OutputHelper"
import { getRtmpEncoderSetting } from "../../streaming/encoderDetection"
import { RtmpStreamer } from "../../streaming/RtmpStreamer"
import { WebRtcHost } from "../../streaming/WebRtcHost"
import { CaptureHelper } from "../CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"

export class CaptureLifecycle {
    private static readonly BACKPRESSURE_LOOKUP = [
        { threshold: 6144, maxFps: 4 },
        { threshold: 5120, maxFps: 6 },
        { threshold: 4096, maxFps: 8 },
        { threshold: 3072, maxFps: 10 }
    ]
    private static readonly FALLBACK_FPS = 60
    private static readonly MIN_DELAY_MS = 1
    private static readonly WEBRTC_START_DELAY_MS = 1000
    private static readonly BYTES_PER_MB = 1048576
    // reduce capture rate when output content has not changed for a while (static slide/idle)
    private static readonly IDLE_AFTER_MS = 2000
    private static readonly IDLE_FPS = 3

    private static captureLoopToken: { [key: string]: number } = {}
    private static activeCaptures: Set<string> = new Set()

    static startCapture(id: string, toggle: { [key: string]: boolean } = {}) {
        const output = OutputHelper.getOutput(id)
        if (!output) return

        // already active - toggle values
        if (this.activeCaptures.has(id)) {
            if (Object.keys(toggle).length > 0 && output.captureOptions) {
                this.updateCaptureToggles(id, output.captureOptions, toggle)
                CaptureHelper.Transmitter.startTransmitting(id)
                this.updateWebRtcHostState()
                this.updateRtmpState()
            }
            return
        }

        if (!output.window || output.window.isDestroyed()) {
            this.activeCaptures.delete(id)
            delete output.captureOptions
            return
        }

        const toggleHasActive = Object.values(toggle).some(Boolean)
        if (!toggleHasActive) return

        if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(output.window, id)
        const captureOptions = output.captureOptions

        // toggle values
        if (captureOptions && Object.keys(toggle).length > 0) this.updateCaptureToggles(id, captureOptions, toggle)

        const hasEnabledCapture = captureOptions?.options && Object.values(captureOptions.options).some(Boolean)
        if (!hasEnabledCapture || captureOptions?.window.isDestroyed()) {
            this.stopCapture(id)
            return
        }

        CaptureHelper.updateFramerate(id)
        CaptureHelper.Transmitter.startTransmitting(id)

        if (captureOptions.frameSubscription) {
            clearTimeout(captureOptions.frameSubscription)
        }

        const token = (this.captureLoopToken[id] || 0) + 1
        this.captureLoopToken[id] = token

        this.activeCaptures.add(id)
        this.updateWebRtcHostState()
        this.updateRtmpState()

        // OSR outputs are driven by paint events (OutputLifecycle.attachOsrCapture -> transmitFrame),
        // so skip the capturePage poll for them; channels/senders are still set up above.
        if (!output.osr) this.runCaptureLoop(id, token, output)
    }

    private static updateCaptureToggles(id: string, captureOptions: any, toggle: { [key: string]: boolean }) {
        const captureOpts = captureOptions.options || {}
        for (const key of Object.keys(toggle)) {
            if (captureOpts[key] && !toggle[key]) CaptureTransmitter.stopChannel(id, key)
            captureOpts[key] = toggle[key]
        }
        captureOptions.options = captureOpts
    }

    private static runCaptureLoop(id: string, token: number, output: any) {
        console.info("Capture - starting: " + id)

        const captureFrame = async () => {
            const captureOpts = output.captureOptions

            if (!this.shouldContinueCapture(id, token, captureOpts)) {
                this.activeCaptures.delete(id)
                return
            }

            // Blackmagic only - skip frames
            if (captureOpts.options?.blackmagic && !BlackmagicSender.canAcceptFrame(id)) {
                captureOpts.frameSubscription = setTimeout(captureFrame, 1000 / this.FALLBACK_FPS)
                return
            }

            try {
                const image = await this.captureAndProcessFrame(id, captureOpts)

                // transmit frame (CaptureTransmitter handles skipping unchanged frames with keepalive)
                this.transmitFrame(id, image)
            } catch (error) {
                console.warn(`Capture failed for output ${id}:`, error)
            }

            if (!this.shouldContinueCapture(id, token, captureOpts)) {
                this.activeCaptures.delete(id)
                return
            }

            const delay = this.calculateFrameDelay(id, captureOpts)
            captureOpts.frameSubscription = setTimeout(captureFrame, delay)
        }

        captureFrame()
    }

    private static shouldContinueCapture(id: string, token: number, captureOpts: any): boolean {
        if (!captureOpts) return false
        if (this.captureLoopToken[id] !== token) return false
        if (!captureOpts.window || captureOpts.window.isDestroyed()) return false
        if (!captureOpts.window.webContents || captureOpts.window.webContents.isDestroyed?.()) return false
        // stop the loop when every channel has been toggled off
        if (!captureOpts.options || !Object.values(captureOpts.options).some(Boolean)) return false
        return true
    }

    private static async captureAndProcessFrame(id: string, captureOpts: any) {
        let image = await captureOpts.window.webContents.capturePage()

        // const output = OutputHelper.getOutput(id)
        // const targetBounds = output.intendedBounds

        // Blackmagic only - resize if needed
        if (captureOpts.options?.blackmagic) {
            const targetSize = BlackmagicSender.getTargetDimensions(id)
            const currentSize = image.getSize()
            if (currentSize.width !== targetSize.width || currentSize.height !== targetSize.height) {
                image = image.resize({ width: targetSize.width, height: targetSize.height, quality: "good" })
            }
            // } else if (targetBounds?.width && targetBounds?.height) {
            //     const currentSize = image.getSize()
            //     if (currentSize.width !== targetBounds.width || currentSize.height !== targetBounds.height) {
            //         image = image.resize({ width: targetBounds.width, height: targetBounds.height, quality: "good" })
            //     }
        }

        return image
    }

    private static transmitFrame(id: string, image: any) {
        CaptureTransmitter.transmitFrame(id, image, performance.now())
    }

    private static calculateFrameDelay(id: string, captureOpts: any): number {
        const output = OutputHelper.getOutput(id)
        if (!output?.captureOptions) return this.MIN_DELAY_MS

        const captureFrameRate = this.getAdaptiveFrameRate(id, captureOpts)
        const targetIntervalMs = 1000 / captureFrameRate

        return Math.max(this.MIN_DELAY_MS, Math.round(targetIntervalMs))
    }

    private static getAdaptiveFrameRate(id: string, captureOpts: any): number {
        const output = OutputHelper.getOutput(id)
        const frameRates = output?.captureOptions?.framerates || {}
        const options = captureOpts.options || {}

        const baseCaptureFrameRate = CaptureHelper.getMaxActiveFramerate(frameRates, options)

        // Blackmagic only - reduce frame rate if memory exceeds thresholds
        if (captureOpts.options?.blackmagic) {
            const externalMB = process.memoryUsage().external / this.BYTES_PER_MB
            for (const { threshold, maxFps } of this.BACKPRESSURE_LOOKUP) {
                if (externalMB > threshold) {
                    return Math.min(baseCaptureFrameRate, maxFps)
                }
            }
        }

        // static content - capture at a low rate until a change is detected
        // (Blackmagic and NDI frames bypass change detection / idle backoff to maintain video stream clocks)
        const timeSinceChange = CaptureTransmitter.getTimeSinceLastChange(id)
        if (!options.blackmagic && !options.ndi && timeSinceChange > this.IDLE_AFTER_MS) {
            return Math.min(baseCaptureFrameRate, this.IDLE_FPS)
        }

        return baseCaptureFrameRate
    }

    static stopCapture(id: string) {
        this.captureLoopToken[id] = (this.captureLoopToken[id] || 0) + 1
        this.activeCaptures.delete(id)

        const output = OutputHelper.getOutput(id)
        const capture = output?.captureOptions
        if (!capture) return

        if (capture.frameSubscription) {
            clearTimeout(capture.frameSubscription)
            capture.frameSubscription = null
        }

        const channels = ["ndi", "blackmagic", "server", "stage", "webrtc", "rtmp"]
        channels.forEach((channel) => CaptureHelper.Transmitter.stopChannel(id, channel))

        console.info("Capture - stopping: " + id)

        OutputHelper.Lifecycle.releaseOsrCaptureTextures(id)
        if (!(output as any).follower) this.cleanupListeners(capture.window)
        delete output.captureOptions
        this.updateWebRtcHostState()
        this.updateRtmpState()
    }

    private static cleanupListeners(window: any) {
        if (!window || window.isDestroyed()) return

        window.removeAllListeners()
        if (window.webContents && !window.webContents.isDestroyed?.()) {
            window.webContents.removeAllListeners()
        }
    }

    private static updateWebRtcHostState() {
        const allOutputs = OutputHelper.getAllOutputs()
        const webrtcActive = allOutputs.some((o) => o.webrtcData?.streaming)

        if (webrtcActive) {
            const wasRunning = WebRtcHost.isRunning()
            WebRtcHost.start()

            const sendStartSignals = () => {
                allOutputs.forEach((o) => {
                    if (!o.id) return

                    if (o.webrtcData?.streaming) {
                        const url = o.webrtcData?.url || ""
                        const token = o.webrtcData?.token || ""
                        const fps = o.webrtcData?.fps ? Number(o.webrtcData.fps) : 30
                        const bitrate = o.webrtcData?.bitrate ? Number(o.webrtcData.bitrate) : 2500
                        if (o.captureOptions?.framerates) o.captureOptions.framerates.webrtc = fps
                        if (url) WebRtcHost.startWhip(o.id, url, token, { fps, bitrate })
                    } else {
                        WebRtcHost.stopWhip(o.id)
                    }
                })
            }

            if (wasRunning) {
                sendStartSignals()
            } else {
                setTimeout(sendStartSignals, this.WEBRTC_START_DELAY_MS)
            }
        } else {
            WebRtcHost.stop()
        }
    }

    /** Public so a settings change (e.g. the encoder) can be applied without waiting for a capture event. */
    static updateRtmpState() {
        const allOutputs = OutputHelper.getAllOutputs()
        allOutputs.forEach((o) => {
            if (!o.id) return

            if (!o.rtmpData?.streaming) {
                if (RtmpStreamer.isRunning(o.id)) RtmpStreamer.stop(o.id)
                return
            }

            const destinations = (o.rtmpData.destinations || []).filter((d) => d.enabled && d.url)
            if (!destinations.length) {
                if (RtmpStreamer.isRunning(o.id)) RtmpStreamer.stop(o.id)
                return
            }

            // getBounds() is the DPI-corrected render size (halved on HiDPI for capture-only outputs),
            // so broadcast at the configured resolution instead
            const bounds = o.intendedBounds || o.window?.getBounds() || { width: 1920, height: 1080 }
            const fps = o.rtmpData.fps ? Number(o.rtmpData.fps) : 30
            const bitrate = o.rtmpData.bitrate ? Number(o.rtmpData.bitrate) : 4000
            if (o.captureOptions?.framerates) o.captureOptions.framerates.rtmp = fps

            // destination changes only touch relays; the encode keeps running
            RtmpStreamer.update(o.id, { width: bounds.width, height: bounds.height, fps, bitrate, enableAudio: isAudioEnabled(), encoder: getRtmpEncoderSetting() }, destinations)
        })
    }
}
