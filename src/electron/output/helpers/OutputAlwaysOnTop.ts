import { execFile } from "child_process"
import { app } from "electron"
import path from "path"
import type { BrowserWindow } from "electron"

const OUTPUT_ALWAYS_ON_TOP_LEVEL = process.platform === "win32" ? "screen-saver" : "pop-up-menu"

export function setOutputAlwaysOnTop(window: BrowserWindow, value: boolean) {
    if (window.isDestroyed()) return

    try {
        window.setAlwaysOnTop(value, OUTPUT_ALWAYS_ON_TOP_LEVEL, 1)

        if (process.platform === "win32") {
            const handle = window.getNativeWindowHandle()
            setExcludedFromAeroPeek(handle, value)
        }
    } catch (err) {
        console.warn("Failed to set always on top:", err)
    }
}

// Windows only: use a helper executable to exclude the window from "Aero Peek" via DWM
// this prevents the output from being hidden when the user peeks at the taskbar
function setExcludedFromAeroPeek(handle: Buffer, state: boolean) {
    const hwnd = (handle.length === 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0)).toString()
    const enabled = state ? "1" : "0"

    const helperPath = path.join(app.getAppPath(), "public", "assets", "bin", "aero-peek-helper.exe")

    execFile(helperPath, [hwnd, enabled], { windowsHide: true }, (error) => {
        if (error) console.warn("Could not update output Aero Peek visibility:", error)
    })
}
