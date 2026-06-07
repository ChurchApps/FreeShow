import { execFile } from "child_process"
import type { BrowserWindow } from "electron"

const OUTPUT_ALWAYS_ON_TOP_LEVEL = process.platform === "win32" ? "screen-saver" : "pop-up-menu"
const DWMWA_DISALLOW_PEEK = 11
const DWMWA_EXCLUDED_FROM_PEEK = 12
const DWM_PEEK_ATTRIBUTES = [DWMWA_DISALLOW_PEEK, DWMWA_EXCLUDED_FROM_PEEK]
const DWM_PEEK_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class FreeShowDwm {
    [DllImport("dwmapi.dll")]
    public static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);
}
"@

function Set-FreeShowDwmAttributes {
    param(
        [Int64]$HwndValue,
        [Int32]$Enabled,
        [Int32[]]$Attributes
    )

    $hwnd = [IntPtr]::new($HwndValue)

    foreach ($attribute in $Attributes) {
        $result = [FreeShowDwm]::DwmSetWindowAttribute($hwnd, $attribute, [ref]$Enabled, 4)
        if ($result -ne 0) {
            exit $result
        }
    }
}
`

export function setOutputAlwaysOnTop(window: BrowserWindow, value: boolean) {
    window.setAlwaysOnTop(value, OUTPUT_ALWAYS_ON_TOP_LEVEL, 1)
    setExcludedFromAeroPeek(window, value)
}

function setExcludedFromAeroPeek(window: BrowserWindow, value: boolean) {
    if (process.platform !== "win32") return

    const hwnd = getWindowHandle(window)
    if (!hwnd) return

    const enabled = value ? 1 : 0
    const attributes = DWM_PEEK_ATTRIBUTES.join(",")
    const command = [DWM_PEEK_SCRIPT, `Set-FreeShowDwmAttributes -HwndValue ${hwnd} -Enabled ${enabled} -Attributes ${attributes}`].join("\n")
    const encodedCommand = Buffer.from(command, "utf16le").toString("base64")
    const args = ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encodedCommand]

    execFile("powershell.exe", args, { windowsHide: true }, (error) => {
        if (error) console.warn("Could not update output Aero Peek visibility:", error.message)
    })
}

function getWindowHandle(window: BrowserWindow) {
    const handle = window.getNativeWindowHandle()

    if (handle.length >= 8) return handle.readBigUInt64LE(0).toString()
    if (handle.length >= 4) return handle.readUInt32LE(0).toString()

    return ""
}
