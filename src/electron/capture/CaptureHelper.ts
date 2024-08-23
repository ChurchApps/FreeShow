import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
import { CaptureTransmitter } from "./helpers/CaptureTransmitter"
import { CaptureOptions } from "./CaptureOptions"
import { CaptureLifecycle } from "./helpers/CaptureLifecycle"
import { OutputHelper } from "../output/OutputHelper"

export class CaptureHelper {
    static Lifecycle = CaptureLifecycle
    static Transmitter = CaptureTransmitter

    private static framerates: any = {
        stage: 20,
        server: 30,
        unconnected: 1,
        connected: 30,
    }
    static customFramerates: any = {}

    static getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
        let screen: Display = this.getWindowScreen(window)

        let defaultFramerates = {
            ndi: this.framerates.connected,
            server: this.framerates.server,
            stage: this.framerates.stage,
        }

        return {
            window,
            frameSubscription: null,
            displayFrequency: screen.displayFrequency || 60,
            options: { ndi: false, server: false, stage: false },
            framerates: defaultFramerates,
            id,
        }
    }

    // START

    static storedFrames: { [key: string]: NativeImage } = {}

    static updateFramerate(id: string) {
        const captureOptions = OutputHelper.getOutput(id)?.captureOptions
        if (!captureOptions) return

        if (NdiSender.NDI[id]) {
            let ndiFramerate = this.framerates.unconnected
            if (NdiSender.NDI[id].status === "connected") ndiFramerate = this.customFramerates[id]?.ndi || this.framerates.connected

            if (captureOptions.framerates.ndi !== parseInt(ndiFramerate)) {
                captureOptions.framerates.ndi = parseInt(ndiFramerate)
                CaptureTransmitter.startChannel(id, "ndi")
            }
        }
    }

    static getWindowScreen(window: BrowserWindow) {
        return electron.screen.getDisplayMatching({
            x: window.getBounds().x,
            y: window.getBounds().y,
            width: window.getBounds().width,
            height: window.getBounds().height,
        })
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
        else image = image.resize({ height: newSize.height })

        return image
    }
}
