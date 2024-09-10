import { NativeImage } from "electron"
import { CaptureHelper } from "../CaptureHelper"
import { OutputHelper } from "../../output/OutputHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"

export class CaptureLifecycle {
    static startCapture(id: string, toggle: any = {}) {
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
            Object.keys(toggle).map((key) => {
                // turn off capture
                if (captureOpts[key] && !toggle[key]) CaptureTransmitter.stopChannel(id, key)
                // set capture on/off
                captureOpts[key] = toggle[key]
            })
            output.captureOptions.options = captureOpts
        }

        if (!output.captureOptions?.options || !Object.values(output.captureOptions.options).filter((a) => a).length || output.captureOptions.window.isDestroyed()) return

        CaptureHelper.updateFramerate(id)
        CaptureHelper.Transmitter.startTransmitting(id)

        if (output.captureOptions.frameSubscription) clearTimeout(output.captureOptions.frameSubscription)

        captureFrame()
        async function captureFrame() {
            if (!output?.captureOptions?.window || output.captureOptions.window.isDestroyed()) return

            let image = await output.captureOptions.window.webContents.capturePage()
            processFrame(image)

            if (!output.captureOptions) return

            // use highest frame rate
            const frameRates = output.captureOptions.framerates
            const frameRate = Math.max(frameRates.ndi, frameRates.server, frameRates.stage)

            const ms = Math.round(1000 / frameRate)
            output.captureOptions.frameSubscription = setTimeout(captureFrame, ms)
        }

        function processFrame(image: NativeImage) {
            CaptureHelper.storedFrames[id] = image
        }
    }

    // STOP
    static stopAllCaptures() {
        OutputHelper.getAllOutputs().forEach((output) => {
            if (output[1].captureOptions) this.stopCapture(output[0])
        })
    }

    static stopCapture(id: string) {
        const output = OutputHelper.getOutput(id)
        const capture = output.captureOptions

        return new Promise((resolve) => {
            if (!capture) return resolve(true)

            CaptureHelper.Transmitter.removeAllChannels(id)
            const windowIsRemoved = !capture.window || capture.window.isDestroyed()
            if (windowIsRemoved) return deleteAndResolve()

            console.log("Capture - stopping: " + id)

            endSubscription()
            removeListeners()
            deleteAndResolve()

            function endSubscription() {
                if (!capture?.frameSubscription) return

                clearTimeout(capture.frameSubscription)
                capture.frameSubscription = null
            }

            function removeListeners() {
                capture?.window.removeAllListeners()
                capture?.window.webContents.removeAllListeners()
            }

            function deleteAndResolve() {
                delete output.captureOptions
                resolve(true)
            }
        })
    }
}
