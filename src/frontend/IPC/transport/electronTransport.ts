// ----- FreeShow -----
// Electron transport: the preload script (src/electron/preload.ts) exposes the
// IPC bridge as `window.electronAPI` via contextBridge. This adapter returns it
// so the renderer can install it onto the writable `window.api`. (Older preloads
// exposed it directly as `window.api`; fall back to that for safety.)

import type { FreeShowApi } from "./types"

export function getElectronApi(): FreeShowApi | undefined {
    if (typeof window === "undefined") return undefined
    return window.electronAPI || window.api
}
