// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _macadam: any // undefined = not yet tried; null = unavailable

// lazy-load macadam to avoid COM initialization at startup on Windows
export function getMacadam(): typeof import("macadam") | null {
    if (_macadam === undefined) {
        try {
            _macadam = require("macadam")
        } catch (err) {
            console.warn("Blackmagic macadam module not available:", err instanceof Error ? err.message : String(err))
            _macadam = null
        }
    }

    return _macadam
}
