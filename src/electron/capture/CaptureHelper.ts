import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
import { OutputHelper } from "../output/OutputHelper"
import type { CaptureOptions } from "./CaptureOptions"
import { CaptureLifecycle } from "./helpers/CaptureLifecycle"
import { CaptureTransmitter } from "./helpers/CaptureTransmitter"

export class CaptureHelper {
    static Lifecycle = CaptureLifecycle
    static Transmitter = CaptureTransmitter

    private static framerates: { [key: string]: number } = {
        stage: 20, // StageShow
        server: 10, // 30 // OutputShow
        unconnected: 1,
        connected: 30 // NDI
    }
    static customFramerates: { [key: string]: { [key: string]: number } } = {}

    static getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
        const screen: Display = this.getWindowScreen(window)

        const defaultFramerates = {
            ndi: this.framerates.connected,
            server: this.framerates.server,
            stage: this.framerates.stage
        }

        return {
            window,
            frameSubscription: null,
            displayFrequency: screen.displayFrequency || 60,
            options: { ndi: false, server: false, stage: false },
            framerates: defaultFramerates,
            id
        }
    }

    // START

    static storedFrames: { [key: string]: NativeImage } = {}

    static updateFramerate(id: string) {
        const output = OutputHelper.getOutput(id)
        const captureOptions = output?.captureOptions
        if (!captureOptions) return

        if (NdiSender.NDI[id]) {
            let ndiFramerate = this.framerates.unconnected
            if (NdiSender.NDI[id].status === "connected") ndiFramerate = this.customFramerates[id]?.ndi || this.framerates.connected

            if (captureOptions.framerates.ndi !== parseInt(ndiFramerate.toString(), 10)) {
                output.captureOptions!.framerates.ndi = parseInt(ndiFramerate.toString(), 10)
                OutputHelper.setOutput(id, output)
                CaptureTransmitter.startChannel(id, "ndi")
            }
        }
    }

    static getWindowScreen(window: BrowserWindow) {
        return electron.screen.getDisplayMatching({
            x: window.getBounds().x,
            y: window.getBounds().y,
            width: window.getBounds().width,
            height: window.getBounds().height
        })
    }

    static async captureBase64Frame(window: BrowserWindow) {
        return (await window.capturePage()).toDataURL({ scaleFactor: 0.5 })
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
        else image = image.resize({ height: newSize.height })

        return image
    }
}
