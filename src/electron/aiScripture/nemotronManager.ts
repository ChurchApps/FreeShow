// AI AUTO SCRIPTURE - Nemotron (sherpa-onnx) model management
// Same shape as whisperManager: nothing ships in the repo, the model is downloaded at
// runtime into userData. Unlike whisper.cpp there is no binary to install - the
// sherpa-onnx-node package ships prebuilt native binaries for mac/windows/linux.

import { app, net } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"

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

let cancelled = false

export function cancelNemotronDownload() {
    cancelled = true
}

/** Download the model (and the VAD gate) with aggregate progress. */
export async function downloadNemotronModel(onProgress?: (downloaded: number, total: number) => void): Promise<void> {
    cancelled = false
    if (isNemotronReady()) return

    const dir = getModelDir()
    fs.mkdirSync(dir, { recursive: true })

    const jobs = [...Object.values(MODEL_FILES).map((file) => ({ url: `${MODEL_BASE_URL}/${file}`, file })), { url: VAD_MODEL_URL, file: VAD_MODEL_FILE }]

    let completedBytes = 0
    for (const job of jobs) {
        const target = path.join(dir, job.file)
        if (isUsableFile(target)) {
            completedBytes += fs.statSync(target).size
            continue
        }

        const base = completedBytes
        await downloadFile(job.url, target, (bytes) => onProgress?.(base + bytes, NEMOTRON_MODEL_BYTES))
        completedBytes = base + fs.statSync(target).size
    }

    onProgress?.(NEMOTRON_MODEL_BYTES, NEMOTRON_MODEL_BYTES)
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

async function downloadFile(url: string, target: string, onProgress?: (downloaded: number) => void): Promise<void> {
    // electron's net follows redirects (hugging face and github both redirect to a CDN)
    const response = await net.fetch(url)
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`)

    const partial = `${target}.part`
    let downloaded = 0
    let lastReport = 0

    const source = Readable.fromWeb(response.body as any)
    source.on("data", (chunk: Buffer) => {
        downloaded += chunk.length
        const now = Date.now()
        if (now - lastReport >= PROGRESS_INTERVAL) {
            lastReport = now
            onProgress?.(downloaded)
        }
        if (cancelled) source.destroy(new Error("cancelled"))
    })

    try {
        await pipeline(source, fs.createWriteStream(partial))
        fs.renameSync(partial, target)
    } catch (err) {
        try {
            fs.unlinkSync(partial)
        } catch {
            /* the partial file may not exist */
        }
        throw err
    }
}
