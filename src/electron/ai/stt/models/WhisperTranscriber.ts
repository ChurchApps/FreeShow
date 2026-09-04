import { spawn, type ChildProcess } from "child_process"
import { app } from "electron"
import fs from "fs"
import net from "net"
import os from "os"
import path from "path"
import type { SttEngineOptions } from "../../../../types/ai/AiSettings"
import { LocalModelManager } from "../../setup/LocalModelManager"
import type { DriverCallbacks, TranscriberSegment as DriverSegment, TranscriptionDriver } from "../sttHelper"
import { appendTailWords, trimRepeatedLeadWords } from "../sttHelper"

const SAMPLE_RATE = 16000
const RING_SECONDS = 30
const STEP_SECONDS = 3
const MAX_WINDOW_SECONDS = 10
const MAX_LAG_SECONDS = 15
const RING_GUARD_SECONDS = 2

const STEP_SAMPLES = STEP_SECONDS * SAMPLE_RATE
const MAX_WINDOW_SAMPLES = MAX_WINDOW_SECONDS * SAMPLE_RATE
const MAX_LAG_SAMPLES = MAX_LAG_SECONDS * SAMPLE_RATE

const OVERLAP_BACKTRACK_MS = 300
const HOLDBACK_MS = 800

const SILENCE_SNAP_SEARCH_MS = 1200
const SILENCE_SNAP_FRAME_MS = 100
const SILENCE_SNAP_HOP_MS = 50
const SNAP_MIN_FRESH_MS = 1000

const SILENCE_RMS_THRESHOLD = 0.01

const NO_SPEECH_PROB_MAX = 0.6
const AVG_LOGPROB_MIN = -1.0

const SERVER_START_TIMEOUT = 20000
const SERVER_INFERENCE_TIMEOUT = 30000
const CLI_INFERENCE_TIMEOUT = 30000
const KILL_TIMEOUT = 2000

const WHISPER_THREADS = String(Math.max(4, Math.min(8, os.cpus().length - 2)))

interface WhisperWord {
    text: string
    startMs: number
    endMs: number
}

interface WhisperSegment extends DriverSegment {
    noSpeechProb?: number
    avgLogprob?: number
    words?: WhisperWord[]
}

interface TranscriberOptions extends DriverCallbacks {
    binary: { kind: "cli" | "server"; binaryPath: string }
    modelPath: string
    language: string
    declaredLanguages?: string[]
    primaryLanguage?: string
    prompt?: string
}

interface PcmWindow {
    samples: Int16Array
    startSample: number
    endsInSilence: boolean
}

export class Transcriber implements TranscriptionDriver {
    private options: TranscriberOptions
    private ring = new Int16Array(RING_SECONDS * SAMPLE_RATE)
    private totalSamples = 0
    private coveredUntilSample = 0

    private processing = false
    private lastEmittedEndMs = 0
    private lastEmittedTailWords: string[] = []
    private lastEmittedKey = ""
    private consecutiveFailures = 0
    private windowCount = 0
    private slowWindows = 0

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

    setPrompt(prompt: string | undefined) {
        this.options.prompt = prompt
    }

