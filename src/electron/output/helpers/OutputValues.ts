import type { BrowserWindow } from "electron"
import { initializeSender } from "../../blackmagic/bmdTalk"
import { CaptureHelper } from "../../capture/CaptureHelper"
import { NdiSender } from "../../ndi/NdiSender"
import type { Output as OutputWindow } from "../Output"
import { OutputHelper } from "../OutputHelper"
import type { Output } from "../../../types/Output"

const setValues = {
    ndi: async (value: boolean, window: BrowserWindow, id: string) => {
        if (value) await NdiSender.createSenderNDI(id, NdiSender.initNameNDI(undefined, window.getTitle()))
        else NdiSender.stopSenderNDI(id)

        setValues.capture({ key: "ndi", value }, window, id)
    },
    blackmagic: (data: Output, window: BrowserWindow, id: string) => {
        initializeSender(data, window, id)
    },
    webrtc: (value: boolean, _window: BrowserWindow, id: string) => {
        if (!value) CaptureHelper.Lifecycle.startCapture(id, { webrtc: false })
    },
    webrtcData: (value: any, _window: BrowserWindow, id: string, output: OutputWindow) => {
        output.webrtcData = value
        CaptureHelper.Lifecycle.startCapture(id, { webrtc: !!value?.streaming })
    },
    capture: (data: { key: string; value: boolean }, _window: BrowserWindow, id: string) => {
        CaptureHelper.Lifecycle.startCapture(id, { [data.key]: data.value })
        // if (data.value) sendFrames(id, storedFrames[id], {[data.key]: true})
    },
    transparent: (value: boolean, window: BrowserWindow, _id: string, output: OutputWindow) => {
        window.setBackgroundColor(value ? "#00000000" : "#000000")
        output.transparent = value
    },
    alwaysOnTop: (value: boolean, window: BrowserWindow, _id: string, output: OutputWindow) => {
        window.setAlwaysOnTop(value, "pop-up-menu", 1)
        // show in taskbar if not always on top, because this will also show it in Alt+Tab menu
        window.setSkipTaskbar(value)
        if (output.boundsLocked !== true) window.setResizable(!value)
    },
    kioskMode: (value: boolean, window: BrowserWindow) => {
        window.setKiosk(value)
    }
}

export class OutputValues {
    static updateValue({ id, key, value }: { id: string; key: string; value: any }) {
        const output = OutputHelper.getOutput(id)
        if (!output) return
        if (!(key in setValues)) return

        if (key === "webrtcData") {
            output.webrtcData = value
        }

        if (!output.window || output.window.isDestroyed()) return
        setValues[key as keyof typeof setValues](value, output.window, id, output)
    }
}
