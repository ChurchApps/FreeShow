import fs from "fs"
import path from "path"
import { ToMain } from "../../../../types/IPC/ToMain"
import { sendToMain } from "../../../IPC/main"
import { DownloadManager } from "../DownloadManager"

// int8 export of NVIDIA's Nemotron 3.5 streaming transducer, multilingual. Chosen over the
// English-only 0.6b on 19 sermon excerpts: same CPU cost, better accuracy, fewer repeated words,
// around 40 languages. Pinned to a revision and per-file hashes so exactly these bytes land.
const MODEL_REVISION = "cba1c96ca5ef0e8393b50584ae153a79145dc492"
const MODEL_BASE_URL = `https://huggingface.co/csukuangfj2/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-1120ms-int8-2026-06-11/resolve/${MODEL_REVISION}`

export const NEMOTRON_MODEL_FILES = {
    encoder: { file: "encoder.int8.onnx", sha256: "2fff2166acaa535bd969fb223c1f0783d71029f143cb298bc54c2afe85abf772" },
    decoder: { file: "decoder.int8.onnx", sha256: "19f9c98fc6d0a2c33a65a43b36fdb2e914c26c0aa9764be3aebc502a1e982fb0" },
    joiner: { file: "joiner.int8.onnx", sha256: "4101c7c679a0bc30483794b27a059e34e79232aa2068d78d51231a22c8b0d7ce" },
    tokens: { file: "tokens.txt", sha256: "729cc103155bafa785f9cd45746cd41cabe97eab7182fc04d594129587958f8a" }
}
export const NEMOTRON_MODEL_BYTES = 682_200_000

export const NEMOTRON_VAD_FILE = "silero_vad.onnx"
const NEMOTRON_VAD_SHA256 = "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"
const VAD_MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"

const PINNED_FILES = [...Object.values(NEMOTRON_MODEL_FILES), { file: NEMOTRON_VAD_FILE, sha256: NEMOTRON_VAD_SHA256 }]
const STAMP_FILE = "model.json"

export type ModelIntegrity = "ok" | "missing" | "outdated"

export class NemotronSetupManager {
    static getBinaryName() {
        return process.platform === "win32" ? "nemotron-cli.exe" : "nemotron-cli"
    }

    private static engineDLM: DownloadManager | null = null
    static getDownloadManager() {
        if (!this.engineDLM) this.engineDLM = new DownloadManager("nemotron", "Nemotron model")
        return this.engineDLM
    }

    static async downloadEngine(outputFolder: string) {
        const dlm = this.getDownloadManager()
        const jobs = [...Object.values(NEMOTRON_MODEL_FILES).map((entry) => ({ url: `${MODEL_BASE_URL}/${entry.file}`, ...entry })), { url: VAD_MODEL_URL, file: NEMOTRON_VAD_FILE, sha256: NEMOTRON_VAD_SHA256 }]
        const digests: Record<string, string> = {}
        let completedBytes = 0

        for (const job of jobs) {
            const target = path.join(outputFolder, job.file)

            if (await this.verifyEngine(target)) {
                const digest = await dlm.computeSha256(target)
                if (digest === job.sha256) {
                    digests[job.file] = digest
                    completedBytes += fs.statSync(target).size
                    continue
                }
                dlm.safeUnlink(target)
            }

            const base = completedBytes
            try {
                await dlm.downloadFile(job.url, target, {
                    onProgress: (bytes) => {
                        sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, {
                            url: dlm.key,
                            name: dlm.name,
                            progress: base + bytes,
                            total: NEMOTRON_MODEL_BYTES,
                            status: "downloading"
                        })
                    }
                })

                const digest = await dlm.computeSha256(target)
                if (digest !== job.sha256) {
                    dlm.safeUnlink(target)
                    throw new Error(`Downloaded ${job.file} failed checksum verification`)
                }
                digests[job.file] = digest
            } catch (err) {
                if (dlm.isAbortError(err)) return { ok: false, error: "Download was cancelled." }
                return dlm.reportError(`Failed to download Nemotron model: ${dlm.errorMessage(err)}`)
            }
            completedBytes = base + fs.statSync(target).size
        }

        await this.checkIntegrity(outputFolder, digests)
        return dlm.reportComplete()
    }

    static cancelEngineDownload() {
        this.getDownloadManager().cancel()
    }

    static async verifyEngine(binaryPath: string) {
        return Boolean(binaryPath && fs.existsSync(binaryPath) && fs.statSync(binaryPath).size > 1024)
    }

    static async checkIntegrity(modelDir: string, knownDigests?: Record<string, string>): Promise<ModelIntegrity> {
        if (!knownDigests && this.isStampValid(modelDir)) return "ok"

        const files: Record<string, { sha256: string; size: number; mtimeMs: number }> = {}
        let outdated = false

        for (const entry of PINNED_FILES) {
            const file = path.join(modelDir, entry.file)
            if (!fs.existsSync(file)) return "missing"

            const stats = fs.statSync(file)
            const digest = knownDigests?.[entry.file] ?? (await this.getDownloadManager().computeSha256(file))
            if (digest !== entry.sha256) outdated = true

            files[entry.file] = { sha256: digest, size: stats.size, mtimeMs: stats.mtimeMs }
        }

        if (outdated) return "outdated"

        try {
            fs.writeFileSync(path.join(modelDir, STAMP_FILE), JSON.stringify({ revision: MODEL_REVISION, files }, null, 4))
        } catch (err) {
            console.error("[nemotron] Could not write the model stamp:", err)
        }
        return "ok"
    }

    private static isStampValid(modelDir: string): boolean {
        try {
            const stamp = JSON.parse(fs.readFileSync(path.join(modelDir, STAMP_FILE), "utf8"))
            if (stamp.revision !== MODEL_REVISION || !stamp.files) return false

            return PINNED_FILES.every((entry) => {
                const stamped = stamp.files[entry.file]
                if (!stamped || stamped.sha256 !== entry.sha256) return false
                const stats = fs.statSync(path.join(modelDir, entry.file))
                return stats.size === stamped.size && stats.mtimeMs === stamped.mtimeMs
            })
        } catch {
            return false
        }
    }
}
