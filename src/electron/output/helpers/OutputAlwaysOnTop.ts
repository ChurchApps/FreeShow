import { execFile } from "child_process"
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

// Windows only: use DWM to exclude the window from "Aero Peek"
// this prevents the output from being hidden when the user peeks at the taskbar
function setExcludedFromAeroPeek(handle: Buffer, state: boolean) {
    const hwnd = (handle.length === 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0)).toString()
    const enabled = state ? 1 : 0

    // PowerShell script to call DwmSetWindowAttribute
    const command = `
        $t = Add-Type -MemberDefinition '[DllImport("dwmapi.dll")]public static extern int DwmSetWindowAttribute(IntPtr h,int a,ref int v,int s);' -Name "Dwm${hwnd}" -PassThru
        [int]$v = ${enabled}
        11,12 | ForEach-Object { $t::DwmSetWindowAttribute([IntPtr]${hwnd}, $_, [ref]$v, 4) }
    `
    const encodedCommand = Buffer.from(command, "utf16le").toString("base64")

    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encodedCommand], { windowsHide: true }, (error) => {
        if (error) console.warn("Could not update output Aero Peek visibility:", error)
    })
}
