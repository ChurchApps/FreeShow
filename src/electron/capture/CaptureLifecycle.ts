import { NativeImage } from "electron"
import { CaptureHelper } from "./CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { OutputHelper } from "../output/OutputHelper"

export class CaptureLifecycle {
    static startCapture(id: string, toggle: any = {}) {
        const output = OutputHelper.getOutput(id)
        let window = output?.window
        let windowIsRemoved = !window || window.isDestroyed()
        if (windowIsRemoved) {
            delete output.captureOptions
            return
        }

        if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(window, id)

        if (output.captureOptions) {
            const capture = output.captureOptions
            Object.keys(toggle).map((key) => {
                capture.options[key] = toggle[key]
            })
        }

        CaptureHelper.updateFramerate(id)

        if (output.captureOptions.subscribed) return
        CaptureTransmitter.startTransmitting(id)
        output.captureOptions.subscribed = true

        cpuCapture()
        async function cpuCapture() {
            if (!output.captureOptions || output.captureOptions.window.isDestroyed()) return
            let image = await output.captureOptions.window.webContents.capturePage()
            processFrame(image)
            let frameRate = output.captureOptions.framerates.ndi
            if (output.captureOptions.framerates.server > frameRate) frameRate = output.captureOptions.framerates.server
            const ms = Math.round(1000 / frameRate)
            setTimeout(cpuCapture, ms)
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
            CaptureTransmitter.removeAllChannels(id)
            let windowIsRemoved = !capture.window || capture.window.isDestroyed()
            if (windowIsRemoved) return deleteAndResolve()

            console.log("Capture - stopping: " + id)

            endSubscription()
            removeListeners()
            deleteAndResolve()

            function deleteAndResolve() {
                delete output.captureOptions
                resolve(true)
            }
        })

        function endSubscription() {
            if (!capture?.subscribed) return

            capture.window.webContents.endFrameSubscription()
            capture.subscribed = false
        }

        function removeListeners() {
            capture?.window.removeAllListeners()
            capture?.window.webContents.removeAllListeners()
        }
    }
}
