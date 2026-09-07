import path from "path"
import type { DriverCallbacks, TranscriberSegment, TranscriptionDriver } from "../sttHelper"
import { findRepeatedTail, isMusicAnnotation, segmentConfidence } from "../sttHelper"

const NEMOTRON_FILES = {
    encoder: "encoder.int8.onnx",
    decoder: "decoder.int8.onnx",
    joiner: "joiner.int8.onnx",
    tokens: "tokens.txt",
    vad: "silero_vad.onnx"
} as const

export type NemotronWorkerRequest = { type: "start"; language?: string; decodeLanguage?: string; modelDir?: string } | { type: "audio"; data: Uint8Array } | { type: "stop" }
export type NemotronWorkerResponse = { type: "ready" } | { type: "segment"; segment: TranscriberSegment } | { type: "interim"; text: string } | { type: "error"; message: string } | { type: "stopped" } | { type: "alive" }

const SAMPLE_RATE = 16000

// the export's encoder grid: one step per 1120ms of audio, 12.5 decoder frames per second
const CHUNK_SHIFT_MS = 1120
const FRAMES_PER_SECOND = 12.5
// silence pushed at stop() so the audio after the last encoder step is still decoded
const FLUSH_SAMPLES = Math.ceil(((CHUNK_SHIFT_MS + 100) / 1000) * SAMPLE_RATE)

const VAD_THRESHOLD = 0.3
const VAD_MIN_SILENCE = 0.8
const VAD_MIN_SPEECH = 0.15
const VAD_MAX_SPEECH = 30
const MAX_UTTERANCE_SAMPLES = VAD_MAX_SPEECH * SAMPLE_RATE

// decoder frames with no token: after the first the trailing word is settled, after the second the speaker is done
const COMMIT_TRAILING_BLANKS = Math.round(VAD_MIN_SILENCE * FRAMES_PER_SECOND)
const CLOSE_TRAILING_BLANKS = Math.round(2.5 * FRAMES_PER_SECOND)

interface Hypothesis {
    text: string
    tokens: string[]
    logProbs: number[]
    blanks: number
}

type NemotronOptions = DriverCallbacks & { language?: string; decodeLanguage?: string; modelDir?: string; sherpa?: any }

export class NemotronDriver implements TranscriptionDriver {
    private options: NemotronOptions
    private recognizer: any = null
    private vad: any = null
    // one stream for the whole session - its encoder cache is what keeps decoding cheap
    private stream: any = null

    private stopped = false
    private totalSamples = 0

    private inUtterance = false
    private blanksAtOpen = 0
    private utteranceStartSample = 0
    private emittedAtOpen = 0

    // emission is tracked in characters: the trailing word grows in place ("Ephes" -> "Ephesians")
    private emittedChars = 0
    private nextEmitStartMs = 0

    constructor(options: NemotronOptions) {
        this.options = options
    }

    async start(): Promise<void> {
        if (this.stopped) throw new Error("Driver already stopped")

        const sherpa = this.options.sherpa || require("sherpa-onnx-node")
        const { modelDir } = this.options
        if (!modelDir) throw new Error("Nemotron model files are missing")

        this.recognizer = new sherpa.OnlineRecognizer({
            featConfig: { sampleRate: SAMPLE_RATE, featureDim: 128 },
            modelConfig: {
                transducer: {
                    encoder: path.join(modelDir, NEMOTRON_FILES.encoder),
                    decoder: path.join(modelDir, NEMOTRON_FILES.decoder),
                    joiner: path.join(modelDir, NEMOTRON_FILES.joiner)
                },
                tokens: path.join(modelDir, NEMOTRON_FILES.tokens),
                numThreads: 2,
                provider: "cpu"
            },
            decodingMethod: "greedy_search",
            enableEndpoint: false
        })

        this.stream = this.recognizer.createStream()

        // trailing-blank counts and per-stream language both arrived in sherpa-onnx-node 1.13.7
        if (typeof this.stream.setOption !== "function") throw new Error("sherpa-onnx-node 1.13.7 or newer is required")
        if (this.options.decodeLanguage) this.stream.setOption("language", this.options.decodeLanguage)

        this.vad = new sherpa.Vad(
            {
                sileroVad: {
                    model: path.join(modelDir, NEMOTRON_FILES.vad),
                    threshold: VAD_THRESHOLD,
                    minSilenceDuration: VAD_MIN_SILENCE,
                    minSpeechDuration: VAD_MIN_SPEECH,
                    maxSpeechDuration: VAD_MAX_SPEECH,
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

        try {
            this.flushTail()
            if (this.inUtterance) this.closeUtterance(this.readHypothesis(), true)
        } catch (err) {
            console.error("[nemotron] Failed to flush the final utterance:", err)
        }

        this.recognizer = null
        this.vad = null
        this.stream = null
    }

    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !this.recognizer || !this.stream) return

        const samples = int16ToFloat32(buffer)
        if (!samples.length) return

        try {
            this.vad.acceptWaveform(samples)

            // every push reaches the recognizer, silence included, or the encoder cache goes stale
            this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
            while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)

            this.totalSamples += samples.length

            const hypothesis = this.readHypothesis()
            const pending = hypothesis.text.length > this.emittedChars

            while (!this.vad.isEmpty()) this.vad.pop()

            // the recognizer emitting tokens is speech too - a music bed can hold the VAD shut for tens of seconds
            if (!this.inUtterance && (this.vad.isDetected() || pending)) {
                this.inUtterance = true
                this.nextEmitStartMs = Math.max(this.nextEmitStartMs, this.currentMs())
                this.blanksAtOpen = hypothesis.blanks
                this.utteranceStartSample = this.totalSamples
                this.emittedAtOpen = this.emittedChars
            }
            if (!this.inUtterance) {
                // clear the predictor only in a silence the decoder itself has confirmed
                if (hypothesis.text && hypothesis.blanks >= CLOSE_TRAILING_BLANKS) this.resetDecoder()
                return
            }

            // an utterance that has produced nothing counts silence from its own open, not from before it
            const produced = pending || this.emittedChars > this.emittedAtOpen
            const settledBlanks = produced ? hypothesis.blanks : hypothesis.blanks - this.blanksAtOpen
            const overLong = this.totalSamples - this.utteranceStartSample >= MAX_UTTERANCE_SAMPLES && hypothesis.blanks >= 1

            if (settledBlanks >= CLOSE_TRAILING_BLANKS || overLong) this.closeUtterance(hypothesis, produced, overLong)
            else this.emitFromHypothesis(hypothesis, settledBlanks >= COMMIT_TRAILING_BLANKS ? "settled" : "growing")
        } catch (err) {
            this.options.onError(String((err as Error)?.message || err))
        }
    }

