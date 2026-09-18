import { execFile } from "child_process"
import { app } from "electron"
import { createWriteStream, existsSync } from "fs"
import fs from "fs/promises"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { promisify } from "util"
import zlib from "zlib"

const execFileAsync = promisify(execFile)

// using pre-built, static ffmpeg binaries that can be downloaded at runtime
const FFMPEG_VERSION = "b6.1.1"

const IS_WIN = process.platform === "win32"
const BIN_NAME = IS_WIN ? "ffmpeg.exe" : "ffmpeg"

// resolving spawns a process, so the answer is cached and reused by the sync accessor
let resolvedPath: string | null = null
let resolvingPromise: Promise<string | null> | null = null

export const getFfmpegDir = (): string => path.join(app.getPath("userData"), "bin")
export const getFfmpegPathLocal = (): string => path.join(getFfmpegDir(), BIN_NAME)
export const getResolvedFfmpegPath = (): string | null => resolvedPath
export const clearFfmpegPathCache = (): void => {
    resolvedPath = null
}

const SYSTEM_PATHS: Record<string, string[]> = {
    darwin: ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg"],
    linux: ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"]
}

async function runsOk(binPath: string): Promise<boolean> {
    try {
        await execFileAsync(binPath, ["-version"], { windowsHide: true, timeout: 10000 })
        return true
    } catch {
        return false
    }
}

export async function resolveFfmpegPath(): Promise<string | null> {
    if (resolvedPath) return resolvedPath
    if (resolvingPromise) return resolvingPromise

    resolvingPromise = (async () => {
        const candidates = ["ffmpeg", ...(SYSTEM_PATHS[process.platform] || []), getFfmpegPathLocal()]

        for (const binPath of candidates) {
            if ((binPath === "ffmpeg" || existsSync(binPath)) && (await runsOk(binPath))) {
                resolvedPath = binPath
                return resolvedPath
            }
        }

        console.warn(`[ffmpegManager] No usable FFmpeg found.`)
        return null
    })().finally(() => {
        resolvingPromise = null
    })

    return resolvingPromise
}

export async function isFfmpegInstalled(): Promise<boolean> {
    return (await resolveFfmpegPath()) !== null
}

function getDownloadUrl(): string | null {
    const { platform, arch } = process
    const BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_VERSION}`

    const urls: Record<string, Record<string, string>> = {
        darwin: { arm64: `${BASE}/ffmpeg-darwin-arm64.gz`, x64: `${BASE}/ffmpeg-darwin-x64.gz` },
        win32: { x64: `${BASE}/ffmpeg-win32-x64.gz`, ia32: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-win32-ia32.gz" },
        linux: { x64: `${BASE}/ffmpeg-linux-x64.gz`, arm64: `${BASE}/ffmpeg-linux-arm64.gz`, arm: `${BASE}/ffmpeg-linux-arm.gz` }
    }

    return urls[platform]?.[arch] || null
}

export async function downloadFfmpeg(onProgress: (percent: number) => void): Promise<string> {
    const url = getDownloadUrl()
    if (!url) throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`)

    const binDir = getFfmpegDir()
    await fs.mkdir(binDir, { recursive: true })

    const tempPath = path.join(binDir, `${BIN_NAME}.download-${Date.now()}`)
    const destPath = getFfmpegPathLocal()

    const response = await fetch(url)
    if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`)

    const totalBytes = Number(response.headers.get("content-length")) || 0
    let downloadedBytes = 0

    const body = Readable.fromWeb(response.body as any)
    body.on("data", (chunk) => {
        downloadedBytes += chunk.length
        if (totalBytes) onProgress(Math.round((downloadedBytes / totalBytes) * 100))
    })

    try {
        await pipeline(body, zlib.createGunzip(), createWriteStream(tempPath))

        if (!IS_WIN) await fs.chmod(tempPath, 0o755)

        await fs.rename(tempPath, destPath)

        if (process.platform === "darwin") {
            await execFileAsync("xattr", ["-cr", destPath]).catch(() => {})
            await execFileAsync("codesign", ["-s", "-", "--force", destPath]).catch((err) => console.warn("[ffmpegManager] Ad-hoc codesign warning:", err))
        }

        clearFfmpegPathCache()
        return destPath
    } finally {
        await fs.rm(tempPath, { force: true }).catch(() => {})
    }
}
