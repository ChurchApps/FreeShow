import { NativeImage } from "electron"
import { CaptureHelper } from "./CaptureHelper"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { OutputHelper } from "../output/OutputHelper"

export class CaptureLifecycle {
    static startCapture(id: string, toggle: any = {}) {
        let window = OutputHelper.getOutput(id)?.window
        let windowIsRemoved = !window || window.isDestroyed()
        if (windowIsRemoved) {
            delete CaptureHelper.captures[id]
            return
        }

        if (!CaptureHelper.captures[id]) CaptureHelper.captures[id] = CaptureHelper.getDefaultCapture(window, id)

        Object.keys(toggle).map((key) => {
            CaptureHelper.captures[id].options[key] = toggle[key]
        })

        CaptureHelper.updateFramerate(id)

        if (CaptureHelper.captures[id].subscribed) return
        CaptureTransmitter.startTransmitting(id)
        CaptureHelper.captures[id].subscribed = true

        cpuCapture()
        async function cpuCapture() {
            if (!CaptureHelper.captures[id] || CaptureHelper.captures[id].window.isDestroyed()) return
            let image = await CaptureHelper.captures[id].window.webContents.capturePage()
            processFrame(image)
            let frameRate = CaptureHelper.captures[id].framerates.ndi
            if (CaptureHelper.captures[id].framerates.server > frameRate) frameRate = CaptureHelper.captures[id].framerates.server
            const ms = Math.round(1000 / frameRate)
            setTimeout(cpuCapture, ms)
        }

        function processFrame(image: NativeImage) {
            CaptureHelper.storedFrames[id] = image
        }
    }

    // STOP

    static stopAllCaptures() {
        Object.keys(CaptureHelper.captures).forEach(this.stopCapture)
    }

    static stopCapture(id: string) {
        return new Promise((resolve) => {
            if (!CaptureHelper.captures[id]) return resolve(true)
            CaptureTransmitter.removeAllChannels(id)
            let windowIsRemoved = !CaptureHelper.captures[id].window || CaptureHelper.captures[id].window.isDestroyed()
            if (windowIsRemoved) return deleteAndResolve()

            console.log("Capture - stopping: " + id)

            endSubscription()
            removeListeners()
            deleteAndResolve()

            function deleteAndResolve() {
                delete CaptureHelper.captures[id]
                resolve(true)
            }
        })

        function endSubscription() {
            if (!CaptureHelper.captures[id].subscribed) return

            CaptureHelper.captures[id].window.webContents.endFrameSubscription()
            CaptureHelper.captures[id].subscribed = false
        }

        function removeListeners() {
            CaptureHelper.captures[id].window.removeAllListeners()
            CaptureHelper.captures[id].window.webContents.removeAllListeners()
        }
    }
}
