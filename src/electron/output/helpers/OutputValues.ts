import type { BrowserWindow } from "electron"
import { initializeSender } from "../../blackmagic/bmdTalk"
import { CaptureHelper } from "../../capture/CaptureHelper"
import type { Output as OutputWindow } from "../Output"
import { OutputHelper } from "../OutputHelper"
import type { Output } from "../../../types/Output"
import { setOutputAlwaysOnTop } from "./OutputAlwaysOnTop"

// SET_VALUE handles only values that can change on a LIVE window. Keys that affect window creation
// (transparent/invisible) or the window's offscreen (OSR) mode (the persistent ndi/webrtc/rtmp/blackmagic
// toggles) arrive as CREATE instead — createOutput on an existing id does a full teardown + rebuild with
// the new config, including the NDI/Blackmagic sender lifecycle — because OSR mode is fixed at window
// creation and cannot be flipped in place (see OutputLifecycle.isOsrOutput).
const setValues = {
    // Blackmagic DATA updates (displayMode/pixelFormat/etc.) on an already-enabled device output; the
    // blackmagic enable/disable toggle itself recreates the window via CREATE.
    blackmagic: (data: Output, window: BrowserWindow, id: string) => {
        initializeSender(data, window, id)
    },
    // webrtcData/rtmpData carry the RUNTIME streaming state (start/stop stream on a configured output) —
    // capture starts/stops but the window's OSR mode (from the persistent webrtc/rtmp flags) is unaffected.
    webrtcData: (value: any, _window: BrowserWindow, id: string, output: OutputWindow) => {
        output.webrtcData = value
        CaptureHelper.Lifecycle.startCapture(id, { webrtc: !!value?.streaming })
    },
    rtmpData: (value: any, _window: BrowserWindow, id: string, output: OutputWindow) => {
        output.rtmpData = value
        CaptureHelper.Lifecycle.startCapture(id, { rtmp: !!value?.streaming })
    },
    capture: (data: { key: string; value: boolean }, _window: BrowserWindow, id: string) => {
        CaptureHelper.Lifecycle.startCapture(id, { [data.key]: data.value })
    },
    alwaysOnTop: (value: boolean, window: BrowserWindow, _id: string, output: OutputWindow) => {
        setOutputAlwaysOnTop(window, value)
        // show in taskbar if not always on top, because this will also show it in Alt+Tab menu
        window.setSkipTaskbar(value)
        if (output.boundsLocked !== true) window.setResizable(!value)
    },
    boundsLocked: (value: boolean, _window: BrowserWindow, id: string, output: OutputWindow) => {
        output.boundsLocked = value
        OutputHelper.Lifecycle.updateWindowConstraints(id)
    }
}

export class OutputValues {
    static updateValue({ id, key, value }: { id: string; key: string; value: any }) {
        const output = OutputHelper.getOutput(id)
        if (!output) return
        if (!(key in setValues)) return

        if (!output.window || output.window.isDestroyed()) return
        setValues[key as keyof typeof setValues](value, output.window, id, output)
    }
}
