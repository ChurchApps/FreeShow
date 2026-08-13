import { spawn, type ChildProcess } from "child_process"
import { app } from "electron"
import fs from "fs"
import net from "net"
import path from "path"
import type { DriverCallbacks, TranscriberSegment as DriverSegment, TranscriptionDriver } from "../types"

// AI AUTO SCRIPTURE - streaming transcription over whisper.cpp
// Receives 1s chunks of Int16 LE PCM @ 16kHz mono from the renderer (IPC),
// keeps them in a ring buffer, and every 6s transcribes the last 7s (1s overlap)
// with either the whisper.cpp cli (one process per window) or the whisper.cpp server (spawned once).

const SAMPLE_RATE = 16000
const RING_SECONDS = 30
const WINDOW_SECONDS = 7
const STEP_SECONDS = 6

const WINDOW_SAMPLES = WINDOW_SECONDS * SAMPLE_RATE
const STEP_SAMPLES = STEP_SECONDS * SAMPLE_RATE

// RMS (normalized 0-1) below this over a whole window counts as silence - no whisper call
const SILENCE_RMS_THRESHOLD = 0.01

// confidence gates (only applied when the whisper JSON provides the values)
const NO_SPEECH_PROB_MAX = 0.6
const AVG_LOGPROB_MIN = -1.0

const SERVER_START_TIMEOUT = 20000
const SERVER_INFERENCE_TIMEOUT = 30000
const CLI_INFERENCE_TIMEOUT = 30000
const KILL_TIMEOUT = 2000

interface WhisperSegment extends DriverSegment {
    noSpeechProb?: number
    avgLogprob?: number
}

interface TranscriberOptions extends DriverCallbacks {
    binary: { kind: "cli" | "server"; binaryPath: string }
    modelPath: string
    language: string
    declaredLanguages?: string[] // interpretation mode: the languages actually being spoken - a "-l auto" guess outside this set triggers a forced re-check
    primaryLanguage?: string // the scripture detection language - forced re-checks transcribe the window with this language
}

interface PcmWindow {
    samples: Int16Array
    startSample: number
}

export class Transcriber implements TranscriptionDriver {
    private options: TranscriberOptions

    private ring = new Int16Array(RING_SECONDS * SAMPLE_RATE)
    private totalSamples = 0
    private nextWindowAt = WINDOW_SAMPLES

    private processing = false
    private pendingWindow: PcmWindow | null = null
    private lastEmittedEndMs = 0
    private consecutiveFailures = 0
    private windowCount = 0

    private stopped = false
    private cliChild: ChildProcess | null = null
    private serverChild: ChildProcess | null = null
    private serverPort = 0
    private serverRespawned = false
    private serverRespawning = false
    private tempFiles = new Set<string>()

    constructor(options: TranscriberOptions) {
        this.options = options
    }

