import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { OutputHelper } from "../../output/OutputHelper"
import { CaptureHelper } from "../CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { WebRtcHost } from "../../webrtc/WebRtcHost"

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
            }
            return
        }

        if (!output.window || output.window.isDestroyed()) {
            this.activeCaptures.delete(id)
            delete output.captureOptions
            return
        }

        if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(output.window, id)
        const captureOptions = output.captureOptions

        // toggle values
        if (captureOptions && Object.keys(toggle).length > 0) this.updateCaptureToggles(id, captureOptions, toggle)

        const hasEnabledCapture = captureOptions?.options && Object.values(captureOptions.options).some(Boolean)
        if (!hasEnabledCapture || captureOptions?.window.isDestroyed()) {
            if (captureOptions?.frameSubscription) {
                clearTimeout(captureOptions.frameSubscription)
                captureOptions.frameSubscription = null
            }
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

        this.runCaptureLoop(id, token, output)
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

            if (!this.shouldContinueCapture(id, token, captureOpts)) return

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
        return true
    }

    private static async captureAndProcessFrame(id: string, captureOpts: any) {
        let image = await captureOpts.window.webContents.capturePage()

        // Blackmagic only - resize if needed
        if (captureOpts.options?.blackmagic) {
            const targetSize = BlackmagicSender.getTargetDimensions(id)
            const currentSize = image.getSize()
            if (currentSize.width !== targetSize.width || currentSize.height !== targetSize.height) {
                image = image.resize({ width: targetSize.width, height: targetSize.height })
            }
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

        return baseCaptureFrameRate
    }

    static stopAllCaptures() {
        OutputHelper.getAllOutputs().forEach((output) => {
            if (output.captureOptions) this.stopCapture(output.id)
        })
    }

    static stopCapture(id: string) {
        const output = OutputHelper.getOutput(id)
        const capture = output?.captureOptions
        if (!capture) return

        this.captureLoopToken[id] = (this.captureLoopToken[id] || 0) + 1
        this.activeCaptures.delete(id)

        if (capture.frameSubscription) {
            clearTimeout(capture.frameSubscription)
            capture.frameSubscription = null
        }

        const channels = ["ndi", "blackmagic", "server", "stage", "webrtc"]
        channels.forEach((channel) => CaptureHelper.Transmitter.stopChannel(id, channel))

        console.info("Capture - stopping: " + id)

        this.cleanupListeners(capture.window)
        delete output.captureOptions
        this.updateWebRtcHostState()
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
        const webrtcActive = allOutputs.some((o) => o.captureOptions?.options?.webrtc)

        if (webrtcActive) {
            const wasRunning = WebRtcHost.isRunning()
            WebRtcHost.start()

            const sendStartSignals = () => {
                allOutputs.forEach((o) => {
                    if (!o.id) return

                    if (o.captureOptions?.options?.webrtc) {
                        const url = o.webrtcData?.url || ""
                        const token = o.webrtcData?.token || ""
                        if (url) WebRtcHost.startWhip(o.id, url, token)
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
}
