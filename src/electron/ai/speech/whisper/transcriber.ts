import { spawn, type ChildProcess } from "child_process"
import { app } from "electron"
import fs from "fs"
import net from "net"
import os from "os"
import path from "path"
import { appendTailWords, trimRepeatedLeadWords } from "../seam"
import type { DriverCallbacks, TranscriberSegment as DriverSegment, TranscriptionDriver } from "../types"
import { isPromptEcho } from "./prompt"

// AI AUTO SCRIPTURE - streaming transcription over whisper.cpp
// Receives 100ms chunks of Int16 LE PCM @ 16kHz mono from the renderer (IPC) into a ring buffer.
// Windows are cut COVERAGE-DRIVEN: each starts just before where the last one's emissions ended,
// so no audio is ever skipped - when decodes lag, the next window GROWS (up to a cap) instead of
// audio being dropped. Words are emitted with their timestamps; the trailing bit of a window that
// does not end in silence is held back (shown as interim) and re-decoded whole in the next window,
// so a word can never be emitted cut in half.

const SAMPLE_RATE = 16000
const RING_SECONDS = 30
// minimum fresh (uncovered) audio before a window is cut - the latency floor
const STEP_SECONDS = 3
// windows grow under decode lag instead of skipping audio, up to this length
const MAX_WINDOW_SECONDS = 10
// backlog beyond this gets a forced, LOGGED jump - a visible hole beats an ever-growing lag
const MAX_LAG_SECONDS = 15
// never cut a window that reaches into audio the ring is about to overwrite
const RING_GUARD_SECONDS = 2

const STEP_SAMPLES = STEP_SECONDS * SAMPLE_RATE
const MAX_WINDOW_SAMPLES = MAX_WINDOW_SECONDS * SAMPLE_RATE
const MAX_LAG_SAMPLES = MAX_LAG_SECONDS * SAMPLE_RATE

// the window starts slightly BEFORE the covered edge, so a word whose tail was held back at that
// edge re-decodes whole (the timestamp drop + seam stitch remove true repeats)
const OVERLAP_BACKTRACK_MS = 300

// words ending in the final stretch of a window that is NOT silence-snapped are withheld (the cut
// may sit mid-word) - they surface as interim text and re-decode whole in the next window
const HOLDBACK_MS = 800

// window ends snap to a quiet dip in this trailing stretch - a boundary in silence cuts nothing
const SILENCE_SNAP_SEARCH_MS = 1200
const SILENCE_SNAP_FRAME_MS = 100
const SILENCE_SNAP_HOP_MS = 50
// a snapped window must still cover this much fresh audio, or the snap is ignored
const SNAP_MIN_FRESH_MS = 1000

// RMS (normalized 0-1) below this counts as silence
const SILENCE_RMS_THRESHOLD = 0.01

// confidence gates (only applied when the whisper JSON provides the values)
const NO_SPEECH_PROB_MAX = 0.6
const AVG_LOGPROB_MIN = -1.0

const SERVER_START_TIMEOUT = 20000
const SERVER_INFERENCE_TIMEOUT = 30000
const CLI_INFERENCE_TIMEOUT = 30000
const KILL_TIMEOUT = 2000

// whisper.cpp defaults to 4 threads - short windows on a short step want the inference as fast as the machine allows
const WHISPER_THREADS = String(Math.max(4, Math.min(8, os.cpus().length - 2)))

interface WhisperWord {
    text: string
    startMs: number
    endMs: number
}

interface WhisperSegment extends DriverSegment {
    noSpeechProb?: number
    avgLogprob?: number
    words?: WhisperWord[] // token-level timing (cli -ojf) - segments without it fall back to even spacing
}

interface TranscriberOptions extends DriverCallbacks {
    binary: { kind: "cli" | "server"; binaryPath: string }
    modelPath: string
    language: string
    declaredLanguages?: string[] // interpretation mode: the languages actually being spoken - a "-l auto" guess outside this set triggers a forced re-check
    primaryLanguage?: string // the scripture detection language - forced re-checks transcribe the window with this language
    prompt?: string // decoder vocabulary biasing (biblical names/archaisms) - sent with every window, live-updatable via setPrompt()
}

interface PcmWindow {
    samples: Int16Array
    startSample: number
    endsInSilence: boolean // the end was snapped to a quiet dip - nothing to hold back
}

export class Transcriber implements TranscriptionDriver {
    private options: TranscriberOptions

    private ring = new Int16Array(RING_SECONDS * SAMPLE_RATE)
    private totalSamples = 0
    // audio up to here has been decoded and resolved (emitted, withheld-for-redecode, or silence)
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

