// AI AUTO SCRIPTURE - Nemotron (sherpa-onnx) model management
// Same shape as whisperManager: nothing ships in the repo, the model is downloaded at
// runtime into userData. Unlike whisper.cpp there is no binary to install - the
// sherpa-onnx-node package ships prebuilt native binaries for mac/windows/linux.

import { app, net } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { computeFileSha256 } from "./whisperManager"

export interface NemotronModelPaths {
    encoder: string
    decoder: string
    joiner: string
    tokens: string
}

// int8 export of NVIDIA's streaming Nemotron transducer, converted for sherpa-onnx.
// pinned to a specific repo revision (not "main") and to per-file SHA-256 hashes, so exactly these bytes land
// or nothing does - the hashes are the LFS checksums Hugging Face publishes for this revision
const MODEL_BASE_URL = "https://huggingface.co/csukuangfj/sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14/resolve/f13b0c6a48186fdd9fdd8d203b9527b0b709b09f"
const MODEL_FILES = {
    encoder: { file: "encoder.int8.onnx", sha256: "2f6ae81fe4ccd69ef04cdf048ecd49628e2d3148a6195e152a91b4d2497952dc" },
    decoder: { file: "decoder.int8.onnx", sha256: "1fb1795cb46e7d0e99b2e096eae83f7e324294e895975a1a894b0384cbbe37f6" },
    joiner: { file: "joiner.int8.onnx", sha256: "a3f41dccc0f67f37e4210051d1c39a29d473c841cfc32fe574135bac890db91d" },
    tokens: { file: "tokens.txt", sha256: "dc0b4584ab2e4ddbf888425c076c61b736e7356a015250db7d307e6f1a8188ff" }
}
export const NEMOTRON_MODEL_BYTES = 661_920_000

// speech gating, shared by any streaming driver (~630 KB)
const VAD_MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"
const VAD_MODEL_FILE = "silero_vad.onnx"
const VAD_MODEL_SHA256 = "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"

const PROGRESS_INTERVAL = 200
const MIN_FILE_SIZE = 1024 // anything smaller is a broken download or an error page

// PATHS

function getModelDir(): string {
    return path.join(app.getPath("userData"), "nemotron-model")
}

export function getNemotronModelPaths(): NemotronModelPaths | null {
    const dir = getModelDir()
    const paths: NemotronModelPaths = {
        encoder: path.join(dir, MODEL_FILES.encoder.file),
        decoder: path.join(dir, MODEL_FILES.decoder.file),
        joiner: path.join(dir, MODEL_FILES.joiner.file),
        tokens: path.join(dir, MODEL_FILES.tokens.file)
    }

    for (const file of Object.values(paths)) {
        if (!isUsableFile(file)) return null
    }
    return paths
}

export function getVadModelPath(): string | null {
    const file = path.join(getModelDir(), VAD_MODEL_FILE)
    return isUsableFile(file) ? file : null
}

export function isNemotronReady(): boolean {
    return getNemotronModelPaths() !== null && getVadModelPath() !== null
}

/** The native addon is optional - report whether this platform can actually run it. */
export function isNemotronSupported(): boolean {
    try {
        require.resolve("sherpa-onnx-node")
        return true
    } catch {
        return false
    }
}

function isUsableFile(file: string): boolean {
    try {
        return fs.existsSync(file) && fs.statSync(file).size > MIN_FILE_SIZE
    } catch {
        return false
    }
}

// DOWNLOAD

// the renderer keys progress entries by name, the same way whisper's binary/model downloads do
const PROGRESS_NAME = "nemotron"
const MAX_ATTEMPTS = 3

let activeDownload: { controller: AbortController; partPath: string } | null = null

export function cancelNemotronDownload(): void {
    if (!activeDownload) return

    const { controller, partPath } = activeDownload
    activeDownload = null

    controller.abort()
    try {
        fs.unlinkSync(partPath)
    } catch {
        /* the partial file may not exist */
    }

    // terminal event so the renderer's progress entry for this download never stays stuck at "downloading"
    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 0, total: 0, status: "error", message: "cancelled" })
}

