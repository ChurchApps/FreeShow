import { app } from "electron"
import fs from "fs"
import path from "path"

export interface NemotronModelPaths {
    encoder: string
    decoder: string
    joiner: string
    tokens: string
}

// int8 export of NVIDIA's streaming Nemotron transducer, converted for sherpa-onnx.
// pinned to a specific repo revision (not "main") and to per-file SHA-256 hashes, so exactly these bytes land
// or nothing does - the hashes are the LFS checksums Hugging Face publishes for this revision
const MODEL_FILES = {
    encoder: { file: "encoder.int8.onnx", sha256: "2f6ae81fe4ccd69ef04cdf048ecd49628e2d3148a6195e152a91b4d2497952dc" },
    decoder: { file: "decoder.int8.onnx", sha256: "1fb1795cb46e7d0e99b2e096eae83f7e324294e895975a1a894b0384cbbe37f6" },
    joiner: { file: "joiner.int8.onnx", sha256: "a3f41dccc0f67f37e4210051d1c39a29d473c841cfc32fe574135bac890db91d" },
    tokens: { file: "tokens.txt", sha256: "dc0b4584ab2e4ddbf888425c076c61b736e7356a015250db7d307e6f1a8188ff" }
}

const VAD_MODEL_FILE = "silero_vad.onnx"

const MIN_FILE_SIZE = 1024 // anything smaller is a broken download or an error page

// PATHS

export function getModelDir(): string {
    const dir = path.join(app.getPath("userData"), "bin", "nemotron", "models")

    // one-time move of a download made before the bin/<engine>/models convention
    const legacy = path.join(app.getPath("userData"), "nemotron-model")
    if (!fs.existsSync(dir) && fs.existsSync(legacy)) {
        try {
            fs.mkdirSync(path.dirname(dir), { recursive: true })
            fs.renameSync(legacy, dir)
        } catch (err) {
            console.error("[nemotron] Could not move the model to its new location:", err)
            return legacy
        }
    }

    return dir
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
