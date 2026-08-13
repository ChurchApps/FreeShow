import { execFile } from "child_process"
import { app } from "electron"
import fs from "fs"
import path from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const WHISPER_MODELS = ["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large-v3"]
const MIN_MODEL_SIZE = 1024 * 1024 // even the tiny model is ~75 MB, anything smaller is a broken download or an error page

const VERIFY_TIMEOUT = 10000

// modelIds arrive over IPC as plain strings - reject anything not in the known list before it reaches a URL or file path (path traversal / arbitrary download target)
function isKnownModel(modelId: string) {
    return (WHISPER_MODELS as string[]).includes(modelId)
}

// PATHS

function getWhisperDir(): string {
    return path.join(app.getPath("userData"), "bin", "whisper")
}

function getModelsDir(): string {
    return path.join(app.getPath("userData"), "bin", "whisper", "models")
}

export function getModelPath(modelId: string): string {
    if (!isKnownModel(modelId)) throw new Error(`Unknown whisper model: ${String(modelId)}`)
    return path.join(getModelsDir(), `ggml-${modelId}.bin`)
}

// STATUS

async function verifyWhisperBinary(binaryPath: string): Promise<boolean> {
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

export function isModelReady(modelId: string): boolean {
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

function findExecutableInPath(name: string, extraDirs: string[] = EXTRA_SEARCH_DIRS[process.platform] || []): string | null {
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
