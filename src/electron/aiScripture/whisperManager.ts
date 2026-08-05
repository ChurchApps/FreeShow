import { execFileSync } from "child_process"
import { app } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import yauzl from "yauzl"
import type { WhisperModelId, WhisperStatus } from "../../types/AiScripture"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"

// pre-built whisper.cpp binaries from the official GitHub releases (Windows x64 only - other platforms use a system installed binary)
// verified against https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2 - the x64 zip contains whisper-cli.exe/whisper-server.exe + the required DLLs nested in a "Release/" folder
const WHISPER_RELEASE_TAG = "v1.9.2"
const WHISPER_WIN_X64_ASSET = "whisper-bin-x64.zip"
const WHISPER_BINARY_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}/${WHISPER_WIN_X64_ASSET}`

// ggml models converted & hosted by the whisper.cpp author
const WHISPER_MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"

const WHISPER_MODELS: WhisperModelId[] = ["tiny", "tiny.en", "base", "base.en", "small", "small.en"]
const MIN_MODEL_SIZE = 1024 * 1024 // even the tiny model is ~75 MB, anything smaller is a broken download or an error page

const PROGRESS_INTERVAL = 200

// PATHS

function getWhisperDir(): string {
    return path.join(app.getPath("userData"), "bin", "whisper")
}

function getModelsDir(): string {
    return path.join(app.getPath("userData"), "whisper-models")
}

export function getModelPath(modelId: WhisperModelId): string {
    return path.join(getModelsDir(), `ggml-${modelId}.bin`)
}

// STATUS

export async function getWhisperStatus(): Promise<WhisperStatus> {
    const downloadedModels = WHISPER_MODELS.filter((id) => isModelReady(id))

    const local = getVerifiedLocalBinary()
    if (local) return { binary: "ready_local", binaryPath: local.binaryPath, downloadedModels }

    const system = findSystemWhisper()
    if (system) return { binary: "ready_system", binaryPath: system, downloadedModels }

    return { binary: "not_installed", downloadedModels }
}

export function verifyWhisperBinary(binaryPath: string): boolean {
    if (!binaryPath) return false

    try {
        if (!fs.existsSync(binaryPath) || !fs.statSync(binaryPath).isFile()) return false
        execFileSync(binaryPath, ["--help"], { stdio: "ignore", windowsHide: true, timeout: 10000 })
        return true
    } catch (err) {
        console.warn(`[whisperManager] Incompatible or broken whisper binary at ${binaryPath}:`, (err as Error)?.message || err)
        return false
    }
}

export function isModelReady(modelId: WhisperModelId): boolean {
    const modelPath = getModelPath(modelId)

    try {
        if (!fs.existsSync(modelPath)) return false
        return verifyModelFile(modelPath)
    } catch {
        return false
    }
}

// RESOLVE

// resolve priority: verified custom path -> downloaded local binary -> system PATH probe
export function resolveWhisper(customPath?: string): { kind: "cli" | "server"; binaryPath: string } | null {
    if (customPath && verifyWhisperBinary(customPath)) {
        const kind = path.basename(customPath).toLowerCase().includes("server") ? "server" : "cli"
        return { kind, binaryPath: customPath }
    }

    const local = getVerifiedLocalBinary()
    if (local) return local

    const system = findSystemWhisper()
    if (system) return { kind: "cli", binaryPath: system }

    return null
}

function findLocalBinary(): { kind: "cli" | "server"; binaryPath: string } | null {
    const dir = getWhisperDir()

    const serverPath = path.join(dir, "whisper-server.exe")
    if (fs.existsSync(serverPath)) return { kind: "server", binaryPath: serverPath }

    // "main.exe" is the deprecated name of "whisper-cli.exe" in older whisper.cpp releases
    for (const name of ["whisper-cli.exe", "main.exe"]) {
        const cliPath = path.join(dir, name)
        if (fs.existsSync(cliPath)) return { kind: "cli", binaryPath: cliPath }
    }

    return null
}

let verifiedLocalPath = ""
function getVerifiedLocalBinary(): { kind: "cli" | "server"; binaryPath: string } | null {
    const local = findLocalBinary()
    if (!local) return null

    if (local.binaryPath !== verifiedLocalPath) {
        if (!verifyWhisperBinary(local.binaryPath)) return null
        verifiedLocalPath = local.binaryPath
    }

    return local
}

let systemProbe: string | null | undefined // undefined = not probed yet
function findSystemWhisper(): string | null {
    if (systemProbe !== undefined) return systemProbe

    systemProbe = null
    for (const name of ["whisper-cli", "whisper-cpp"]) {
        try {
            execFileSync(name, ["--help"], { stdio: "ignore", windowsHide: true, timeout: 10000 })
            systemProbe = name
            break
        } catch {}
    }

    return systemProbe
}

// DOWNLOAD

let activeDownload: { controller: AbortController; partPath: string } | null = null

export async function downloadWhisperBinary(): Promise<{ ok: boolean; error?: string }> {
    // the official pre-built binaries only cover Windows - macOS/Linux users install whisper.cpp themselves (e.g. brew install whisper-cpp)
    if (process.platform !== "win32" || process.arch !== "x64") return { ok: false, error: "unsupported_platform" }
    if (activeDownload) return { ok: false, error: "download_in_progress" }

    const name = "whisper"
    const targetDir = getWhisperDir()
    const zipPath = path.join(targetDir, "whisper_download.zip")

    try {
        await downloadFile(WHISPER_BINARY_URL, zipPath, name)
        await extractAll(zipPath, targetDir)
    } catch (err) {
        if (isAbortError(err)) return { ok: false, error: "cancelled" }
        sendDownloadError(name, err)
        return { ok: false, error: errorMessage(err) }
    } finally {
        try {
            fs.unlinkSync(zipPath)
        } catch {}
    }

    verifiedLocalPath = ""
    const local = findLocalBinary()
    if (!local || !verifyWhisperBinary(local.binaryPath)) {
        sendDownloadError(name, "Downloaded whisper binary could not be verified")
        return { ok: false, error: "verify_failed" }
    }
    verifiedLocalPath = local.binaryPath

    sendToMain(ToMain.AI_SCRIPTURE_WHISPER_PROGRESS, { name, progress: 1, total: 1, status: "complete" })
    return { ok: true }
}

export async function downloadWhisperModel(modelId: WhisperModelId): Promise<{ ok: boolean; error?: string }> {
    if (activeDownload) return { ok: false, error: "download_in_progress" }

    const name = "whisper-model-" + modelId
    const destPath = getModelPath(modelId)

    try {
        await downloadFile(`${WHISPER_MODEL_BASE_URL}/ggml-${modelId}.bin`, destPath, name)
    } catch (err) {
        if (isAbortError(err)) return { ok: false, error: "cancelled" }
        sendDownloadError(name, err)
        return { ok: false, error: errorMessage(err) }
    }

    if (!verifyModelFile(destPath)) {
        try {
            fs.unlinkSync(destPath)
        } catch {}
        sendDownloadError(name, "Downloaded model file is not a valid ggml model")
        return { ok: false, error: "invalid_model" }
    }

    sendToMain(ToMain.AI_SCRIPTURE_WHISPER_PROGRESS, { name, progress: 1, total: 1, status: "complete" })
    return { ok: true }
}

export function cancelWhisperDownload(): void {
    if (!activeDownload) return

    const { controller, partPath } = activeDownload
    activeDownload = null

    controller.abort()
    try {
        fs.unlinkSync(partPath)
    } catch {}
}

// downloads to a ".part" file first so an aborted/failed download never leaves a valid looking file behind
async function downloadFile(url: string, destPath: string, progressName: string): Promise<void> {
    const partPath = destPath + ".part"
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    const controller = new AbortController()
    activeDownload = { controller, partPath }

    try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`)

        const totalBytes = Number(response.headers.get("content-length")) || 0
        let downloadedBytes = 0
        let lastProgressAt = 0

        const body = Readable.fromWeb(response.body as any)
        body.on("data", (chunk: Buffer) => {
            downloadedBytes += chunk.length
            if (Date.now() - lastProgressAt < PROGRESS_INTERVAL) return
            lastProgressAt = Date.now()
            sendToMain(ToMain.AI_SCRIPTURE_WHISPER_PROGRESS, { name: progressName, progress: downloadedBytes, total: totalBytes, status: "downloading" })
        })

        await pipeline(body, fs.createWriteStream(partPath))

        if (totalBytes > 0 && downloadedBytes !== totalBytes) throw new Error(`Download incomplete: got ${downloadedBytes} of ${totalBytes} bytes`)

        fs.renameSync(partPath, destPath)
    } catch (err) {
        try {
            fs.unlinkSync(partPath)
        } catch {}
        throw err
    } finally {
        if (activeDownload?.controller === controller) activeDownload = null
    }
}

