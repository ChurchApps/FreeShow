// Loads "openmediatransport", shared by receiver and send worker.

import path from "path"
import { isMainThread } from "worker_threads"

// Ensure OMT VMX codec DLL is in PATH on Windows (main thread only)
let searchPathReady = false
export function ensureOmtCodecSearchPath() {
    if (searchPathReady || process.platform !== "win32" || !isMainThread) return
    searchPathReady = true

    try {
        const moduleDir = path.dirname(require.resolve("openmediatransport/package.json"))
        // packaged builds keep native modules outside the asar archive
        const addonDir = path.join(moduleDir.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`), "build", "Release")
        if (!(process.env.PATH || "").split(path.delimiter).includes(addonDir)) {
            process.env.PATH = `${addonDir}${path.delimiter}${process.env.PATH || ""}`
        }
    } catch {
        // not installed — the load below reports it
    }
}

let omtModule: any | null = null
let omtPromise: Promise<any | null> | null = null
let warned = false

export function loadOMT(): Promise<any | null> {
    if (omtModule) return Promise.resolve(omtModule)
    if (omtPromise) return omtPromise

    ensureOmtCodecSearchPath()

    omtPromise = import("openmediatransport")
        .then((imported: any) => {
            omtModule = imported
            return imported
        })
        .catch((err: any) => {
            if (!warned) console.warn("OMT not available:", err?.message || err)
            warned = true
            return null
        })
        .finally(() => {
            omtPromise = null
        })

    return omtPromise
}