    // both drivers read the prompt per window (cli args are rebuilt per run, the server takes a form
    // field per request), so a passage-aware update simply applies from the next window on
    setPrompt(prompt: string | undefined) {
        this.options.prompt = prompt
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

        const children: ChildProcess[] = []
        if (this.cliChild) children.push(this.cliChild)
        if (this.serverChild) children.push(this.serverChild)
        this.cliChild = null
        this.serverChild = null

        await Promise.all(children.map((child) => killProcess(child)))
        this.cleanupTempFiles()
    }

    // 100ms chunks of Int16 LE PCM @ 16kHz mono, sent over IPC
    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !buffer?.byteLength) return

        this.writeToRing(decodePcm16(buffer))
        this.scheduleWindow()
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

    // WINDOW SCHEDULING - coverage-driven: one whisper call at a time, each window starting where
    // coverage ends. When decodes lag, the next window GROWS instead of audio being skipped

    private scheduleWindow(): void {
        if (this.processing || this.stopped) return

        // silence advances coverage without a decode (whisper's favorite hallucination surface),
        // so the loop may resolve several silent stretches before finding one worth decoding
        while (!this.processing) {
            const head = this.totalSamples
            const oldestSafe = Math.max(0, head - this.ring.length + RING_GUARD_SECONDS * SAMPLE_RATE)

            // pathological lag: a LOGGED jump with a visible hole beats an ever-growing delay
            if (head - this.coveredUntilSample > MAX_LAG_SAMPLES || this.coveredUntilSample < oldestSafe - STEP_SAMPLES) {
                console.warn(`[AI STT] Whisper fell ${Math.round((head - this.coveredUntilSample) / SAMPLE_RATE)}s behind - jumping to live audio (words in the gap are lost)`)
                this.coveredUntilSample = head - STEP_SAMPLES
                this.lastEmittedEndMs = Math.round((this.coveredUntilSample / SAMPLE_RATE) * 1000)
                this.lastEmittedTailWords = []
            }

            if (head - this.coveredUntilSample < STEP_SAMPLES) return

            const windowStart = Math.max(0, oldestSafe, this.coveredUntilSample - Math.round((OVERLAP_BACKTRACK_MS / 1000) * SAMPLE_RATE))
            let windowEnd = Math.min(head, windowStart + MAX_WINDOW_SAMPLES)

            // a silent fresh region needs no decode - cover it and look again
            const freshRegion = this.readRange(this.coveredUntilSample, windowEnd)
            if (computeRms(freshRegion) < SILENCE_RMS_THRESHOLD) {
                this.coveredUntilSample = windowEnd
                continue
            }

            // snap the end to a quiet dip so the boundary cuts nothing - most preaching pauses land here
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
            // coverage does NOT advance on a failure: the same audio re-decodes in a grown window
            // once the engine recovers (the lag jump above bounds how far that can stack up).
            // failures while the server is respawning are expected - don't count them
            if (!this.serverRespawning) {
                this.consecutiveFailures++
                if (this.consecutiveFailures >= 2) this.options.onError(message)
            }
        } finally {
            this.processing = false
            if (!this.stopped) this.scheduleWindow() // fresh audio may already be waiting
        }
    }

    // WORD-LEVEL EMISSION - drop already-emitted words by timestamp, hold back the unsettled tail

    private emitWindow(parsed: WhisperSegment[], window: PcmWindow, windowStartMs: number, windowDurationMs: number) {
        const prompt = this.options.prompt

        // segment-level filters. Music stays (shown faded, never fed to detection) - it only flags
        const speech = parsed.filter((segment) => !isNoiseSegment(segment.text) && !isLowConfidence(segment))
        const music = speech.some((segment) => isMusicSegment(segment.text))
        const language = speech.find((segment) => segment.language)?.language

        // flatten to absolute-time words (token timing when available, even spacing as fallback)
        const words: WhisperWord[] = []
        for (const segment of speech) {
            for (const word of segment.words?.length ? segment.words : evenlySpacedWords(segment)) {
                words.push({ text: word.text, startMs: windowStartMs + word.startMs, endMs: windowStartMs + word.endMs })
            }
        }

        // drop words whose midpoint was already emitted (the window reaches back over the seam).
        // Whisper timestamps jitter between decodes, so the cutoff keeps a backtrack of grace -
        // a borderline word re-emits and the fuzzy seam stitch removes it, while a sharp cutoff
        // would LOSE the word whenever its re-decode timestamp drifted a little earlier
        const fresh = words.filter((word) => (word.startMs + word.endMs) / 2 >= this.lastEmittedEndMs - OVERLAP_BACKTRACK_MS)

        // hold back words ending near a non-silent cut - the cut may sit mid-word, and the next
        // window re-decodes that audio whole. Held words stream as interim (greyed) text
        const windowEndMs = windowStartMs + windowDurationMs
        const cutoffMs = window.endsInSilence ? Infinity : windowEndMs - HOLDBACK_MS
        const emitted = fresh.filter((word) => word.endMs <= cutoffMs)
        const withheld = fresh.filter((word) => word.endMs > cutoffMs)
        this.options.onInterim?.(withheld.map((word) => word.text).join(" "))

        // coverage: everything before the first withheld word is resolved; at least 1s of progress
        // per decode so a pathological long word can never stall the pipeline
        const coverEndMs = withheld.length ? Math.min(cutoffMs, withheld[0].startMs) : Math.min(windowEndMs, cutoffMs)
        const previousCovered = this.coveredUntilSample
        const coverSample = window.startSample + Math.round(((coverEndMs - windowStartMs) / 1000) * SAMPLE_RATE)
        this.coveredUntilSample = Math.max(previousCovered + SAMPLE_RATE, Math.min(coverSample, window.startSample + window.samples.length))

        if (!emitted.length) return

        // window-level guards on the joined text (server word-segments are too short to judge alone)
        const joined = emitted
            .map((word) => word.text)
            .join(" ")
            .trim()
        if (!joined || isRepetitionLoop(joined) || (prompt && isPromptEcho(joined, prompt))) return

        // timings shift between decodes, so a seam word can survive the timestamp drop - the fuzzy
        // stitch removes repeats and re-transcription variants
        const text = trimRepeatedLeadWords(this.lastEmittedTailWords, joined)
        if (!text) return

        // the loop failure also repeats whole lines across windows - an exact repeat is never speech
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
                console.warn(`[AI STT] Whisper decoded ${windowDurationMs}ms of audio in ${decodeMs}ms - the transcript will lag on this machine/model`)
            }
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

            // -nf: temperature fallback re-decodes uncertain (usually quiet) audio at higher temperatures,
            // which is where whisper invents text - live captioning is better off skipping than guessing.
            // -ojf: full JSON with per-token probabilities & offsets - word timing for the seam drop,
            // and a computable avg-logprob so the confidence gate works on this path
            const args = ["-m", this.options.modelPath, "-l", language, "-f", wavPath, "-ojf", "-of", outBase, "-np", "-t", WHISPER_THREADS, "-nf"]
            if (this.options.prompt) args.push("--prompt", this.options.prompt)
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
        console.error(`[AI STT] Whisper server exited unexpectedly with code ${code}, respawning...`)
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
        // verbose: per-segment timestamps make the overlap drop exact; word-level segments
        // (max_len=1 + split_on_word) give each word its own timing & confidence. An older server
        // that ignores the fields returns multi-word segments - the even-spacing fallback covers it
        form.append("response_format", "verbose_json")
        form.append("max_len", "1")
        form.append("split_on_word", "true")
        // each request is a fresh window - never let text from the previous one condition this decode
        form.append("no_context", "true")
        form.append("temperature", "0.0")
        // no temperature fallback: re-decoding uncertain (usually quiet) audio at higher temperatures
        // is where whisper invents text - live captioning is better off skipping than guessing
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

