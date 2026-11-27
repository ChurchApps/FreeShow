import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import type { DownloadManager } from "./DownloadManager"

const SHERPA_VERSION = "2.0.1"
// sherpa-onnx-node does not work on Intel macOS (darwin-x64)
const SUPPORTED_TARGETS = new Set(["win-x64", "win-arm64", "win-ia32", "darwin-arm64", "linux-x64", "linux-arm64"])

const getTarget = () => `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`
const getPlatformPackage = () => `sherpa-onnx-${getTarget()}`

export const isSherpaPlatformSupported = () => SUPPORTED_TARGETS.has(getTarget())

export function isSherpaRuntimeReady(runtimeDir: string): boolean {
    return fs.existsSync(path.join(runtimeDir, "sherpa-onnx-node", "sherpa-onnx.js")) && fs.existsSync(path.join(runtimeDir, getPlatformPackage(), "sherpa-onnx.node"))
}

export async function ensureSherpaRuntime(runtimeDir: string, dlm: DownloadManager): Promise<void> {
    if (isSherpaRuntimeReady(runtimeDir)) return

    console.info(`[sherpa-onnx] Downloading runtime v${SHERPA_VERSION} for ${getTarget()} into ${runtimeDir}...`)
    for (const pkg of ["sherpa-onnx-node", getPlatformPackage()]) {
        const dest = path.join(runtimeDir, pkg)
        const tgz = path.join(runtimeDir, `${pkg}-${SHERPA_VERSION}.tgz`)
        try {
            console.info(`[sherpa-onnx] Downloading ${pkg}...`)
            await dlm.downloadFile(`https://registry.npmjs.org/${pkg}/-/${pkg}-${SHERPA_VERSION}.tgz`, tgz)
            fs.mkdirSync(dest, { recursive: true })
            execFileSync("tar", ["-xzf", tgz, "-C", dest, "--strip-components=1"])
        } finally {
            dlm.safeUnlink(tgz)
        }
    }
    console.info("[sherpa-onnx] Runtime ready.")
}

export function loadSherpa(runtimeDir?: string): any {
    if (runtimeDir) {
        const entry = path.join(runtimeDir, "sherpa-onnx-node")
        if (fs.existsSync(path.join(entry, "sherpa-onnx.js"))) return require(entry)
    }
    return require("sherpa-onnx-node")
}

export function getSherpaWorkerEnv(runtimeDir: string): NodeJS.ProcessEnv {
    const libEnv = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : process.platform === "linux" ? "LD_LIBRARY_PATH" : ""
    if (!libEnv) return process.env
    const nativeDir = path.join(runtimeDir, getPlatformPackage())
    return { ...process.env, [libEnv]: [nativeDir, process.env[libEnv]].filter(Boolean).join(":") }
}