    async start(): Promise<void> {
        if (this.stopped) throw new Error("Transcriber has already been stopped")

        // window WAV/JSON files only live for the duration of a single window - keep the folder private to this user (0700)
        const tmpDir = this.getTmpDir()
        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 })
        try {
            fs.chmodSync(tmpDir, 0o700) // mkdirSync does not change the mode of an existing folder
        } catch {}
        // best effort cleanup of leftovers from a previous crash (the folder is exclusively ours)
        try {
            for (const file of fs.readdirSync(tmpDir)) {
                try {
                    fs.unlinkSync(path.join(tmpDir, file))
                } catch {}
            }
        } catch {}

        if (this.options.binary.kind === "server") await this.startServer()
    }

    async stop(): Promise<void> {
        if (this.stopped) return
        this.stopped = true
        this.pendingWindow = null

        const children: ChildProcess[] = []
        if (this.cliChild) children.push(this.cliChild)
        if (this.serverChild) children.push(this.serverChild)
        this.cliChild = null
        this.serverChild = null

        await Promise.all(children.map((child) => killProcess(child)))
        this.cleanupTempFiles()
    }

    // 1s chunks of Int16 LE PCM @ 16kHz mono, sent over IPC
    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !buffer?.byteLength) return

        this.writeToRing(decodePcm16(buffer))

        while (this.totalSamples >= this.nextWindowAt) {
            const endSample = this.nextWindowAt
            this.nextWindowAt += STEP_SAMPLES

            const samples = this.readRange(endSample - WINDOW_SAMPLES, endSample)
            if (computeRms(samples) < SILENCE_RMS_THRESHOLD) continue // whole window is silence - skip

            this.enqueueWindow({ samples, startSample: endSample - samples.length })
        }
    }

    // RING BUFFER

    private writeToRing(samples: Int16Array) {
        const capacity = this.ring.length
        for (let i = 0; i < samples.length; i++) {
            this.ring[(this.totalSamples + i) % capacity] = samples[i]
        }
        this.totalSamples += samples.length
    }

    private readRange(startSample: number, endSample: number): Int16Array {
        const capacity = this.ring.length
        const start = Math.max(startSample, 0, this.totalSamples - capacity)
        const result = new Int16Array(Math.max(endSample - start, 0))
        for (let i = 0; i < result.length; i++) {
            result[i] = this.ring[(start + i) % capacity]
        }
        return result
    }

    // WINDOW QUEUE - never more than one whisper call at a time, keep only the newest pending window

    private enqueueWindow(window: PcmWindow) {
        if (this.processing) {
            this.pendingWindow = window
            return
        }
        this.runWindow(window)
    }

    private async runWindow(window: PcmWindow): Promise<void> {
        if (this.stopped) return
        this.processing = true

        try {
            const windowStartMs = Math.round((window.startSample / SAMPLE_RATE) * 1000)
            const windowDurationMs = Math.round((window.samples.length / SAMPLE_RATE) * 1000)
            const wav = buildWavBuffer(window.samples)

            const json = this.options.binary.kind === "cli" ? await this.transcribeCli(wav, windowDurationMs) : await this.transcribeServer(wav)
            if (this.stopped) return

            const parsed = parseWhisperJson(json, windowDurationMs)
            const absolute = parsed.map((segment) => Object.assign({}, segment, { startMs: windowStartMs + segment.startMs, endMs: windowStartMs + segment.endMs }))
            const speech = absolute.filter((segment) => !isNoiseSegment(segment.text) && !isLowConfidence(segment))
            const fresh = dedupeOverlap(speech, this.lastEmittedEndMs)

            for (const segment of fresh) {
                if (segment.endMs > this.lastEmittedEndMs) this.lastEmittedEndMs = segment.endMs
                this.options.onSegment({ text: segment.text.trim(), startMs: segment.startMs, endMs: segment.endMs, language: segment.language, music: isMusicSegment(segment.text) || undefined })
            }

            this.consecutiveFailures = 0
        } catch (err) {
            if (this.stopped) return
            const message = String((err as Error)?.message || err)
            console.error("[AiScripture] Transcription window failed:", message)
            // failures while the server is respawning are expected - don't count them, only surface repeated real failures
            if (!this.serverRespawning) {
                this.consecutiveFailures++
                if (this.consecutiveFailures >= 2) this.options.onError(message)
            }
        } finally {
            this.processing = false

            const next = this.pendingWindow
            this.pendingWindow = null
            if (next && !this.stopped) this.runWindow(next)
        }
    }

    // CLI DRIVER - one whisper.cpp cli process per window, JSON output to a temp file

    private async transcribeCli(wav: Uint8Array, windowDurationMs: number): Promise<unknown> {
        // temp WAV/JSON only live for the duration of this one window - private folder (0700) and files (0600)
        const tmpDir = this.getTmpDir()
        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 })

        const outBase = path.join(tmpDir, `window-${Date.now()}-${this.windowCount++}`)
        const wavPath = outBase + ".wav"
        const jsonPath = outBase + ".json"
        this.tempFiles.add(wavPath)
        this.tempFiles.add(jsonPath)

        // the WAV must outlive the first run: a "-l auto" guess outside the declared languages re-transcribes the same file,
        // and the finally covers every exit (success, re-run, stop, timeout)
        try {
            await fs.promises.writeFile(wavPath, wav, { mode: 0o600 })
            if (this.stopped) throw new Error("Transcriber stopped")
            await this.runCliProcess(wavPath, outBase)
            const json = JSON.parse(await fs.promises.readFile(jsonPath, "utf8"))
            return await this.rerunOutsideDeclared(json, wavPath, outBase, jsonPath, windowDurationMs)
        } finally {
            this.deleteTempFile(wavPath)
            this.deleteTempFile(jsonPath)
        }
    }

    // interpretation mode guard: whisper's free "-l auto" guess spans ~99 languages, but the user declared which ones
    // are actually spoken - a guess outside that set is double-checked by re-transcribing the same window forced to the
    // detection language, and the forced result only wins when it reads as confident speech.
    // the re-run happens inside the same serialized processing slot (never parallel whisper) with the same 30s watchdog
    private async rerunOutsideDeclared(json: any, wavPath: string, outBase: string, jsonPath: string, windowDurationMs: number): Promise<unknown> {
        const primary = this.options.primaryLanguage
        const detected = typeof json?.result?.language === "string" ? json.result.language : undefined
        if (!primary || this.stopped || !shouldRerunWindow(detected, this.options.declaredLanguages)) return json

        try {
            await this.runCliProcess(wavPath, outBase, primary)
            const rerun = JSON.parse(await fs.promises.readFile(jsonPath, "utf8"))
            const segments = parseWhisperJson(rerun, windowDurationMs)
            const confident = segments.some((segment) => !isNoiseSegment(segment.text) && !isLowConfidence(segment))
            if (!confident) return json // the forced read is noise/uncertain - trust the original guess after all

            return Object.assign({}, rerun, { result: Object.assign({}, rerun.result, { language: primary }) })
        } catch {
            // a failed/timed out/stopped re-run never discards the valid first result
            return json
        }
    }

    private runCliProcess(wavPath: string, outBase: string, language: string = this.options.language): Promise<void> {
        return new Promise((resolve, reject) => {
            // stop() could have run while the WAV was being written - never spawn a child once it has begun
            if (this.stopped) return reject(new Error("Transcriber stopped"))

            const args = ["-m", this.options.modelPath, "-l", language, "-f", wavPath, "-oj", "-of", outBase, "-np"]
            const child = spawn(this.options.binary.binaryPath, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true })
            this.cliChild = child

            // watchdog: a hung whisper-cli would otherwise keep this.processing set forever and silently stall the pipeline
            let timedOut = false
            const termTimer = setTimeout(() => {
                timedOut = true
                try {
                    child.kill("SIGTERM")
                } catch {}
            }, CLI_INFERENCE_TIMEOUT)
            const killTimer = setTimeout(() => {
                try {
                    child.kill("SIGKILL")
                } catch {}
            }, CLI_INFERENCE_TIMEOUT + KILL_TIMEOUT)

            let stderr = ""
            child.stderr?.on("data", (chunk: Buffer) => {
                if (stderr.length < 4000) stderr += String(chunk)
            })

            child.on("error", (err) => {
                clearTimeout(termTimer)
                clearTimeout(killTimer)
                this.cliChild = null
                reject(err)
            })

            child.on("exit", (code) => {
                clearTimeout(termTimer)
                clearTimeout(killTimer)
                this.cliChild = null
                if (timedOut) return reject(new Error(`Whisper timed out after ${CLI_INFERENCE_TIMEOUT / 1000}s`))
                if (this.stopped) return reject(new Error("Transcriber stopped"))
                if (code === 0) return resolve()
                reject(new Error(`Whisper exited with code ${code}${stderr ? ": " + stderr.slice(-300).trim() : ""}`))
            })
        })
    }

    // SERVER DRIVER - one whisper.cpp server process for the whole session

    private async startServer(): Promise<void> {
        let lastError: Error | null = null

        // one retry: another process could grab the probed port before whisper binds it
        for (let attempt = 0; attempt < 2; attempt++) {
            const port = await getFreePort()
            try {
                await this.spawnServer(port)
                this.serverPort = port
                return
            } catch (err) {
                lastError = err as Error
                const child = this.serverChild
                this.serverChild = null
                if (child) await killProcess(child)
                if (this.stopped) throw new Error("Transcriber stopped")
            }
        }

        throw lastError || new Error("Could not start whisper server")
    }

    private spawnServer(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = ["-m", this.options.modelPath, "-l", this.options.language, "--port", String(port), "--host", "127.0.0.1"]
            const child = spawn(this.options.binary.binaryPath, args, { stdio: "ignore", windowsHide: true })
            this.serverChild = child

            let settled = false
            const settle = (err?: Error) => {
                if (settled) return
                settled = true
                if (err) reject(err)
                else resolve()
            }

            child.on("error", (err) => {
                if (!settled) this.serverChild = null
                settle(err)
            })

            child.on("exit", (code) => {
                if (!settled) {
                    this.serverChild = null
                    settle(new Error(`Whisper server exited with code ${code}`))
                    return
                }
                this.handleServerExit(child, code)
            })

            this.waitForServer(port, child).then(
                () => settle(),
                (err: Error) => settle(err)
            )
        })
    }

    private async waitForServer(port: number, child: ChildProcess): Promise<void> {
        const deadline = Date.now() + SERVER_START_TIMEOUT

        while (Date.now() < deadline) {
            if (this.stopped) throw new Error("Transcriber stopped")
            if (child.exitCode !== null) throw new Error(`Whisper server exited with code ${child.exitCode}`)

            // another local process could have grabbed the probed port before whisper bound it - only accept a responder
            // that actually identifies as whisper-server, never post microphone audio to a stranger. if the squatter never
            // passes the check, whisper's own bind failure exits the child and startServer() retries on a fresh port.
            if (await this.isWhisperServer(port)) return
            await delay(250)
        }

        throw new Error("Whisper server did not respond in time")
    }

    // probe /inference without a "file" field - whisper-server answers with a JSON body (an "error" about the missing
    // file), which an unrelated process that happened to win the port race would not produce
    private async isWhisperServer(port: number): Promise<boolean> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1000)

        try {
            const form = new FormData()
            form.append("response_format", "json")
            const response = await fetch(`http://127.0.0.1:${port}/inference`, { method: "POST", body: form, signal: controller.signal })

            // read body as text first to support servers that return plain-text diagnostics
            const bodyText = await response.text()
            if (bodyText && typeof bodyText === "string") {
                try {
                    const json = JSON.parse(bodyText)
                    if (json && typeof json === "object" && (typeof json.error === "string" || typeof json.text === "string")) return true
                } catch {
                    // not JSON
                }

                // accept common plain-text replies the official server uses
                if (/no \'file\' field|no 'file' field|invalid request/i.test(bodyText)) return true
            }

            return false
        } catch {
            return false
        } finally {
            clearTimeout(timer)
        }
    }

    private handleServerExit(child: ChildProcess, code: number | null) {
        if (this.stopped || this.serverChild !== child) return
        this.serverChild = null

        if (this.serverRespawned) {
            this.options.onError(`Whisper server exited unexpectedly with code ${code}`)
            return
        }

        this.serverRespawned = true
        this.serverRespawning = true
        console.error(`[AiScripture] Whisper server exited unexpectedly with code ${code}, respawning...`)
        this.startServer().then(
            () => {
                // windows that failed while the server was down were transient - a single successful restart is not an error
                this.serverRespawning = false
                this.consecutiveFailures = 0
            },
            (err: Error) => {
                this.serverRespawning = false
                if (!this.stopped) this.options.onError(String(err?.message || err))
            }
        )
    }

    private async transcribeServer(wav: Uint8Array): Promise<unknown> {
        if (this.stopped) throw new Error("Transcriber stopped")
        // while the server is respawning this.serverPort is stale - don't post audio anywhere until it is back
        if (this.serverRespawning) throw new Error("Whisper server is restarting")

        const form = new FormData()
        const viewForBlob = new Uint8Array(wav.buffer as ArrayBuffer, wav.byteOffset, wav.byteLength)
        form.append("file", new Blob([viewForBlob], { type: "audio/wav" }), "window.wav")
        form.append("response_format", "json")
        form.append("temperature", "0.0")

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), SERVER_INFERENCE_TIMEOUT)

        try {
            const response = await fetch(`http://127.0.0.1:${this.serverPort}/inference`, { method: "POST", body: form, signal: controller.signal })
            if (!response.ok) throw new Error(`Whisper server responded with status ${response.status}`)
            return await response.json()
        } finally {
            clearTimeout(timer)
        }
    }

    // TEMP FILES

    private getTmpDir(): string {
        return path.join(app.getPath("userData"), "aiScripture-tmp")
    }

    private deleteTempFile(filePath: string) {
        this.tempFiles.delete(filePath)
        try {
            fs.unlinkSync(filePath)
        } catch {}
    }

    private cleanupTempFiles() {
        for (const filePath of this.tempFiles) {
            try {
                fs.unlinkSync(filePath)
            } catch {}
        }
        this.tempFiles.clear()
    }
}

