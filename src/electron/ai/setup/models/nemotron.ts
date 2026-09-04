import fs from "fs"
import path from "path"
import { ToMain } from "../../../../types/IPC/ToMain"
import { sendToMain } from "../../../IPC/main"
import { DownloadManager } from "../DownloadManager"

// int8 export of NVIDIA's streaming Nemotron transducer, converted for sherpa-onnx.
// pinned to a specific repo revision (not "main") and to per-file SHA-256 hashes, so exactly these bytes land
// or nothing does - the hashes are the LFS checksums Hugging Face publishes for this revision
const MODEL_BASE_URL = "https://huggingface.co/csukuangfj/sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14/resolve/f13b0c6a48186fdd9fdd8d203b9527b0b709b09f"
export const NEMOTRON_MODEL_FILES = {
    encoder: { file: "encoder.int8.onnx", sha256: "2f6ae81fe4ccd69ef04cdf048ecd49628e2d3148a6195e152a91b4d2497952dc" },
    decoder: { file: "decoder.int8.onnx", sha256: "1fb1795cb46e7d0e99b2e096eae83f7e324294e895975a1a894b0384cbbe37f6" },
    joiner: { file: "joiner.int8.onnx", sha256: "a3f41dccc0f67f37e4210051d1c39a29d473c841cfc32fe574135bac890db91d" },
    tokens: { file: "tokens.txt", sha256: "dc0b4584ab2e4ddbf888425c076c61b736e7356a015250db7d307e6f1a8188ff" }
}
export const NEMOTRON_MODEL_BYTES = 661_920_000

// speech gating, shared by any streaming driver (~630 KB)
const VAD_MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"
export const NEMOTRON_VAD_FILE = "silero_vad.onnx"
const NEMOTRON_VAD_SHA256 = "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"

export class NemotronSetupManager {
    static getBinaryName() {
        return process.platform === "win32" ? "nemotron-cli.exe" : "nemotron-cli"
    }

    static engineDLM: DownloadManager | null = null
    static getDownloadManager() {
        if (!this.engineDLM) this.engineDLM = new DownloadManager("nemotron", "Nemotron model")
        return this.engineDLM
    }

    static async downloadEngine(outputFolder: string) {
        const dlm = this.getDownloadManager()

        const jobs = [...Object.values(NEMOTRON_MODEL_FILES).map((entry) => ({ url: `${MODEL_BASE_URL}/${entry.file}`, file: entry.file, sha256: entry.sha256 })), { url: VAD_MODEL_URL, file: NEMOTRON_VAD_FILE, sha256: NEMOTRON_VAD_SHA256 }]

        // one download spans several files, so progress is reported against the known total rather than per file
        let completedBytes = 0
        for (const job of jobs) {
            const target = path.join(outputFolder, job.file)

            // a file from an earlier run only counts when its checksum proves it is exactly the pinned content
            if (await this.verifyEngine(target)) {
                if ((await dlm.computeSha256(target)) === job.sha256) {
                    completedBytes += fs.statSync(target).size
                    continue
                }
                fs.unlinkSync(target)
            }

            const base = completedBytes
            try {
                await dlm.downloadFile(job.url, target, {
                    // one stable key for the whole multi-file download, so the renderer shows a single progress entry
                    onProgress: (bytes) => {
                        sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url: dlm.key, name: dlm.name, progress: base + bytes, total: NEMOTRON_MODEL_BYTES, status: "downloading" })
                    }
                })

                // integrity check against the pinned hash - a corrupt or substituted file must never land
                if ((await dlm.computeSha256(target)) !== job.sha256) {
                    fs.unlinkSync(target)
                    throw new Error(`Downloaded ${job.file} failed checksum verification`)
                }
            } catch (err) {
                if (dlm.isAbortError(err)) return { ok: false, error: "Download was cancelled." }
                return dlm.reportError(`Failed to download Nemotron model: ${dlm.errorMessage(err)}`)
            }
            completedBytes = base + fs.statSync(target).size
        }

        return dlm.reportComplete()
    }

    static cancelEngineDownload() {
        const dlm = this.getDownloadManager()
        if (dlm.isDownloading()) dlm.cancel()
    }

    static async verifyEngine(binaryPath: string) {
        if (!binaryPath) return false

        try {
            return fs.existsSync(binaryPath) && fs.statSync(binaryPath).size > 1024
        } catch {
            return false
        }
    }

    // this has just one model, treated as "engine"
    static async downloadModel(_modelId: string, _outputPath: string) {
        return false
    }
    static cancelModelDownload(_modelId: string) {
        return true
    }
    static async verifyModel(_filePath: string): Promise<boolean> {
        return false
    }
}
