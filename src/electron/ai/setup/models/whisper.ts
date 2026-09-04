import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { decompressZipStream } from "../../../data/zip"
import { DownloadManager } from "../DownloadManager"

const execFileAsync = promisify(execFile)

// exported model ids
const WHISPER_MODELS = ["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large-v3"]

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

export class WhisperSetupManager {
    static getBinaryName() {
        return process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli"
    }

    static engineDLM: DownloadManager | null = null
    static getDownloadManager() {
        if (!this.engineDLM) this.engineDLM = new DownloadManager("whisper")
        return this.engineDLM
    }

    static async downloadEngine(outputFolder: string) {
        const dlm = this.getDownloadManager()

        if (process.platform !== "win32" || process.arch !== "x64") {
            return dlm.reportError("Whisper download is only supported on 64-bit Windows.")
        }
        if (dlm.isDownloading()) {
            return dlm.reportError("A download is already in progress.")
        }

        const zipPath = path.join(outputFolder, "whisper_download.zip")

        try {
            await dlm.downloadFile(WHISPER_BINARY_URL, zipPath)

            const checksum = await dlm.computeSha256(zipPath)
            if (checksum !== WHISPER_WIN_X64_SHA256) throw new Error(`Downloaded ${WHISPER_WIN_X64_ASSET} failed checksum verification`)

            await decompressZipStream(zipPath, false, { getOutputPath: (fileName) => path.join(outputFolder, fileName) })
        } catch (err) {
            if (dlm.isAbortError(err)) return false // cancelled
            return dlm.reportError(`Failed to download Whisper binary: ${dlm.errorMessage(err)}`)
        } finally {
            try {
                fs.unlinkSync(zipPath)
            } catch {}
        }

        return dlm.reportComplete()
    }

    static cancelEngineDownload() {
        const dlm = this.getDownloadManager()
        if (dlm.isDownloading()) dlm.cancel()
    }

    static async verifyEngine(binaryPath: string): Promise<boolean> {
        if (!binaryPath) return false

        try {
            if (!fs.existsSync(binaryPath) || !fs.statSync(binaryPath).isFile()) return false
            await execFileAsync(binaryPath, ["--help"], { windowsHide: true, timeout: 10000 })
            return true
        } catch (err) {
            console.warn(`[whisperManager] Incompatible or broken whisper binary at ${binaryPath}:`, (err as Error)?.message || err)
            return false
        }
    }

    private static modelDLMs: { [modelId: string]: DownloadManager } = {}
    static getModelDownloadManager(modelId: string) {
        if (!this.modelDLMs[modelId]) this.modelDLMs[modelId] = new DownloadManager(modelId, `Whisper model (${modelId})`)
        return this.modelDLMs[modelId]
    }
    static async downloadModel(modelId: string, outputPath: string) {
        // modelIds arrive over IPC as plain strings - reject anything not in the known list before it reaches a URL or file path (path traversal / arbitrary download target)
        if (!WHISPER_MODELS.includes(modelId)) {
            return { ok: false as const, error: `Unknown Whisper model: ${String(modelId)}` }
        }

        const dlm = this.getModelDownloadManager(modelId)

        if (dlm.isDownloading()) {
            return dlm.reportError("A download is already in progress.")
        }

        try {
            await dlm.downloadFile(`${WHISPER_MODEL_BASE_URL}/ggml-${modelId}.bin`, outputPath)
        } catch (err) {
            if (dlm.isAbortError(err)) return { ok: false, error: "Download was cancelled." }
            return dlm.reportError(`Failed to download Whisper model: ${dlm.errorMessage(err)}`)
        }

        if (!(await WhisperSetupManager.verifyModel(outputPath))) {
            try {
                fs.unlinkSync(outputPath)
            } catch {}
            return dlm.reportError("Downloaded model file is not a valid ggml model.")
        }

        return dlm.reportComplete()
    }

    static cancelModelDownload(modelId: string) {
        const dlm = this.getModelDownloadManager(modelId)
        if (dlm.isDownloading()) dlm.cancel()
    }

    static async verifyModel(filePath: string): Promise<boolean> {
        try {
            const MIN_MODEL_SIZE = 1024 * 1024 // anything smaller than this is invalid
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
}