/**
 * Offset (in samples) of the center of the quietest sub-STEP frame inside the trailing
 * `searchSamples` of the window, or null when no frame is quiet enough to count as a dip.
 * A window end snapped there cuts between words, never through one.
 */
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

/** Fallback word timing for segments without token offsets: spread words evenly across the segment. */
export function evenlySpacedWords(segment: { text: string; startMs: number; endMs: number }): WhisperWord[] {
    const words = segment.text.split(/\s+/).filter(Boolean)
    if (!words.length) return []

    const duration = Math.max(0, segment.endMs - segment.startMs)
    const per = duration / words.length
    return words.map((text, i) => ({ text, startMs: Math.round(segment.startMs + i * per), endMs: Math.round(segment.startMs + (i + 1) * per) }))
}

// in-memory WAV: 44 byte header + Int16 LE PCM data (16kHz mono 16-bit)
export function buildWavBuffer(samples: Int16Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
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
export function computeRms(samples: Int16Array): number {
    if (!samples.length) return 0

    let sum = 0
    for (let i = 0; i < samples.length; i++) {
        const normalized = samples[i] / 32768
        sum += normalized * normalized
    }
    return Math.sqrt(sum / samples.length)
}

// whisper likes to label non-speech audio, e.g. "[BLANK_AUDIO]", "(music)", "[Music]", "*applause*", "♪"
export function isNoiseSegment(text: string): boolean {
    const leftover = text.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, "").replace(/[♪♫\s.,!?\-–—_]+/g, "")
    return leftover === ""
}

// whisper wraps sung content in ♪...♪ - and reliably HALLUCINATES lyrics for music it does not know,
// so music segments are shown in the transcript but must never feed scripture detection
export function isMusicSegment(text: string): boolean {
    return /[♪♫]/.test(text)
}