// extract every entry (exe + required DLLs), flattened into the target folder (the release zip nests everything in a "Release/" folder)
function extractAll(zipPath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) return reject(err || new Error("Could not open zip"))

            zipfile.on("error", reject)
            zipfile.readEntry()
            zipfile.on("entry", (entry) => {
                // skip directory entries
                if (entry.fileName.endsWith("/")) {
                    zipfile.readEntry()
                    return
                }

                zipfile.openReadStream(entry, (streamErr, readStream) => {
                    if (streamErr || !readStream) return reject(streamErr || new Error("Empty read stream"))

                    const destPath = path.join(targetDir, path.basename(entry.fileName))
                    pipeline(readStream, fs.createWriteStream(destPath))
                        .then(() => zipfile.readEntry())
                        .catch(reject)
                })
            })
            zipfile.on("end", () => resolve())
        })
    })
}

// VERIFY

function verifyModelFile(filePath: string): boolean {
    try {
        if (fs.statSync(filePath).size < MIN_MODEL_SIZE) return false

        const buffer = Buffer.alloc(4)
        const fd = fs.openSync(filePath, "r")
        try {
            fs.readSync(fd, buffer, 0, 4, 0)
        } finally {
            fs.closeSync(fd)
        }

        // error pages are HTML, not a model
        if (buffer.toString("utf8", 0, 1) === "<") return false

        // ggml files start with the magic 0x67676d6c written little-endian ("lmgg" on disk) - also accept the other "gg.." container variants (ggmf/ggjt)
        const magic = buffer.readUInt32LE(0)
        return magic === 0x67676d6c || magic >>> 16 === 0x6767
    } catch {
        return false
    }
}

// HELPERS

function isAbortError(err: unknown): boolean {
    return (err as Error)?.name === "AbortError" || (err as { code?: string })?.code === "ABORT_ERR"
}

function errorMessage(err: unknown): string {
    return String((err as Error)?.message || err)
}

function sendDownloadError(name: string, err: unknown) {
    sendToMain(ToMain.AI_SCRIPTURE_WHISPER_PROGRESS, { name, progress: 0, total: 0, status: "error", message: errorMessage(err) })
}