    private currentMs(): number {
        return Math.round((this.totalSamples / SAMPLE_RATE) * 1000)
    }

    private readHypothesis(): Hypothesis {
        const result = this.recognizer.getResult(this.stream)
        return {
            text: ((result.text || "") as string).trim(),
            tokens: (result.tokens || []) as string[],
            logProbs: (result.ys_probs || []) as number[],
            blanks: (result.num_trailing_blanks || 0) as number
        }
    }

    private flushTail() {
        if (!this.recognizer || !this.stream) return
        this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: new Float32Array(FLUSH_SAMPLES) })
        while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)
    }

    private emitFromHypothesis(hypothesis: Hypothesis, mode: "growing" | "settled" | "closed") {
        const final = mode !== "growing"
        const text = hypothesis.text
        if (!text) {
            if (!final) this.options.onInterim?.("")
            return
        }

        // a greedy RNN-T can lock into a cycle; only clearing the decoder breaks it
        const loopAt = findRepeatedTail(text)
        if (loopAt >= 0) {
            const keep = text.slice(0, loopAt).trimEnd()
            if (keep.length > this.emittedChars) {
                const candidate = keep.slice(this.emittedChars).trim()
                const confidence = segmentConfidence(hypothesis.tokens, hypothesis.logProbs, text, this.emittedChars, keep.length)
                this.emittedChars = keep.length
                if (candidate) this.emitText(candidate, false, confidence)
            }
            console.warn(`[nemotron] decoder was repeating ${JSON.stringify(text.slice(loopAt).slice(0, 60))} - clearing its state`)
            this.resetDecoder()
            this.options.onInterim?.("")
            return
        }

        // only whole words are committed while the decoder is still writing: the trailing token
        // grows in place, and committing it early puts "cha" on screen for "chapter"
        const commitTo = final ? text.length : text.lastIndexOf(" ")

        let candidate = ""
        let confidence: number | undefined
        if (commitTo > this.emittedChars) {
            candidate = text.slice(this.emittedChars, commitTo).trim()
            if (candidate) confidence = segmentConfidence(hypothesis.tokens, hypothesis.logProbs, text, this.emittedChars, commitTo)
            this.emittedChars = commitTo
        }

        // an empty segment at close marks the utterance end
        if (candidate || (mode === "closed" && this.emittedChars > 0)) this.emitText(candidate, mode === "closed", confidence)

        this.options.onInterim?.(final ? "" : text.slice(this.emittedChars).trim())
    }

    private resetDecoder() {
        this.recognizer.reset(this.stream)
        this.emittedChars = 0
        this.blanksAtOpen = 0
    }

    private closeUtterance(hypothesis: Hypothesis, produced: boolean, forced = false) {
        if (produced) this.emitFromHypothesis(hypothesis, "closed")
        this.inUtterance = false
        // the length ceiling is the one close with no silence behind it, so it clears the predictor itself
        if (forced && hypothesis.text) this.resetDecoder()
    }

    private emitText(text: string, utteranceEnd: boolean, confidence?: number) {
        const endMs = this.currentMs()
        const segment: TranscriberSegment = { text, startMs: this.nextEmitStartMs, endMs }
        if (confidence !== undefined) segment.confidence = confidence
        if (isMusicAnnotation(text)) segment.music = true
        if (utteranceEnd) segment.utteranceEnd = true
        if (this.options.language) segment.language = this.options.language
        this.nextEmitStartMs = endMs

        this.options.onSegment(segment)
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
                    decodeLanguage: message.decodeLanguage,
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