// PURE HELPERS (exported for tests)

// in-memory WAV: 44 byte header + Int16 LE PCM data (16kHz mono 16-bit)
function buildWavBuffer(samples: Int16Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
    const dataSize = samples.length * 2
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write("RIFF", 0, "ascii")
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write("WAVE", 8, "ascii")

    buffer.write("fmt ", 12, "ascii")
    buffer.writeUInt32LE(16, 16) // fmt chunk size
    buffer.writeUInt16LE(1, 20) // PCM
    buffer.writeUInt16LE(1, 22) // mono
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate (sampleRate * channels * bytesPerSample)
    buffer.writeUInt16LE(2, 32) // block align
    buffer.writeUInt16LE(16, 34) // bits per sample

    buffer.write("data", 36, "ascii")
    buffer.writeUInt32LE(dataSize, 40)
    for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(samples[i], 44 + i * 2)

    return buffer
}

// root mean square of Int16 samples, normalized to 0-1
function computeRms(samples: Int16Array): number {
    if (!samples.length) return 0

    let sum = 0
    for (let i = 0; i < samples.length; i++) {
        const normalized = samples[i] / 32768
        sum += normalized * normalized
    }
    return Math.sqrt(sum / samples.length)
}

// whisper likes to label non-speech audio, e.g. "[BLANK_AUDIO]", "(music)", "[Music]", "*applause*", "♪"
function isNoiseSegment(text: string): boolean {
    const leftover = text.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, "").replace(/[♪♫\s.,!?\-–—_]+/g, "")
    return leftover === ""
}

