import path from "path"
import type { DriverCallbacks, TranscriberSegment, TranscriptionDriver } from "../sttHelper"
import { appendTailWords, trimRepeatedLeadWords } from "../sttHelper"

const NEMOTRON_FILES = {
    encoder: "encoder.int8.onnx",
    decoder: "decoder.int8.onnx",
    joiner: "joiner.int8.onnx",
    tokens: "tokens.txt",
    vad: "silero_vad.onnx"
} as const

export type NemotronWorkerRequest = { type: "start"; language?: string; modelDir?: string } | { type: "audio"; data: Uint8Array } | { type: "stop" }
export type NemotronWorkerResponse = { type: "ready" } | { type: "segment"; segment: TranscriberSegment } | { type: "interim"; text: string } | { type: "error"; message: string } | { type: "stopped" } | { type: "alive" }

const SAMPLE_RATE = 16000
const PREROLL_MAX_SAMPLES = 16000
const FINALIZE_PAD_SAMPLES = 16000
const CLOSE_DEFER_SAMPLES = 8000
const MAX_UTTERANCE_SAMPLES = 17 * SAMPLE_RATE
const INTERIM_EMIT_INTERVAL_SAMPLES = Math.round(SAMPLE_RATE * 0.25)

export class NemotronDriver implements TranscriptionDriver {
    private options: DriverCallbacks & { language?: string; sherpa?: any; modelDir?: string }
    private recognizer: any = null
    private vad: any = null

    private stream: any = null

    private stopped = false
    private totalSamples = 0
    private inUtterance = false
    private finalizeAtSample = 0

    private utteranceSamples = 0
    private preroll: Float32Array[] = []
    private prerollSamples = 0

    private emittedWords = 0
    private emittedTailWords: string[] = []
    private nextEmitStartMs = 0
    private lastInterimEmitSample = 0
    private lastInterimText = ""

    constructor(options: DriverCallbacks & { language?: string; sherpa?: any; modelDir?: string }) {
        this.options = options
    }

    async start(): Promise<void> {
        if (this.stopped) throw new Error("Driver already stopped")

        const sherpa = this.options.sherpa || require("sherpa-onnx-node")
        const { modelDir } = this.options
        if (!modelDir) throw new Error("Nemotron model files are missing")

        const paths = {
            encoder: path.join(modelDir, NEMOTRON_FILES.encoder),
            decoder: path.join(modelDir, NEMOTRON_FILES.decoder),
            joiner: path.join(modelDir, NEMOTRON_FILES.joiner),
            tokens: path.join(modelDir, NEMOTRON_FILES.tokens)
        }

        this.recognizer = new sherpa.OnlineRecognizer({
            featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
            modelConfig: { transducer: paths, tokens: paths.tokens, numThreads: 2, provider: "cpu" },
            decodingMethod: "greedy_search",
            enableEndpoint: false
        })

        this.vad = new sherpa.Vad(
            {
                sileroVad: {
                    model: path.join(modelDir, NEMOTRON_FILES.vad),
                    threshold: 0.3,
                    minSilenceDuration: 0.8,
                    minSpeechDuration: 0.15,
                    maxSpeechDuration: 12,
                    windowSize: 512
                },
                sampleRate: SAMPLE_RATE,
                numThreads: 1,
                provider: "cpu"
            },
            60
        )
    }

