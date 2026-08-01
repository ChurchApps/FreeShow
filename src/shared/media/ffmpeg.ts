// ----- FreeShow -----
// Electron-free ffmpeg lookup, mirroring src/electron/streaming/ffmpegManager.ts:
// prefer a system ffmpeg on PATH, otherwise use the static binary that the desktop app
// downloads into its user-data "bin" folder.
//
// ffmpeg is OPTIONAL for the headless server — callers must handle it being absent
// (video thumbnails simply fall back to streaming the original).

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"

const BIN_NAME = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"

let cachedPath: string | null | undefined

function isRunnable(binPath: string): boolean {
    try {
        execFileSync(binPath, ["-version"], { stdio: "ignore", windowsHide: true })
        return true
    } catch {
        return false
    }
}

/** Extra directories to look in (e.g. the desktop app's downloaded-binary folder). */
function candidateDirs(): string[] {
    const dirs: string[] = []
    if (process.env.FREESHOW_FFMPEG_DIR) dirs.push(process.env.FREESHOW_FFMPEG_DIR)

    // where the desktop app downloads its static build (app.getPath("userData")/bin)
    const home = process.env.HOME || process.env.USERPROFILE || ""
    if (home) {
        if (process.platform === "darwin") dirs.push(path.join(home, "Library", "Application Support", "freeshow", "bin"))
        else if (process.platform === "win32") dirs.push(path.join(home, "AppData", "Roaming", "freeshow", "bin"))
        else dirs.push(path.join(home, ".config", "freeshow", "bin"))
    }
    return dirs
}

/** Absolute path (or bare "ffmpeg") if available, else null. Result is cached. */
export function getFfmpegPath(): string | null {
    if (cachedPath !== undefined) return cachedPath

    // explicit override wins
    if (process.env.FREESHOW_FFMPEG && isRunnable(process.env.FREESHOW_FFMPEG)) {
        cachedPath = process.env.FREESHOW_FFMPEG
        return cachedPath
    }

    // system ffmpeg on PATH
    if (isRunnable(BIN_NAME)) {
        cachedPath = BIN_NAME
        return cachedPath
    }

    // static binary downloaded by the desktop app
    for (const dir of candidateDirs()) {
        const binPath = path.join(dir, BIN_NAME)
        try {
            if (fs.existsSync(binPath) && fs.statSync(binPath).isFile() && isRunnable(binPath)) {
                cachedPath = binPath
                return cachedPath
            }
        } catch {
            // keep looking
        }
    }

    cachedPath = null
    return cachedPath
}

export function isFfmpegAvailable(): boolean {
    return getFfmpegPath() !== null
}

/** Only for tests — forget the cached lookup. */
export function resetFfmpegPathCache() {
    cachedPath = undefined
}
