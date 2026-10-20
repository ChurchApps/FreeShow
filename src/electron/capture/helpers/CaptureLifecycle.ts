import { isAudioEnabled } from "../../audio/processAudio"
import { BlackmagicBridge as BlackmagicSender } from "../../blackmagic/BlackmagicBridge"
import { OutputHelper } from "../../output/OutputHelper"
import { getRtmpEncoderSetting } from "../../streaming/encoderDetection"
import { OutputRecording } from "../../streaming/OutputRecording"
import { RtmpBridge as RtmpStreamer } from "../../streaming/RtmpBridge"
import { WebRtcHost } from "../../streaming/WebRtcHost"
import { CaptureHelper } from "../CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"

export class CaptureLifecycle {
    // how soon to look again when a device refused a frame
    private static get FALLBACK_FPS() {
        return OutputHelper.Lifecycle.OSR_RENDER_FPS
    }
    private static readonly MIN_DELAY_MS = 1
    private static readonly WEBRTC_START_DELAY_MS = 1000
    // reduce capture rate when output content has not changed for a while (static slide/idle)

    private static captureLoopToken: { [key: string]: number } = {}
    private static activeCaptures: Set<string> = new Set()

    static startCapture(id: string, toggle: { [key: string]: boolean } = {}) {
        const output = OutputHelper.getOutput(id)
        if (!output || !output.window || output.window.isDestroyed()) {
            this.stopCapture(id)
            return
        }

        if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(output.window, id)
        const captureOptions = output.captureOptions

        // toggle values
        if (captureOptions && Object.keys(toggle).length > 0) this.updateCaptureToggles(id, captureOptions, toggle)

        const hasEnabledCapture = captureOptions.options && Object.values(captureOptions.options).some(Boolean)
        if (!hasEnabledCapture) {
            this.stopCapture(id)
            return
        }

        // a displayed output is captured from a hidden offscreen surface, never with capturePage on main
        OutputHelper.Lifecycle.createCaptureSurface(id)
        captureOptions.window = OutputHelper.renderWindow(output) || output.window

        this.activeCaptures.add(id)
        CaptureHelper.updateFramerate(id)
        CaptureHelper.Transmitter.startTransmitting(id)

        // OSR outputs are paint-driven: force a fresh paint so newly enabled consumers get a frame even on static content
        if (output.osr) {
            try {
                const wc = output.window.webContents
                if (!wc.isPainting()) wc.startPainting()
            } catch {
                // window tearing down
            }
            OutputHelper.Lifecycle.requestRepaint(id)
        }

        this.updateWebRtcHostState()
        this.updateRtmpState()

        // OSR outputs are driven by paint events; non-OSR runs the capture loop if not already running
        if (!output.osr && !captureOptions.frameSubscription) {
            const token = (this.captureLoopToken[id] || 0) + 1
            this.captureLoopToken[id] = token
            this.runCaptureLoop(id, token, output)
        }
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

        // Blackmagic backpressure is the card's own buffer depth, gated per frame in BlackmagicSender;
        // canAcceptFrame skips the capture entirely while it cannot take one.

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

        const channels = ["ndi", "omt", "blackmagic", "server", "stage", "webrtc", "rtmp", "recorder"]
        channels.forEach((channel) => CaptureHelper.Transmitter.stopChannel(id, channel))

        console.info("Capture - stopping: " + id)

        // a displayed output that shares a render keeps its surface: that is its page
        if (!OutputHelper.Lifecycle.sharesThroughSurface(id)) OutputHelper.Lifecycle.destroyCaptureSurface(id)
        delete output.captureOptions
        this.updateWebRtcHostState()
        this.updateRtmpState()
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
                        // a new stream starts on a black canvas, and a still page sends nothing to replace it
                        if (url && WebRtcHost.startWhip(o.id, url, token, { fps, bitrate })) OutputHelper.Lifecycle.requestRepaint(o.id)
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

    // H.264 at about a tenth of a bit per pixel per frame looks transparent for presentation content
    private static readonly RECORDING_BITS_PER_PIXEL = 0.1

    /** Public so a settings change (e.g. the encoder) can be applied without waiting for a capture event. */
    static updateRtmpState() {
        const allOutputs = OutputHelper.getAllOutputs()
        allOutputs.forEach((o) => {
            if (!o.id) return

            // a recording is one more destination of the same encode
            const streaming = !!o.rtmpData?.streaming
            const destinations = streaming ? (o.rtmpData!.destinations || []).filter((d) => d.enabled && d.url) : []
            const recording = OutputRecording.destination(o.id)
            if (recording) destinations.push(recording)
            if (!destinations.length) {
                RtmpStreamer.stop(o.id)
                return
            }

            // getBounds() is the DPI-corrected render size (halved on HiDPI for capture-only outputs),
            // so broadcast at the configured resolution instead
            const bounds = o.intendedBounds || o.window?.getBounds() || { width: 1920, height: 1080 }
            const recordFps = o.captureOptions?.framerates?.recorder || CaptureHelper.defaultFramerates().recorder
            const fps = streaming && o.rtmpData!.fps ? Number(o.rtmpData!.fps) : streaming ? 30 : recordFps
            // a recording alone is encoded at a bitrate proportional to its pixel rate, not a streaming budget
            const bitrate = streaming && o.rtmpData!.bitrate ? Number(o.rtmpData!.bitrate) : streaming ? 4000 : Math.round((bounds.width * bounds.height * fps * this.RECORDING_BITS_PER_PIXEL) / 1000)
            if (o.captureOptions?.framerates) o.captureOptions.framerates.rtmp = fps

            const starting = !RtmpStreamer.isRunning(o.id)
            // destination changes only touch relays; the encode keeps running
            // an encoder that starts on a still page needs one frame to begin, once the worker is running it
            void RtmpStreamer.update(o.id, { width: bounds.width, height: bounds.height, fps, bitrate, rateControl: o.rtmpData?.rateControl, enableAudio: isAudioEnabled(), encoder: getRtmpEncoderSetting(o.id) }, destinations).then(() => {
                if (starting) OutputHelper.Lifecycle.requestRepaint(o.id)
            })
        })
    }
}
