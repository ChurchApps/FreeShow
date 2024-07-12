import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { CaptureOptions } from "./CaptureOptions"
import { CaptureLifecycle } from "./CaptureLifecycle"

export class CaptureHelper {
    static captures: { [key: string]: CaptureOptions } = {}
    static Lifecycle = CaptureLifecycle

    private static framerates: any = {
        server: 30,
        unconnected: 1,
        connected: 30,
    }
    static customFramerates: any = {}

    static getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
        let screen: Display = this.getWindowScreen(window)

        let defaultFramerates = {
            server: this.framerates.server,
            ndi: this.framerates.connected,
        }

        return {
            window,
            subscribed: false,
            displayFrequency: screen.displayFrequency || 60,
            options: { server: false, ndi: false },
            framerates: defaultFramerates,
            id,
        }
    }

    // START

    static storedFrames: any = {}

    static updateFramerate(id: string) {
        if (!this.captures[id]) return

        if (NdiSender.NDI[id]) {
            let ndiFramerate = this.framerates.unconnected
            if (NdiSender.NDI[id].status === "connected") ndiFramerate = this.customFramerates[id]?.ndi || this.framerates.connected

            if (this.captures[id].framerates.ndi !== parseInt(ndiFramerate)) {
                this.captures[id].framerates.ndi = parseInt(ndiFramerate)
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