/** Download the model files (and the VAD gate) with aggregate progress across all of them. */
export async function downloadNemotronModel(): Promise<{ ok: boolean; error?: string }> {
    if (activeDownload) return { ok: false, error: "download_in_progress" }
    if (isNemotronReady()) {
        sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 1, total: 1, status: "complete" })
        return { ok: true }
    }

    const dir = getModelDir()
    fs.mkdirSync(dir, { recursive: true })

    const jobs = [...Object.values(MODEL_FILES).map((entry) => ({ url: `${MODEL_BASE_URL}/${entry.file}`, file: entry.file, sha256: entry.sha256 })), { url: VAD_MODEL_URL, file: VAD_MODEL_FILE, sha256: VAD_MODEL_SHA256 }]

    // one download spans several files, so progress is reported against the known total rather than per file
    let completedBytes = 0
    for (const job of jobs) {
        const target = path.join(dir, job.file)

        // a file from an earlier run only counts when its checksum proves it is exactly the pinned content
        if (isUsableFile(target)) {
            if ((await computeFileSha256(target)) === job.sha256) {
                completedBytes += fs.statSync(target).size
                continue
            }
            fs.unlinkSync(target)
        }

        const base = completedBytes
        try {
            await downloadFile(job.url, target, (bytes) => {
                sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: base + bytes, total: NEMOTRON_MODEL_BYTES, status: "downloading" })
            })

            // integrity check against the pinned hash - a corrupt or substituted file must never land
            if ((await computeFileSha256(target)) !== job.sha256) {
                fs.unlinkSync(target)
                throw new Error(`Downloaded ${job.file} failed checksum verification`)
            }
        } catch (err) {
            if (isAbortError(err)) return { ok: false, error: "cancelled" }
            sendDownloadError(err)
            return { ok: false, error: errorMessage(err) }
        }
        completedBytes = base + fs.statSync(target).size
    }

    if (!isNemotronReady()) {
        sendDownloadError("Downloaded Nemotron model is incomplete")
        return { ok: false, error: "nemotron_model_missing" }
    }

    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 1, total: 1, status: "complete" })
    return { ok: true }
}

export function deleteNemotronModel() {
    const dir = getModelDir()
    if (!fs.existsSync(dir)) return
    try {
        fs.rmSync(dir, { recursive: true })
    } catch (err) {
        console.error("[nemotron] Failed to delete the model:", err)
    }
}

// downloads to a ".part" file first so a failed download never leaves a valid looking file behind
async function downloadFile(url: string, target: string, onProgress: (downloaded: number) => void): Promise<void> {
    const partPath = `${target}.part`
    const controller = new AbortController()
    activeDownload = { controller, partPath }

    let totalBytes = 0

    try {
        for (let attempt = 1; ; attempt++) {
            // in-call retries resume where the transfer was cut (the encoder alone is ~600 MB and long CDN
            // transfers do get dropped mid body) - a NEW download always starts clean, and the finished file
            // is checksum verified either way, so a resumed transfer can never land wrong bytes
            const resumeAt = attempt > 1 && fs.existsSync(partPath) ? fs.statSync(partPath).size : 0

            // electron's net follows redirects (hugging face and github both redirect to a CDN) and handles
            // large transfers far more reliably than node's fetch, which throws "terminated" on long downloads
            const response = await net.fetch(url, { signal: controller.signal, headers: resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {} })

            // the remote file changed size since the partial was written - drop the partial and start over
            if (response.status === 416 && resumeAt > 0) {
                fs.unlinkSync(partPath)
                if (attempt >= MAX_ATTEMPTS) throw new Error(`Download failed (416): ${url}`)
                continue
            }
            if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`)

            const resumed = resumeAt > 0 && response.status === 206
            const remainingBytes = Number(response.headers.get("content-length")) || 0
            if (!totalBytes || !resumed) totalBytes = resumed ? resumeAt + remainingBytes : remainingBytes

            let downloaded = resumed ? resumeAt : 0
            let lastReport = 0

            const source = Readable.fromWeb(response.body as any)
            source.on("data", (chunk: Buffer) => {
                downloaded += chunk.length
                if (Date.now() - lastReport < PROGRESS_INTERVAL) return
                lastReport = Date.now()
                onProgress(downloaded)
            })

            try {
                await pipeline(source, fs.createWriteStream(partPath, { flags: resumed ? "a" : "w" }))
                if (totalBytes > 0 && downloaded !== totalBytes) throw new Error(`Download incomplete: got ${downloaded} of ${totalBytes} bytes`)
            } catch (err) {
                if (isAbortError(err) || attempt >= MAX_ATTEMPTS) throw err
                continue
            }

            fs.renameSync(partPath, target)
            return
        }
    } catch (err) {
        try {
            fs.unlinkSync(partPath)
        } catch {
            /* the partial file may not exist */
        }
        throw err
    } finally {
        if (activeDownload?.controller === controller) activeDownload = null
    }
}

// HELPERS

function isAbortError(err: unknown): boolean {
    return (err as Error)?.name === "AbortError" || (err as { code?: string })?.code === "ABORT_ERR"
}

function errorMessage(err: unknown): string {
    return String((err as Error)?.message || err)
}

function sendDownloadError(err: unknown) {
    sendToMain(ToMain.AI_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 0, total: 0, status: "error", message: errorMessage(err) })
}
