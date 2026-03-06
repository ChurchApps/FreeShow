import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { OutputHelper } from "../../output/OutputHelper"
import { CaptureHelper } from "../CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"

export class CaptureLifecycle {
    private static captureLoopToken: { [key: string]: number } = {}

    static startCapture(id: string, toggle: { [key: string]: boolean } = {}) {
        const output = OutputHelper.getOutput(id)
        if (!output) return

        const window = output.window
        const windowIsRemoved = !window || window.isDestroyed()
        if (windowIsRemoved) {
            delete output.captureOptions
            return
        }

        if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(window, id)

        if (output.captureOptions) {
            const captureOpts = output.captureOptions?.options || {}
            for (const key of Object.keys(toggle)) {
                // turn off capture
                if (captureOpts[key] && !toggle[key]) CaptureTransmitter.stopChannel(id, key)
                // set capture on/off
                captureOpts[key] = toggle[key]
            }
            output.captureOptions.options = captureOpts
        }

        const hasEnabledCapture = !!output.captureOptions?.options && Object.values(output.captureOptions.options).some(Boolean)
        if (!output.captureOptions?.options || !hasEnabledCapture || output.captureOptions.window.isDestroyed()) {
            // Ensure any existing capture loop is stopped when capture is disabled.
            if (output.captureOptions?.frameSubscription) {
                clearTimeout(output.captureOptions.frameSubscription)
                output.captureOptions.frameSubscription = null
            }
            return
        }

        CaptureHelper.updateFramerate(id)
        CaptureHelper.Transmitter.startTransmitting(id)

        if (output.captureOptions.frameSubscription) clearTimeout(output.captureOptions.frameSubscription)

        const token = (this.captureLoopToken[id] || 0) + 1
        this.captureLoopToken[id] = token

        captureFrame()
        async function captureFrame() {
            if (CaptureLifecycle.captureLoopToken[id] !== token) return
            if (!output?.captureOptions?.window || output.captureOptions.window.isDestroyed()) return

            try {
                let image = await output.captureOptions.window.webContents.capturePage()

                // Resize to target resolution for Blackmagic outputs (if screen scaling is not 100%)
                if (output.captureOptions?.options?.blackmagic) {
                    const targetSize = BlackmagicSender.getTargetDimensions(id)
                    const currentSize = image.getSize()
                    if (currentSize.width !== targetSize.width || currentSize.height !== targetSize.height) {
                        image = image.resize({ width: targetSize.width, height: targetSize.height })
                    }
                }

                CaptureHelper.storedFrames[id] = image
            } catch (error) {
                console.warn(`Capture failed for output ${id}:`, error)
            }

            if (CaptureLifecycle.captureLoopToken[id] !== token) return
            if (!output.captureOptions) return

            // use highest frame rate
            const frameRates = output.captureOptions.framerates || {}
            const frameRate = Math.max(frameRates.ndi || 1, frameRates.blackmagic || 1, frameRates.server || 1, frameRates.stage || 1)

            const ms = Math.max(1, Math.round(1000 / Math.max(1, frameRate)))
            output.captureOptions.frameSubscription = setTimeout(captureFrame, ms)
        }
    }

    // STOP
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

        endSubscription()

        CaptureHelper.Transmitter.removeAllChannels(id)
        const windowIsRemoved = !capture.window || capture.window.isDestroyed()
        if (windowIsRemoved) {
            delete output.captureOptions
            return
        }

        console.info("Capture - stopping: " + id)

        // remove listeners
        capture?.window.removeAllListeners()
        capture?.window.webContents.removeAllListeners()

        delete output.captureOptions

        function endSubscription() {
            if (!capture?.frameSubscription) return

            clearTimeout(capture.frameSubscription)
            capture.frameSubscription = null
        }
    }
}