// whisper wraps sung content in ♪...♪ - and reliably HALLUCINATES lyrics for music it does not know,
// so music segments are shown in the transcript but must never feed scripture detection
function isMusicSegment(text: string): boolean {
    return /[♪♫]/.test(text)
}

// interpretation mode: a "-l auto" guess outside the declared spoken languages warrants a forced re-check.
// an unset/unresolved detection never re-runs, and an empty declaration means "no constraint"
function shouldRerunWindow(detected: string | undefined, declared: string[] | undefined): boolean {
    const language = (detected || "").trim().toLowerCase()
    if (!language || language === "auto") return false
    if (!declared?.length) return false
    return !declared.some((code) => code.trim().toLowerCase() === language)
}

// drop segments whisper itself is unsure about - only where the JSON provides the values
function isLowConfidence(segment: { noSpeechProb?: number; avgLogprob?: number }): boolean {
    if (typeof segment.noSpeechProb === "number" && segment.noSpeechProb > NO_SPEECH_PROB_MAX) return true
    if (typeof segment.avgLogprob === "number" && segment.avgLogprob < AVG_LOGPROB_MIN) return true
    return false
}

// the first 1s of each window overlaps the previous one - drop/trim segments already emitted.
// trimming clamps the start timestamp AND drops the proportional share of leading words, so the overlap words are not re-emitted
function dedupeOverlap<T extends { text: string; startMs: number; endMs: number }>(segments: T[], previousEndMs: number): T[] {
    const result: T[] = []
    for (const segment of segments) {
        if (segment.endMs <= previousEndMs) continue // fully emitted already
        if (segment.startMs >= previousEndMs) {
            result.push(segment)
            continue
        }

        const text = trimOverlapText(segment.text, segment.startMs, segment.endMs, previousEndMs)
        if (!text) continue // every word falls inside the already emitted part
        result.push(Object.assign({}, segment, { text, startMs: previousEndMs }))
    }
    return result
}