    async stop(): Promise<void> {
        if (this.stopped) return
        this.stopped = true

        if (this.inUtterance) this.finalizeUtterance()
        this.stream = null
        this.recognizer = null
        this.vad = null
        this.preroll = []
    }

    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !this.recognizer) return

        const samples = int16ToFloat32(buffer)
        if (!samples.length) return

        try {
            this.vad.acceptWaveform(samples)

            if (this.vad.isDetected()) {
                if (!this.inUtterance) {
                    this.inUtterance = true
                    this.stream = this.recognizer.createStream()
                    this.utteranceSamples = 0

                    // Feed preroll buffer into the new stream
                    for (const preChunk of this.preroll) {
                        this.feedAudioToStream(preChunk)
                        this.utteranceSamples += preChunk.length
                    }
                    this.preroll = []
                    this.prerollSamples = 0
                }
                this.finalizeAtSample = 0
            }

            if (this.inUtterance) {
                this.feedAudioToStream(samples)
                this.utteranceSamples += samples.length

                if (this.utteranceSamples >= MAX_UTTERANCE_SAMPLES && !this.finalizeAtSample) {
                    this.finalizeAtSample = this.totalSamples + samples.length
                }
            } else {
                this.bufferPreroll(samples)
            }

            this.totalSamples += samples.length

            while (!this.vad.isEmpty()) {
                this.vad.pop()
                if (this.inUtterance) this.finalizeAtSample = this.totalSamples + CLOSE_DEFER_SAMPLES
            }

            if (this.inUtterance) this.maybeEmitInterim(false)

            if (this.finalizeAtSample && this.totalSamples >= this.finalizeAtSample) {
                this.finalizeAtSample = 0
                this.inUtterance = false
                this.finalizeUtterance()
            }
        } catch (err) {
            this.options.onError(String((err as Error)?.message || err))
        }
    }

    private feedAudioToStream(samples: Float32Array) {
        if (!this.stream || !this.recognizer) return
        this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
        while (this.recognizer.isReady(this.stream)) {
            this.recognizer.decode(this.stream)
        }
    }

    private finalizeUtterance() {
        if (this.stream && this.recognizer) {
            // Feed a short tail pad to flush remaining tokens in the transducer
            const pad = new Float32Array(FINALIZE_PAD_SAMPLES)
            this.feedAudioToStream(pad)
        }

        const text = (this.stream && this.recognizer ? this.recognizer.getResult(this.stream)?.text || "" : "").trim()
        this.stream = null
        this.utteranceSamples = 0

        const words = text ? text.split(/\s+/) : []
        const candidate = words.slice(Math.max(0, this.emittedWords - 2)).join(" ")
        const trimmed = trimRepeatedLeadWords(this.emittedTailWords, candidate)

        if (trimmed) this.emitText(trimmed, true)
        this.lastInterimText = ""
        this.lastInterimEmitSample = this.totalSamples
        this.options.onInterim?.("")
        this.emittedWords = 0
    }

    private maybeEmitInterim(force: boolean) {
        if (!this.options.onInterim || !this.stream || !this.recognizer) return
        if (!force && this.totalSamples - this.lastInterimEmitSample < INTERIM_EMIT_INTERVAL_SAMPLES) return

        const text = (this.recognizer.getResult(this.stream)?.text || "").trim()
        const words = text ? text.split(/\s+/) : []
        const candidate = words.slice(Math.max(0, this.emittedWords - 2)).join(" ")
        const interim = trimRepeatedLeadWords(this.emittedTailWords, candidate)

        this.lastInterimEmitSample = this.totalSamples
        if (interim === this.lastInterimText) return

        this.lastInterimText = interim
        this.options.onInterim(interim)
    }

    private emitText(text: string, utteranceEnd = false) {
        if (!text) return

        const endMs = Math.round((this.totalSamples / SAMPLE_RATE) * 1000)
        const segment: TranscriberSegment = {
            text,
            startMs: this.nextEmitStartMs,
            endMs,
            ...(utteranceEnd && { utteranceEnd: true }),
            ...(this.options.language && { language: this.options.language })
        }

        this.nextEmitStartMs = endMs
        this.emittedTailWords = appendTailWords(this.emittedTailWords, text)
        this.options.onSegment(segment)
    }

    private bufferPreroll(samples: Float32Array) {
        this.preroll.push(samples)
        this.prerollSamples += samples.length
        while (this.prerollSamples - (this.preroll[0]?.length || 0) >= PREROLL_MAX_SAMPLES) {
            this.prerollSamples -= this.preroll.shift()!.length
        }
    }
}

export function int16ToFloat32(buffer: Uint8Array): Float32Array {
    const count = Math.floor(buffer.byteLength / 2)
    const samples = new Float32Array(count)
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    for (let i = 0; i < count; i++) {
        samples[i] = view.getInt16(i * 2, true) / 32768
    }
    return samples
}

// IPC Utility Process Worker Entrypoint
const parentPort = (process as any).parentPort

if (parentPort) {
    let driver: NemotronDriver | null = null
    const post = (msg: NemotronWorkerResponse) => parentPort.postMessage(msg)

    setInterval(() => post({ type: "alive" }), 5000).unref?.()

    parentPort.on("message", async (event: { data: NemotronWorkerRequest }) => {
        const message = event.data
        try {
            if (message.type === "start") {
                driver = new NemotronDriver({
                    language: message.language,
                    modelDir: message.modelDir,
                    onSegment: (segment) => post({ type: "segment", segment }),
                    onInterim: (text) => post({ type: "interim", text }),
                    onError: (message) => post({ type: "error", message })
                })
                await driver.start()
                post({ type: "ready" })
            } else if (message.type === "audio") {
                driver?.pushAudio(message.data)
            } else if (message.type === "stop") {
                await driver?.stop()
                driver = null
                post({ type: "stopped" })
            }
        } catch (err) {
            post({ type: "error", message: String((err as Error)?.message || err) })
        }
    })
}
