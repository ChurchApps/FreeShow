import { execFile } from "child_process"
import crypto from "crypto"
import { app, net } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { promisify } from "util"
import yauzl from "yauzl"
import type { WhisperModelId, WhisperStatus } from "../../../../types/ai/AiScripture"
import { ToMain } from "../../../../types/IPC/ToMain"
import { sendToMain } from "../../../IPC/main"

const execFileAsync = promisify(execFile)

// pre-built whisper.cpp binaries from the official GitHub releases (Windows x64 only - other platforms use a system installed binary)
// verified against https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2 - the x64 zip contains whisper-cli.exe/whisper-server.exe + the required DLLs nested in a "Release/" folder
const WHISPER_RELEASE_TAG = "v1.9.2"
const WHISPER_WIN_X64_ASSET = "whisper-bin-x64.zip"
const WHISPER_BINARY_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}/${WHISPER_WIN_X64_ASSET}`
// sha256 of the pinned whisper-bin-x64.zip release asset (8194445 bytes) - matches the official digest published by the GitHub releases API
// (api.github.com/repos/ggml-org/whisper.cpp/releases/tags/v1.9.2) and independently verified by downloading & hashing the asset (2026-08-06)
const WHISPER_WIN_X64_SHA256 = "49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a"

// ggml models converted & hosted by the whisper.cpp author
const WHISPER_MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"

export const WHISPER_MODELS: WhisperModelId[] = ["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large-v3"]
const MIN_MODEL_SIZE = 1024 * 1024 // even the tiny model is ~75 MB, anything smaller is a broken download or an error page

const PROGRESS_INTERVAL = 200
const VERIFY_TIMEOUT = 10000

// modelIds arrive over IPC as plain strings - reject anything not in the known list before it reaches a URL or file path (path traversal / arbitrary download target)
function isKnownModel(modelId: string): modelId is WhisperModelId {
    return (WHISPER_MODELS as string[]).includes(modelId)
}

// PATHS

function getWhisperDir(): string {
    return path.join(app.getPath("userData"), "bin", "whisper")
}

function getModelsDir(): string {
    return path.join(app.getPath("userData"), "bin", "whisper", "models")
}

export function getModelPath(modelId: WhisperModelId): string {
    if (!isKnownModel(modelId)) throw new Error(`Unknown whisper model: ${String(modelId)}`)
    return path.join(getModelsDir(), `ggml-${modelId}.bin`)
}

// STATUS

export async function getWhisperStatus(): Promise<WhisperStatus> {
    const downloadedModels = WHISPER_MODELS.filter((id) => isModelReady(id))

    const local = await getVerifiedLocalBinary()
    if (local) return { binary: "ready_local", binaryPath: local.binaryPath, downloadedModels }

    const system = await findSystemWhisper()
    if (system) return { binary: "ready_system", binaryPath: system, downloadedModels }

    return { binary: "not_installed", downloadedModels }
}

export async function verifyWhisperBinary(binaryPath: string): Promise<boolean> {
    if (!binaryPath) return false

    try {
        if (!fs.existsSync(binaryPath) || !fs.statSync(binaryPath).isFile()) return false
        await execFileAsync(binaryPath, ["--help"], { windowsHide: true, timeout: VERIFY_TIMEOUT })
        return true
    } catch (err) {
        console.warn(`[whisperManager] Incompatible or broken whisper binary at ${binaryPath}:`, (err as Error)?.message || err)
        return false
    }
}

export function isModelReady(modelId: WhisperModelId): boolean {
    if (!isKnownModel(modelId)) return false

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
// preferCli picks a cli binary (whisper-cli/main) over whisper-server when both are available
// (per-window language detection needs the cli's -oj output), falling back to a server if that is all there is
export async function resolveWhisper(customPath?: string, options: { preferCli?: boolean } = {}): Promise<{ kind: "cli" | "server"; binaryPath: string } | null> {
    if (customPath && (await verifyCustomBinary(customPath))) {
        const kind = path.basename(customPath).toLowerCase().includes("server") ? "server" : "cli"
        if (kind === "cli" || !options.preferCli) return { kind, binaryPath: customPath }

        // the custom path points at a server - try to find a cli elsewhere, keep the server as fallback
        const cli = await resolveCliBinary()
        return cli || { kind, binaryPath: customPath }
    }

    if (options.preferCli) {
        const cli = await resolveCliBinary()
        if (cli) return cli
    }

    const local = await getVerifiedLocalBinary()
    if (local) return local

    const system = await findSystemWhisper()
    if (system) return { kind: "cli", binaryPath: system }

    return null
}

async function resolveCliBinary(): Promise<{ kind: "cli" | "server"; binaryPath: string } | null> {
    const local = await getVerifiedLocalBinary(true)
    if (local?.kind === "cli") return local

    const system = await findSystemWhisper()
    if (system) return { kind: "cli", binaryPath: system }

    return null
}

// cache the custom path verification by path + mtime + size so the binary is not re-executed on every session start
let verifiedCustomKey = ""
async function verifyCustomBinary(customPath: string): Promise<boolean> {
    let key = ""
    try {
        const stat = fs.statSync(customPath)
        if (!stat.isFile()) return false
        key = `${customPath}|${stat.mtimeMs}|${stat.size}`
    } catch {
        return false
    }

    if (key === verifiedCustomKey) return true

    if (!(await verifyWhisperBinary(customPath))) return false
    verifiedCustomKey = key
    return true
}

function findLocalBinary(preferCli = false): { kind: "cli" | "server"; binaryPath: string } | null {
    const dir = getWhisperDir()

    const serverPath = path.join(dir, "whisper-server.exe")
    const server: { kind: "cli" | "server"; binaryPath: string } | null = fs.existsSync(serverPath) ? { kind: "server", binaryPath: serverPath } : null
    if (server && !preferCli) return server

    // "main.exe" is the deprecated name of "whisper-cli.exe" in older whisper.cpp releases
    for (const name of ["whisper-cli.exe", "main.exe"]) {
        const cliPath = path.join(dir, name)
        if (fs.existsSync(cliPath)) return { kind: "cli", binaryPath: cliPath }
    }

    return server
}

let verifiedLocalPath = ""
async function getVerifiedLocalBinary(preferCli = false): Promise<{ kind: "cli" | "server"; binaryPath: string } | null> {
    const local = findLocalBinary(preferCli)
    if (!local) return null

    if (local.binaryPath !== verifiedLocalPath) {
        if (!(await verifyWhisperBinary(local.binaryPath))) return null
        verifiedLocalPath = local.binaryPath
    }

    return local
}

let systemProbe: Promise<string | null> | null = null
async function findSystemWhisper(): Promise<string | null> {
    if (!systemProbe) systemProbe = probeSystemWhisper()

    const found = await systemProbe
    // only cache hits - the user may install whisper while the app is running & expect "Check again" to find it
    if (!found) systemProbe = null

    return found
}

async function probeSystemWhisper(): Promise<string | null> {
    for (const name of ["whisper-cli", "whisper-cpp"]) {
        const absolutePath = findExecutableInPath(name)
        if (!absolutePath) continue

        try {
            await execFileAsync(absolutePath, ["--help"], { windowsHide: true, timeout: VERIFY_TIMEOUT })
            return absolutePath
        } catch {}
    }

    return null
}

// resolve a bare name to an absolute path by searching PATH entries manually - never execute (or spawn) a bare name:
// Windows CreateProcess searches the application directory and the CWD before PATH, so a bare name could run a planted binary
// GUI apps launched from Finder/desktop get a minimal PATH without package manager dirs - also search the well known install locations
const EXTRA_SEARCH_DIRS: { [platform: string]: string[] } = {
    darwin: ["/opt/homebrew/bin", "/usr/local/bin"],
    linux: ["/usr/local/bin", "/usr/bin", "/snap/bin"]
}

export function findExecutableInPath(name: string, extraDirs: string[] = EXTRA_SEARCH_DIRS[process.platform] || []): string | null {
    const fileName = process.platform === "win32" ? name + ".exe" : name

    for (const dir of [...(process.env.PATH || "").split(path.delimiter), ...extraDirs]) {
        // skip empty ("" resolves to the CWD) and relative entries
        if (!dir || !path.isAbsolute(dir)) continue

        const candidate = path.join(dir, fileName)
        try {
            if (!fs.statSync(candidate).isFile()) continue
            fs.accessSync(candidate, fs.constants.X_OK)
            return candidate
        } catch {}
    }

    return null
}

// DOWNLOAD

let activeDownload: { controller: AbortController; partPath: string; name: string } | null = null

export async function downloadWhisperBinary(): Promise<{ ok: boolean; error?: string }> {
    // the official pre-built binaries only cover Windows - macOS/Linux users install whisper.cpp themselves (e.g. brew install whisper-cpp)
    if (process.platform !== "win32" || process.arch !== "x64") return { ok: false, error: "unsupported_platform" }
    if (activeDownload) return { ok: false, error: "download_in_progress" }

    const name = "whisper"
    const targetDir = getWhisperDir()
    const zipPath = path.join(targetDir, "whisper_download.zip")

    try {
        await downloadFile(WHISPER_BINARY_URL, zipPath, name)

        // integrity check against the pinned release asset hash before anything gets extracted or executed
        const checksum = await computeFileSha256(zipPath)
        if (checksum !== WHISPER_WIN_X64_SHA256) throw new Error(`Downloaded ${WHISPER_WIN_X64_ASSET} failed checksum verification`)

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
    if (!local || !(await verifyWhisperBinary(local.binaryPath))) {
        sendDownloadError(name, "Downloaded whisper binary could not be verified")
        return { ok: false, error: "verify_failed" }
    }
    verifiedLocalPath = local.binaryPath

    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name, progress: 1, total: 1, status: "complete" })
    return { ok: true }
}

export async function downloadWhisperModel(modelId: WhisperModelId): Promise<{ ok: boolean; error?: string }> {
    if (!isKnownModel(modelId)) return { ok: false, error: "invalid_model" }
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

    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name, progress: 1, total: 1, status: "complete" })
    return { ok: true }
}

export function cancelWhisperDownload(): void {
    if (!activeDownload) return

    const { controller, partPath, name } = activeDownload
    activeDownload = null

    controller.abort()
    try {
        fs.unlinkSync(partPath)
    } catch {}

    // terminal event so the renderer's progress entry for this download never stays stuck at "downloading"
    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name, progress: 0, total: 0, status: "error", message: "cancelled" })
}

// downloads to a ".part" file first so an aborted/failed download never leaves a valid looking file behind
async function downloadFile(url: string, destPath: string, progressName: string): Promise<void> {
    const partPath = destPath + ".part"
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    const controller = new AbortController()
    activeDownload = { controller, partPath, name: progressName }

    const MAX_ATTEMPTS = 3
    let totalBytes = 0

    try {
        for (let attempt = 1; ; attempt++) {
            // resume an interrupted download where it left off (large downloads over flaky connections get cut mid-body)
            const resumeAt = attempt > 1 && fs.existsSync(partPath) ? fs.statSync(partPath).size : 0

            // Electron's Chromium network stack handles large redirected downloads far more reliably than Node's fetch,
            // which is prone to "terminated" errors on long transfers from CDNs
            const response = await net.fetch(url, { signal: controller.signal, headers: resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {} })
            if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`)

            const resumed = resumeAt > 0 && response.status === 206
            const remainingBytes = Number(response.headers.get("content-length")) || 0
            if (!totalBytes || !resumed) totalBytes = resumed ? resumeAt + remainingBytes : remainingBytes

            let downloadedBytes = resumed ? resumeAt : 0
            let lastProgressAt = 0

            const body = Readable.fromWeb(response.body as any)
            body.on("data", (chunk: Buffer) => {
                downloadedBytes += chunk.length
                if (Date.now() - lastProgressAt < PROGRESS_INTERVAL) return
                lastProgressAt = Date.now()
                sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: progressName, progress: downloadedBytes, total: totalBytes, status: "downloading" })
            })

            try {
                await pipeline(body, fs.createWriteStream(partPath, { flags: resumed ? "a" : "w" }))
                if (totalBytes > 0 && downloadedBytes !== totalBytes) throw new Error(`Download incomplete: got ${downloadedBytes} of ${totalBytes} bytes`)
            } catch (err) {
                if (isAbortError(err) || attempt >= MAX_ATTEMPTS) throw err
                continue
            }

            fs.renameSync(partPath, destPath)
            return
        }
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

export function computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256")
        const stream = fs.createReadStream(filePath)
        stream.on("error", reject)
        stream.on("data", (chunk) => hash.update(chunk))
        stream.on("end", () => resolve(hash.digest("hex")))
    })
}

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
    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name, progress: 0, total: 0, status: "error", message: errorMessage(err) })
}