// drop the leading words that (proportionally by time) fall before previousEndMs
function trimOverlapText(text: string, startMs: number, endMs: number, previousEndMs: number): string {
    const words = text.split(/\s+/).filter(Boolean)
    const durationMs = endMs - startMs
    if (!words.length || durationMs <= 0) return ""

    const dropCount = Math.round((words.length * (previousEndMs - startMs)) / durationMs)
    if (dropCount <= 0) return text
    return words.slice(dropCount).join(" ")
}

// tolerant parser for the different whisper.cpp JSON shapes:
// - cli -oj: { result: { language }, transcription: [{ text, offsets: { from, to } }] } (ms offsets)
// - server response_format=json: { text } (no timestamps - spans the whole window)
// - verbose/OpenAI style: { segments: [{ text, start, end, no_speech_prob, avg_logprob }] } (seconds)
function parseWhisperJson(json: any, windowDurationMs: number): WhisperSegment[] {
    if (!json || typeof json !== "object") return []
    const segments: WhisperSegment[] = []

    // overall detected language of the window (cli -oj) - "auto" would mean whisper never resolved it
    let language = typeof json.result?.language === "string" ? json.result.language.trim().toLowerCase() : undefined
    if (language === "auto" || language === "") language = undefined

    if (Array.isArray(json.transcription)) {
        for (const entry of json.transcription) {
            if (!entry || typeof entry.text !== "string") continue
            const from = Number(entry.offsets?.from)
            const to = Number(entry.offsets?.to)
            segments.push({
                text: entry.text,
                startMs: isFinite(from) ? from : 0,
                endMs: isFinite(to) ? to : windowDurationMs,
                noSpeechProb: asNumber(entry.no_speech_prob),
                avgLogprob: asNumber(entry.avg_logprob),
                language
            })
        }
        return segments
    }

    if (Array.isArray(json.segments)) {
        for (const entry of json.segments) {
            if (!entry || typeof entry.text !== "string") continue
            const start = Number(entry.start)
            const end = Number(entry.end)
            segments.push({
                text: entry.text,
                startMs: isFinite(start) ? Math.round(start * 1000) : 0,
                endMs: isFinite(end) ? Math.round(end * 1000) : windowDurationMs,
                noSpeechProb: asNumber(entry.no_speech_prob),
                avgLogprob: asNumber(entry.avg_logprob),
                language
            })
        }
        return segments
    }

    if (typeof json.text === "string" && json.text.trim()) {
        segments.push({ text: json.text, startMs: 0, endMs: windowDurationMs, language })
    }

    return segments
}

