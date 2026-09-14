import os from "os"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _macadam: any // undefined = not yet tried; null = unavailable

// lazy-load macadam to avoid COM initialization at startup on Windows
export function getMacadam(): typeof import("macadam") | null {
    if (_macadam === undefined) {
        try {
            _macadam = require("macadam")
        } catch (err) {
            let message = err instanceof Error ? err.message : String(err)

            if (os.platform() === "win32" && message.includes("Failed to load shared library")) {
                message += "\n\nYou are likely missing the Visual C++ Redistributable. You can download and install it from here: https://aka.ms/vs/17/release/vc_redist.x64.exe"
            }

            console.warn("Failed to init Blackmagic communication module:", message)
            _macadam = null
        }
    }

    return _macadam
}
