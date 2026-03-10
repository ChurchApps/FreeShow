import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { OutputHelper } from "../../output/OutputHelper"
import { CaptureHelper } from "../CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"

export class CaptureLifecycle {
    private static captureLoopToken: { [key: string]: number } = {}
    private static activeCaptures: Set<string> = new Set()

    static startCapture(id: string, toggle: { [key: string]: boolean } = {}) {
        const output = OutputHelper.getOutput(id)
        if (!output) return

        // CRITICAL FIX: If capture is already active, just update toggles without restarting
        // Restarting the loop causes performance issues and potential memory leaks
        const isAlreadyActive = this.activeCaptures.has(id)
        const hasToggleChanges = Object.keys(toggle).length > 0

        if (isAlreadyActive) {
            if (!hasToggleChanges) {
                return
            }

            // Just update the toggle options without stopping the capture loop
            if (output.captureOptions) {
                const captureOpts = output.captureOptions.options || {}
                for (const key of Object.keys(toggle)) {
                    // turn off capture
                    if (captureOpts[key] && !toggle[key]) CaptureTransmitter.stopChannel(id, key)
                    // set capture on/off
                    captureOpts[key] = toggle[key]
                }
                output.captureOptions.options = captureOpts
                CaptureHelper.Transmitter.startTransmitting(id)
            }
            return
        }

        const window = output.window
        const windowIsRemoved = !window || window.isDestroyed()
        if (windowIsRemoved) {
            this.activeCaptures.delete(id)
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

        if (output.captureOptions.frameSubscription) {
            clearTimeout(output.captureOptions.frameSubscription)
        }

        const token = (this.captureLoopToken[id] || 0) + 1
        this.captureLoopToken[id] = token

        // IMPORTANT: Only add to activeCaptures right before starting the actual loop
        // This prevents false positives from early returns
        this.activeCaptures.add(id)

        captureFrame()

        async function captureFrame() {
            const loopStartedAt = Date.now()

            if (CaptureLifecycle.captureLoopToken[id] !== token) {
                CaptureLifecycle.activeCaptures.delete(id)
                return
            }
            if (!output?.captureOptions?.window || output.captureOptions.window.isDestroyed()) {
                CaptureLifecycle.activeCaptures.delete(id)
                return
            }

            // If Blackmagic is active but can't accept frames, skip capture entirely
            // This includes checking if previous frame is still being processed
            const isBMD = output.captureOptions?.options?.blackmagic
            if (isBMD && !BlackmagicSender.canAcceptFrame(id)) {
                // Skip this frame - Blackmagic is still processing previous frame or queue is full
                const ms = Math.max(1, Math.round(1000 / 60))
                output.captureOptions.frameSubscription = setTimeout(captureFrame, ms)
                return
            }

            try {
                let image = await output.captureOptions.window.webContents.capturePage()

                // Resize to target resolution for Blackmagic outputs (if screen scaling is not 100%)
                let finalImage = image

                if (isBMD) {
                    const targetSize = BlackmagicSender.getTargetDimensions(id)
                    const currentSize = image.getSize()
                    if (currentSize.width !== targetSize.width || currentSize.height !== targetSize.height) {
                        // Resize and immediately replace original to release it
                        finalImage = image.resize({ width: targetSize.width, height: targetSize.height })
                        image = null as any // Release original large frame
                    }
                }

                // Send frame to all active channels immediately
                CaptureTransmitter.transmitFrame(id, finalImage)

                // CRITICAL: Release the NativeImage after transmission to prevent memory accumulation
                finalImage = null as any
            } catch (error) {
                console.warn(`Capture failed for output ${id}:`, error)
            }

            if (CaptureLifecycle.captureLoopToken[id] !== token) {
                CaptureLifecycle.activeCaptures.delete(id)
                return
            }
            if (!output.captureOptions) {
                CaptureLifecycle.activeCaptures.delete(id)
                return
            }
            // Use highest frame rate among active channels.
            const frameRates = output.captureOptions.framerates || {}
            const maxOutputRate = Math.max(frameRates.ndi || 1, frameRates.blackmagic || 1, frameRates.server || 1, frameRates.stage || 1)
            const baseCaptureFrameRate = Math.max(1, maxOutputRate)

            // Adaptive backpressure: reduce capture FPS only at high memory levels.
            const externalMB = process.memoryUsage().external / (1024 * 1024)
            let captureFrameRate = baseCaptureFrameRate
            if (isBMD) {
                if (externalMB > 6144) captureFrameRate = Math.min(baseCaptureFrameRate, 4)
                else if (externalMB > 5120) captureFrameRate = Math.min(baseCaptureFrameRate, 6)
                else if (externalMB > 4096) captureFrameRate = Math.min(baseCaptureFrameRate, 8)
                else if (externalMB > 3072) captureFrameRate = Math.min(baseCaptureFrameRate, 10)
            }

            const targetIntervalMs = Math.max(1, Math.round(1000 / Math.max(1, captureFrameRate)))
            const loopElapsedMs = Date.now() - loopStartedAt
            const ms = Math.max(1, targetIntervalMs - loopElapsedMs)
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
        this.activeCaptures.delete(id)

        endSubscription()

        CaptureHelper.Transmitter.stopChannel(id, "ndi")
        CaptureHelper.Transmitter.stopChannel(id, "blackmagic")
        CaptureHelper.Transmitter.stopChannel(id, "server")
        CaptureHelper.Transmitter.stopChannel(id, "stage")
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