// INTERNAL HELPERS

function asNumber(value: any): number | undefined {
    return typeof value === "number" && isFinite(value) ? value : undefined
}

// Int16 LE PCM bytes -> samples (endianness/alignment safe)
function decodePcm16(buffer: Uint8Array): Int16Array {
    const byteLength = buffer.byteLength - (buffer.byteLength % 2)
    const view = new DataView(buffer.buffer, buffer.byteOffset, byteLength)
    const samples = new Int16Array(byteLength / 2)
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true)
    return samples
}

function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.once("error", reject)
        server.listen(0, "127.0.0.1", () => {
            const address = server.address()
            const port = address && typeof address === "object" ? address.port : 0
            server.close(() => (port ? resolve(port) : reject(new Error("Could not find a free port"))))
        })
    })
}

function killProcess(child: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve()

        const forceTimer = setTimeout(() => {
            try {
                child.kill("SIGKILL")
            } catch {}
        }, KILL_TIMEOUT)
        const giveUpTimer = setTimeout(() => resolve(), KILL_TIMEOUT * 2)

        child.once("exit", () => {
            clearTimeout(forceTimer)
            clearTimeout(giveUpTimer)
            resolve()
        })

        try {
            child.kill("SIGTERM")
        } catch {
            clearTimeout(forceTimer)
            clearTimeout(giveUpTimer)
            resolve()
        }
    })
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
