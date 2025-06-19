import type { BrowserWindow } from "electron"
import { CaptureHelper } from "../../capture/CaptureHelper"
import { NdiSender } from "../../ndi/NdiSender"
import { OutputHelper } from "../OutputHelper"
import type { Output } from "../Output"

const setValues = {
    ndi: async (value: boolean, window: BrowserWindow, id: string) => {
        if (value) await NdiSender.createSenderNDI(id, window.getTitle())
        else NdiSender.stopSenderNDI(id)

        setValues.capture({ key: "ndi", value }, window, id)
    },
    rtpm: async (value: boolean, window: BrowserWindow, id: string) => {
        setValues.capture({ key: "rtmp", value }, window, id)
    },
    capture: (data: { key: string; value: boolean }, _window: BrowserWindow, id: string) => {
        CaptureHelper.Lifecycle.startCapture(id, { [data.key]: data.value })
        // if (data.value) sendFrames(id, storedFrames[id], {[data.key]: true})
    },
    transparent: (value: boolean, window: BrowserWindow) => {
        window.setBackgroundColor(value ? "#00000000" : "#000000")
    },
    alwaysOnTop: (value: boolean, window: BrowserWindow, _id: string, output: Output) => {
        window.setAlwaysOnTop(value, "pop-up-menu", 1)
        window.setSkipTaskbar(value)
        if (output.boundsLocked !== true) window.setResizable(!value)
    },
    kioskMode: (value: boolean, window: BrowserWindow) => {
        window.setKiosk(value)
    }
}

export class OutputValues {
    static updateValue({ id, key, value }: { id: string; key: string; value: boolean | { key: string; value: boolean } }) {
        const output = OutputHelper.getOutput(id)
        if (!(key in setValues)) return

        if (!output?.window || output.window.isDestroyed()) return
        setValues[key as keyof typeof setValues](value as any, output.window, id, output)
    }
}
