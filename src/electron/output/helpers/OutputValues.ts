import { BrowserWindow } from "electron"
import { NdiSender } from "../../ndi/NdiSender"
import { OutputHelper } from "../OutputHelper"
import { CaptureHelper } from "../../capture/CaptureHelper"

export class OutputValues {
    private static setValues: any = {
        ndi: async (value: boolean, window: BrowserWindow, id: string) => {
            if (value) await NdiSender.createSenderNDI(id, window.getTitle())
            else NdiSender.stopSenderNDI(id)

            this.setValues.capture({ key: "ndi", value }, window, id)
        },
        capture: async (data: any, _window: BrowserWindow, id: string) => {
            CaptureHelper.Lifecycle.startCapture(id, { [data.key]: data.value })
            // if (data.value) sendFrames(id, storedFrames[id], {[data.key]: true})
        },
        transparent: (value: boolean, window: BrowserWindow) => {
            window.setBackgroundColor(value ? "#00000000" : "#000000")
        },
        alwaysOnTop: (value: boolean, window: BrowserWindow) => {
            window.setAlwaysOnTop(value, "pop-up-menu", 1)
            window.setResizable(!value)
            window.setSkipTaskbar(value)
        },
        kioskMode: (value: boolean, window: BrowserWindow) => {
            window.setKiosk(value)
        },
    }

    static async updateValue({ id, key, value }: any) {
        const output = OutputHelper.getOutput(id)
        if (!this.setValues[key]) return

        if (!output?.window || output.window.isDestroyed()) return
        this.setValues[key](value, output.window, id)
    }
}
