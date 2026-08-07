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

export interface NemotronModelPaths {
    encoder: string
    decoder: string
    joiner: string
    tokens: string
}

// int8 export of NVIDIA's streaming Nemotron transducer, converted for sherpa-onnx
const MODEL_BASE_URL = "https://huggingface.co/csukuangfj/sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14/resolve/main"
const MODEL_FILES = {
    encoder: "encoder.int8.onnx",
    decoder: "decoder.int8.onnx",
    joiner: "joiner.int8.onnx",
    tokens: "tokens.txt"
}
export const NEMOTRON_MODEL_BYTES = 661_920_000

// speech gating, shared by any streaming driver (~630 KB)
const VAD_MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"
const VAD_MODEL_FILE = "silero_vad.onnx"

const PROGRESS_INTERVAL = 200
const MIN_FILE_SIZE = 1024 // anything smaller is a broken download or an error page

// PATHS

function getModelDir(): string {
    return path.join(app.getPath("userData"), "nemotron-model")
}

export function getNemotronModelPaths(): NemotronModelPaths | null {
    const dir = getModelDir()
    const paths: NemotronModelPaths = {
        encoder: path.join(dir, MODEL_FILES.encoder),
        decoder: path.join(dir, MODEL_FILES.decoder),
        joiner: path.join(dir, MODEL_FILES.joiner),
        tokens: path.join(dir, MODEL_FILES.tokens)
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
    sendToMain(ToMain.AI_SCRIPTURE_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 0, total: 0, status: "error", message: "cancelled" })
}

/** Download the model files (and the VAD gate) with aggregate progress across all of them. */
export async function downloadNemotronModel(): Promise<{ ok: boolean; error?: string }> {
    if (activeDownload) return { ok: false, error: "download_in_progress" }
    if (isNemotronReady()) {
        sendToMain(ToMain.AI_SCRIPTURE_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 1, total: 1, status: "complete" })
        return { ok: true }
    }

    const dir = getModelDir()
    fs.mkdirSync(dir, { recursive: true })

    const jobs = [...Object.values(MODEL_FILES).map((file) => ({ url: `${MODEL_BASE_URL}/${file}`, file })), { url: VAD_MODEL_URL, file: VAD_MODEL_FILE }]

    // one download spans several files, so progress is reported against the known total rather than per file
    let completedBytes = 0
    for (const job of jobs) {
        const target = path.join(dir, job.file)
        if (isUsableFile(target)) {
            completedBytes += fs.statSync(target).size
            continue
        }

        const base = completedBytes
        try {
            await downloadFile(job.url, target, (bytes) => {
                sendToMain(ToMain.AI_SCRIPTURE_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: base + bytes, total: NEMOTRON_MODEL_BYTES, status: "downloading" })
            })
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

    sendToMain(ToMain.AI_SCRIPTURE_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 1, total: 1, status: "complete" })
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
            // resume where it left off - the encoder alone is ~600 MB and long CDN transfers do get cut mid body
            const resumeAt = attempt > 1 && fs.existsSync(partPath) ? fs.statSync(partPath).size : 0

            // electron's net follows redirects (hugging face and github both redirect to a CDN) and handles
            // large transfers far more reliably than node's fetch, which throws "terminated" on long downloads
            const response = await net.fetch(url, { signal: controller.signal, headers: resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {} })
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
    sendToMain(ToMain.AI_SCRIPTURE_DOWNLOAD_PROGRESS, { name: PROGRESS_NAME, progress: 0, total: 0, status: "error", message: errorMessage(err) })
}
