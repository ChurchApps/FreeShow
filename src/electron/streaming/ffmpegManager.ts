import { execSync } from "child_process"
import { app } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import yauzl from "yauzl"

// using pre-built, static ffmpeg binaries that can be downloaded at runtime
const FFMPEG_VERSION = "6.1"

const BIN_NAME = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"

export function getFfmpegDir(): string {
    return path.join(app.getPath("userData"), "bin")
}

export function getFfmpegPathLocal(): string {
    return path.join(getFfmpegDir(), BIN_NAME)
}

export function isSystemFfmpegAvailable(): boolean {
    try {
        execSync("ffmpeg -version", { stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

export function getFfmpegPath(): string {
    return isSystemFfmpegAvailable() ? "ffmpeg" : getFfmpegPathLocal()
}

export function isFfmpegInstalled(): boolean {
    if (isSystemFfmpegAvailable()) return true
    const binPath = getFfmpegPathLocal()
    if (!fs.existsSync(binPath) || !fs.statSync(binPath).isFile()) return false
    try {
        // Use double quotes for the path and use the same shell as the app
        execSync(`"${binPath}" -version`, { stdio: "ignore", windowsHide: true })
        return true
    } catch (err) {
        console.warn(`[ffmpegManager] Incompatible or broken FFmpeg detected at ${binPath}:`, err.message)
        return false
    }
}

function getPlatformKey(): string | null {
    const { platform, arch } = process
    if (platform === "win32") return arch === "ia32" ? "win-32" : "win-64"
    if (platform === "darwin") return "macos-64"
    if (platform === "linux") {
        if (arch === "arm64") return "linux-arm-64"
        if (arch === "arm") return "linux-armhf-32"
        return "linux-64"
    }
    return null
}

function extractFfmpeg(zipPath: string, targetDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) return reject(err || new Error("Could not open zip"))

            zipfile.on("error", reject)
            zipfile.readEntry()
            zipfile.on("entry", (entry) => {
                if (path.basename(entry.fileName) !== BIN_NAME) {
                    zipfile.readEntry()
                    return
                }

                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err || !readStream) return reject(err || new Error("Empty read stream"))

                    const destPath = path.join(targetDir, BIN_NAME)
                    const writeStream = fs.createWriteStream(destPath)

                    pipeline(readStream, writeStream)
                        .then(() => {
                            zipfile.close()
                            if (process.platform !== "win32") fs.chmodSync(destPath, 0o755)
                            resolve(destPath)
                        })
                        .catch(reject)
                })
            })
            zipfile.on("end", () => reject(new Error("ffmpeg not found in zip")))
        })
    })
}

export async function downloadFfmpeg(onProgress: (percent: number) => void): Promise<string> {
    const platformKey = getPlatformKey()
    if (!platformKey) throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`)

    const binDir = getFfmpegDir()
    fs.mkdirSync(binDir, { recursive: true })

    const zipPath = path.join(binDir, "ffmpeg_download.zip")
    const url = `https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v${FFMPEG_VERSION}/ffmpeg-${FFMPEG_VERSION}-${platformKey}.zip`

    const response = await fetch(url)
    if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`)

    const totalBytes = Number(response.headers.get("content-length")) || 0
    let downloadedBytes = 0

    const body = Readable.fromWeb(response.body as any)
    body.on("data", (chunk) => {
        downloadedBytes += chunk.length
        if (totalBytes > 0) onProgress(Math.round((downloadedBytes / totalBytes) * 100))
    })

    try {
        await pipeline(body, fs.createWriteStream(zipPath))
        return await extractFfmpeg(zipPath, binDir)
    } finally {
        try {
            fs.unlinkSync(zipPath)
        } catch {}
    }
}