// whisper's repetition-loop failure: on laughter/breath/noise the decoder locks into a cycle
// ("heh, heh, heh, heh...") - real speech never has one token carrying most of a segment
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

/** Case/punctuation-blind segment identity - the loop also repeats whole lines across windows. */
export function segmentRepeatKey(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
}

// interpretation mode: a "-l auto" guess outside the declared spoken languages warrants a forced re-check.
// an unset/unresolved detection never re-runs, and an empty declaration means "no constraint"
export function shouldRerunWindow(detected: string | undefined, declared: string[] | undefined): boolean {
    const language = (detected || "").trim().toLowerCase()
    if (!language || language === "auto") return false
    if (!declared?.length) return false
    return !declared.some((code) => code.trim().toLowerCase() === language)
}

// drop segments whisper itself is unsure about - only where the JSON provides the values
export function isLowConfidence(segment: { noSpeechProb?: number; avgLogprob?: number }): boolean {
    if (typeof segment.noSpeechProb === "number" && segment.noSpeechProb > NO_SPEECH_PROB_MAX) return true
    if (typeof segment.avgLogprob === "number" && segment.avgLogprob < AVG_LOGPROB_MIN) return true
    return false
}

// tolerant parser for the different whisper.cpp JSON shapes:
// - cli -ojf: { result: { language }, transcription: [{ text, offsets, tokens: [{ text, p, offsets }] }] } (ms offsets)
// - server response_format=json: { text } (no timestamps - spans the whole window)
// - verbose/OpenAI style: { segments: [{ text, start, end, no_speech_prob, avg_logprob }] } (seconds)
export function parseWhisperJson(json: any, windowDurationMs: number): WhisperSegment[] {
    if (!json || typeof json !== "object") return []
    const segments: WhisperSegment[] = []

    // overall detected language of the window (cli) - "auto" would mean whisper never resolved it
    let language = typeof json.result?.language === "string" ? json.result.language.trim().toLowerCase() : undefined
    if (language === "auto" || language === "") language = undefined

    // whisper sometimes hallucinates timestamps far past the audio it was given - a single
    // runaway end time would poison the overlap dedupe for the whole session, so every
    // offset is clamped to the window it came from
    const clamp = (ms: number) => Math.max(0, Math.min(ms, windowDurationMs))

    if (Array.isArray(json.transcription)) {
        for (const entry of json.transcription) {
            if (!entry || typeof entry.text !== "string") continue
            const from = Number(entry.offsets?.from)
            const to = Number(entry.offsets?.to)
            const tokens = parseSegmentTokens(entry.tokens, clamp)
            segments.push({
                text: entry.text,
                startMs: isFinite(from) ? clamp(from) : 0,
                endMs: isFinite(to) ? clamp(to) : windowDurationMs,
                noSpeechProb: asNumber(entry.no_speech_prob),
                // -ojf carries no avg_logprob - compute it from the token probabilities, which is
                // what finally arms the confidence gate on the cli path
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
                startMs: isFinite(start) ? clamp(Math.round(start * 1000)) : 0,
                endMs: isFinite(end) ? clamp(Math.round(end * 1000)) : windowDurationMs,
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

// fold a cli -ojf token stream into words: whisper marks a word start with a leading space on the
// token, special markers ("[_BEG_]", timestamps) are skipped, and the mean log-probability over
// the real tokens stands in for the missing avg_logprob
function parseSegmentTokens(tokens: any, clamp: (ms: number) => number): { words: WhisperWord[]; avgLogprob?: number } | null {
    if (!Array.isArray(tokens) || !tokens.length) return null

    const words: WhisperWord[] = []
    let logprobSum = 0
    let logprobCount = 0

    for (const token of tokens) {
        if (!token || typeof token.text !== "string") continue
        if (/^\s*\[_[A-Z_]+_\]\s*$/.test(token.text)) continue // special markers carry no speech

        const from = Number(token.offsets?.from)
        const to = Number(token.offsets?.to)
        const p = asNumber(token.p)
        if (p !== undefined && p > 0) {
            logprobSum += Math.log(p)
            logprobCount++
        }

        const startsWord = /^\s/.test(token.text) || !words.length
        const text = token.text.trim()
        const startMs = isFinite(from) ? clamp(from) : 0
        const endMs = isFinite(to) ? clamp(to) : startMs

        if (startsWord) {
            if (text) words.push({ text, startMs, endMs })
            continue
        }
        const last = words[words.length - 1]
        if (last) {
            last.text += text
            if (endMs > last.endMs) last.endMs = endMs
        } else if (text) words.push({ text, startMs, endMs })
    }

    if (!words.length) return null
    return { words, avgLogprob: logprobCount ? logprobSum / logprobCount : undefined }
}

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