    async start(): Promise<void> {
        if (this.stopped) throw new Error("Transcriber has already been stopped")

        const tmpDir = this.getTmpDir()
        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 })
        try {
            fs.chmodSync(tmpDir, 0o700)
        } catch {}

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

        const children: ChildProcess[] = []
        if (this.cliChild) children.push(this.cliChild)
        if (this.serverChild) children.push(this.serverChild)
        this.cliChild = null
        this.serverChild = null

        await Promise.all(children.map((child) => killProcess(child)))
        this.cleanupTempFiles()
    }

    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !buffer?.byteLength) return
        this.writeToRing(decodePcm16(buffer))
        this.scheduleWindow()
    }

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

    private scheduleWindow(): void {
        if (this.processing || this.stopped) return

        while (!this.processing) {
            const head = this.totalSamples
            const oldestSafe = Math.max(0, head - this.ring.length + RING_GUARD_SECONDS * SAMPLE_RATE)

            if (head - this.coveredUntilSample > MAX_LAG_SAMPLES || this.coveredUntilSample < oldestSafe - STEP_SAMPLES) {
                console.warn(`[AI STT] Whisper fell ${Math.round((head - this.coveredUntilSample) / SAMPLE_RATE)}s behind - jumping to live audio`)
                this.coveredUntilSample = head - STEP_SAMPLES
                this.lastEmittedEndMs = Math.round((this.coveredUntilSample / SAMPLE_RATE) * 1000)
                this.lastEmittedTailWords = []
            }

            if (head - this.coveredUntilSample < STEP_SAMPLES) return

            const windowStart = Math.max(0, oldestSafe, this.coveredUntilSample - Math.round((OVERLAP_BACKTRACK_MS / 1000) * SAMPLE_RATE))
            let windowEnd = Math.min(head, windowStart + MAX_WINDOW_SAMPLES)

            const freshRegion = this.readRange(this.coveredUntilSample, windowEnd)
            if (computeRms(freshRegion) < SILENCE_RMS_THRESHOLD) {
                this.coveredUntilSample = windowEnd
                continue
            }

            let endsInSilence = false
            const samples = this.readRange(windowStart, windowEnd)
            const valley = findSilenceValley(samples, Math.round((SILENCE_SNAP_SEARCH_MS / 1000) * SAMPLE_RATE))
            if (valley !== null) {
                const snappedEnd = windowStart + valley
                if (snappedEnd - this.coveredUntilSample >= Math.round((SNAP_MIN_FRESH_MS / 1000) * SAMPLE_RATE)) {
                    windowEnd = snappedEnd
                    endsInSilence = true
                }
            }

            void this.runWindow({ samples: endsInSilence ? samples.subarray(0, windowEnd - windowStart) : samples, startSample: windowStart, endsInSilence })
            return
        }
    }

    private async runWindow(window: PcmWindow): Promise<void> {
        if (this.stopped) return
        this.processing = true

        try {
            const windowStartMs = Math.round((window.startSample / SAMPLE_RATE) * 1000)
            const windowDurationMs = Math.round((window.samples.length / SAMPLE_RATE) * 1000)
            const wav = buildWavBuffer(window.samples)

            const decodeStartedAt = Date.now()
            const json = this.options.binary.kind === "cli" ? await this.transcribeCli(wav, windowDurationMs) : await this.transcribeServer(wav)
            if (this.stopped) return
            this.trackDecodePace(Date.now() - decodeStartedAt, windowDurationMs)

            this.emitWindow(parseWhisperJson(json, windowDurationMs), window, windowStartMs, windowDurationMs)
            this.consecutiveFailures = 0
        } catch (err) {
            if (this.stopped) return
            const message = String((err as Error)?.message || err)
            console.error("[AI STT] Transcription window failed:", message)
            if (!this.serverRespawning) {
                this.consecutiveFailures++
                if (this.consecutiveFailures >= 2) this.options.onError(message)
            }
        } finally {
            this.processing = false
            if (!this.stopped) this.scheduleWindow()
        }
    }

    private emitWindow(parsed: WhisperSegment[], window: PcmWindow, windowStartMs: number, windowDurationMs: number) {
        const speech = parsed.filter((segment) => !isNoiseSegment(segment.text) && !isLowConfidence(segment))
        const music = speech.some((segment) => isMusicSegment(segment.text))
        const language = speech.find((segment) => segment.language)?.language

        const words: WhisperWord[] = []
        for (const segment of speech) {
            for (const word of segment.words?.length ? segment.words : evenlySpacedWords(segment)) {
                words.push({ text: word.text, startMs: windowStartMs + word.startMs, endMs: windowStartMs + word.endMs })
            }
        }

        const fresh = words.filter((word) => (word.startMs + word.endMs) / 2 >= this.lastEmittedEndMs - OVERLAP_BACKTRACK_MS)

        const windowEndMs = windowStartMs + windowDurationMs
        const cutoffMs = window.endsInSilence ? Infinity : windowEndMs - HOLDBACK_MS
        const emitted = fresh.filter((word) => word.endMs <= cutoffMs)
        const withheld = fresh.filter((word) => word.endMs > cutoffMs)
        this.options.onInterim?.(withheld.map((word) => word.text).join(" "))

        const coverEndMs = withheld.length ? Math.min(cutoffMs, withheld[0].startMs) : Math.min(windowEndMs, cutoffMs)
        const previousCovered = this.coveredUntilSample
        const coverSample = window.startSample + Math.round(((coverEndMs - windowStartMs) / 1000) * SAMPLE_RATE)
        this.coveredUntilSample = Math.max(previousCovered + SAMPLE_RATE, Math.min(coverSample, window.startSample + window.samples.length))

        if (!emitted.length) return

        const joined = emitted
            .map((word) => word.text)
            .join(" ")
            .trim()
        if (!joined || isRepetitionLoop(joined)) return

        const text = trimRepeatedLeadWords(this.lastEmittedTailWords, joined)
        if (!text) return

        const repeatKey = segmentRepeatKey(text)
        if (repeatKey && repeatKey === this.lastEmittedKey) return
        this.lastEmittedKey = repeatKey

        const endMs = emitted[emitted.length - 1].endMs
        if (endMs > this.lastEmittedEndMs) this.lastEmittedEndMs = endMs
        this.lastEmittedTailWords = appendTailWords(this.lastEmittedTailWords, text)
        this.options.onSegment({ text, startMs: emitted[0].startMs, endMs, language, music: music || undefined, utteranceEnd: window.endsInSilence || undefined })
    }

    private trackDecodePace(decodeMs: number, windowDurationMs: number) {
        if (decodeMs > windowDurationMs) {
            this.slowWindows++
            if (this.slowWindows === 1 || this.slowWindows % 10 === 0) {
                console.warn(`[AI STT] Whisper decoded ${windowDurationMs}ms of audio in ${decodeMs}ms - transcript will lag`)
            }
        }
    }

    private async transcribeCli(wav: Uint8Array, windowDurationMs: number): Promise<unknown> {
        const tmpDir = this.getTmpDir()
        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 })

        const outBase = path.join(tmpDir, `window-${Date.now()}-${this.windowCount++}`)
        const wavPath = `${outBase}.wav`
        const jsonPath = `${outBase}.json`
        this.tempFiles.add(wavPath)
        this.tempFiles.add(jsonPath)

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

    private async rerunOutsideDeclared(json: any, wavPath: string, outBase: string, jsonPath: string, windowDurationMs: number): Promise<unknown> {
        const primary = this.options.primaryLanguage
        const detected = typeof json?.result?.language === "string" ? json.result.language : undefined
        if (!primary || this.stopped || !shouldRerunWindow(detected, this.options.declaredLanguages)) return json

        try {
            await this.runCliProcess(wavPath, outBase, primary)
            const rerun = JSON.parse(await fs.promises.readFile(jsonPath, "utf8"))
            const segments = parseWhisperJson(rerun, windowDurationMs)
            const confident = segments.some((segment) => !isNoiseSegment(segment.text) && !isLowConfidence(segment))
            if (!confident) return json

            return { ...rerun, result: { ...rerun.result, language: primary } }
        } catch {
            return json
        }
    }

    private runCliProcess(wavPath: string, outBase: string, language: string = this.options.language): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.stopped) return reject(new Error("Transcriber stopped"))

            const args = ["-m", this.options.modelPath, "-l", language, "-f", wavPath, "-ojf", "-of", outBase, "-np", "-t", WHISPER_THREADS, "-nf"]
            if (this.options.prompt) args.push("--prompt", this.options.prompt)

            const child = spawn(this.options.binary.binaryPath, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true })
            this.cliChild = child

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

    private async startServer(): Promise<void> {
        let lastError: Error | null = null

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
            const args = ["-m", this.options.modelPath, "-l", this.options.language, "--port", String(port), "--host", "127.0.0.1", "-t", WHISPER_THREADS]
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

            if (await this.isWhisperServer(port)) return
            await delay(250)
        }

        throw new Error("Whisper server did not respond in time")
    }

    private async isWhisperServer(port: number): Promise<boolean> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1000)

        try {
            const form = new FormData()
            form.append("response_format", "json")
            const response = await fetch(`http://127.0.0.1:${port}/inference`, { method: "POST", body: form, signal: controller.signal })

            const bodyText = await response.text()
            if (bodyText && typeof bodyText === "string") {
                try {
                    const json = JSON.parse(bodyText)
                    if (json && typeof json === "object" && (typeof json.error === "string" || typeof json.text === "string")) return true
                } catch {}

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
        console.error(`[AI STT] Whisper server exited unexpectedly with code ${code}, respawning...`)
        this.startServer().then(
            () => {
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
        if (this.serverRespawning) throw new Error("Whisper server is restarting")

        const form = new FormData()
        const viewForBlob = new Uint8Array(wav.buffer as ArrayBuffer, wav.byteOffset, wav.byteLength)
        form.append("file", new Blob([viewForBlob], { type: "audio/wav" }), "window.wav")
        form.append("response_format", "verbose_json")
        form.append("max_len", "1")
        form.append("split_on_word", "true")
        form.append("no_context", "true")
        form.append("temperature", "0.0")
        form.append("temperature_inc", "0.0")
        if (this.options.prompt) form.append("prompt", this.options.prompt)

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

    private getTmpDir(): string {
        return path.join(app.getPath("userData"), "ai-stt-tmp")
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

export function findSilenceValley(samples: Int16Array, searchSamples: number): number | null {
    const frame = Math.round((SILENCE_SNAP_FRAME_MS / 1000) * SAMPLE_RATE)
    const hop = Math.round((SILENCE_SNAP_HOP_MS / 1000) * SAMPLE_RATE)
    const from = Math.max(0, samples.length - searchSamples)
    if (samples.length - from < frame) return null

    let best: { offset: number; rms: number } | null = null
    for (let start = from; start + frame <= samples.length; start += hop) {
        const rms = computeRms(samples.subarray(start, start + frame))
        if (rms < SILENCE_RMS_THRESHOLD && (!best || rms < best.rms)) best = { offset: start + Math.floor(frame / 2), rms }
    }
    return best ? best.offset : null
}

export function evenlySpacedWords(segment: { text: string; startMs: number; endMs: number }): WhisperWord[] {
    const words = segment.text.split(/\s+/).filter(Boolean)
    if (!words.length) return []

    const duration = Math.max(0, segment.endMs - segment.startMs)
    const per = duration / words.length
    return words.map((text, i) => ({ text, startMs: Math.round(segment.startMs + i * per), endMs: Math.round(segment.startMs + (i + 1) * per) }))
}

export function buildWavBuffer(samples: Int16Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
    const dataSize = samples.length * 2
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write("RIFF", 0, "ascii")
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write("WAVE", 8, "ascii")
    buffer.write("fmt ", 12, "ascii")
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write("data", 36, "ascii")
    buffer.writeUInt32LE(dataSize, 40)

    for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(samples[i], 44 + i * 2)
    return buffer
}

export function computeRms(samples: Int16Array): number {
    if (!samples.length) return 0
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
        const normalized = samples[i] / 32768
        sum += normalized * normalized
    }
    return Math.sqrt(sum / samples.length)
}

export function isNoiseSegment(text: string): boolean {
    const leftover = text.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, "").replace(/[♪♫\s.,!?\-–—_]+/g, "")
    return leftover === ""
}

export function isMusicSegment(text: string): boolean {
    return /[♪♫]/.test(text)
}

export function isRepetitionLoop(text: string): boolean {
    const tokens = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
    if (tokens.length < 5) return false

    const counts = new Map<string, number>()
    let topCount = 0
    for (const token of tokens) {
        const count = (counts.get(token) || 0) + 1
        counts.set(token, count)
        if (count > topCount) topCount = count
    }
    return topCount / tokens.length >= 0.6
}

export function segmentRepeatKey(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
}

export function shouldRerunWindow(detected: string | undefined, declared: string[] | undefined): boolean {
    const language = (detected || "").trim().toLowerCase()
    if (!language || language === "auto") return false
    if (!declared?.length) return false
    return !declared.some((code) => code.trim().toLowerCase() === language)
}

export function isLowConfidence(segment: { noSpeechProb?: number; avgLogprob?: number }): boolean {
    if (typeof segment.noSpeechProb === "number" && segment.noSpeechProb > NO_SPEECH_PROB_MAX) return true
    if (typeof segment.avgLogprob === "number" && segment.avgLogprob < AVG_LOGPROB_MIN) return true
    return false
}

export function parseWhisperJson(json: any, windowDurationMs: number): WhisperSegment[] {
    if (!json || typeof json !== "object") return []
    const segments: WhisperSegment[] = []

    let language = typeof json.result?.language === "string" ? json.result.language.trim().toLowerCase() : undefined
    if (language === "auto" || language === "") language = undefined

    const clamp = (ms: number) => Math.max(0, Math.min(ms, windowDurationMs))

    if (Array.isArray(json.transcription)) {
        for (const entry of json.transcription) {
            if (!entry || typeof entry.text !== "string") continue
            const from = Number(entry.offsets?.from)
            const to = Number(entry.offsets?.to)
            const tokens = parseSegmentTokens(entry.tokens, clamp)
            segments.push({
                text: entry.text,
                startMs: Number.isFinite(from) ? clamp(from) : 0,
                endMs: Number.isFinite(to) ? clamp(to) : windowDurationMs,
                noSpeechProb: asNumber(entry.no_speech_prob),
                avgLogprob: asNumber(entry.avg_logprob) ?? tokens?.avgLogprob,
                words: tokens?.words,
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
                startMs: Number.isFinite(start) ? clamp(Math.round(start * 1000)) : 0,
                endMs: Number.isFinite(end) ? clamp(Math.round(end * 1000)) : windowDurationMs,
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

function parseSegmentTokens(tokens: any, clamp: (ms: number) => number): { words: WhisperWord[]; avgLogprob?: number } | null {
    if (!Array.isArray(tokens) || !tokens.length) return null

    const words: WhisperWord[] = []
    let logprobSum = 0
    let logprobCount = 0

    for (const token of tokens) {
        if (!token || typeof token.text !== "string") continue
        if (/^\s*\[_[A-Z_]+_\]\s*$/.test(token.text)) continue

        const from = Number(token.offsets?.from)
        const to = Number(token.offsets?.to)
        const p = asNumber(token.p)
        if (p !== undefined && p > 0) {
            logprobSum += Math.log(p)
            logprobCount++
        }

        const startsWord = /^\s/.test(token.text) || !words.length
        const text = token.text.trim()
        const startMs = Number.isFinite(from) ? clamp(from) : 0
        const endMs = Number.isFinite(to) ? clamp(to) : startMs

        if (startsWord) {
            if (text) words.push({ text, startMs, endMs })
            continue
        }

        const last = words[words.length - 1]
        if (last) {
            last.text += text
            if (endMs > last.endMs) last.endMs = endMs
        } else if (text) {
            words.push({ text, startMs, endMs })
        }
    }

    if (!words.length) return null
    return { words, avgLogprob: logprobCount ? logprobSum / logprobCount : undefined }
}

function asNumber(value: any): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

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

type TranscriberSegment = DriverSegment

interface WhisperTranscriberOptions extends SttEngineOptions {
    whisper: { kind: "cli" | "server"; binaryPath: string }
    model: string
    prompt?: string
}

export class WhisperTranscriber {
    transcriber: Transcriber | null = null

    constructor(_options: WhisperTranscriberOptions, onSegment: (segment: TranscriberSegment) => void, onError: (message: string) => void, onInterim?: (text: string) => void) {
        const interpretation = !!_options.interpretationMode
        const options = {
            binary: _options.whisper,
            modelPath: _options.customModelPath || LocalModelManager.getModelPath("whisper", _options.model),
            language: interpretation ? "auto" : _options.language || "en",
            declaredLanguages: interpretation ? _options.spokenLanguages : undefined,
            primaryLanguage: _options.listenLanguage,
            prompt: _options.prompt,
            onSegment,
            onError,
            onInterim
        }
        this.transcriber = new Transcriber(options)
    }

    setPrompt(prompt: string | undefined) {
        this.transcriber?.setPrompt(prompt)
    }

    async start() {
        if (!this.transcriber) return false
        await this.transcriber.start()
        return true
    }

    async stop() {
        if (!this.transcriber) return false
        await this.transcriber.stop()
        this.transcriber = null
        return true
    }

    pushAudio(buffer: Uint8Array) {
        if (!this.transcriber) return false
        this.transcriber.pushAudio(buffer)
        return true
    }
}
