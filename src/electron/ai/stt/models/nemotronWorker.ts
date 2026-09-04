// AI STT - streaming transcription over sherpa-onnx (NVIDIA Nemotron)
// Receives Int16 LE PCM @ 16kHz mono from the renderer (IPC). Silero VAD finds utterance
// boundaries, and each closed utterance is decoded in ONE batch on a fresh recognizer
// stream - a spoken phrase is out roughly a second after the speaker stops, instead of
// on a fixed window boundary.
//
// Two details are load bearing and were found the hard way (live services + measured
// against every feed pattern the binding supports):
//
// 1. Utterance boundaries come from Silero VAD, not from the recognizer's own
//    endpointing. Energy gates fail in rooms with constant background noise, where
//    speech sits only a few dB above the ambient level.
// 2. Each utterance is decoded with ONE acceptWaveform call on a FRESH stream, framed by
//    a fixed pre-roll and a trailing pad. Live sessions showed short utterances ("next
//    verse") intermittently decoding to nothing; AlloDel's controlled measurement (30
//    chunked-vs-batch runs on synthetic audio, byte-identical output) later showed the
//    decoder is NOT sensitive to how samples are fed but IS sensitive to the silence in
//    front of them - the same clip decodes with 0s or 1s of leading silence and returns
//    empty with 0.5s, pointing at frame alignment/encoder warm-up. The batch call plus the
//    fixed PREROLL/FINALIZE pads remove that variance either way, and match how sherpa's
//    own VAD-segmented examples drive their recognizers.
//
// Long continuous speech does NOT wait for the VAD boundary: while an utterance is open,
// the audio so far is periodically re-decoded (still one batch on a fresh stream), and the
// words two consecutive decodes agree on are emitted immediately. The unstable tail is held
// back until it stabilizes or the utterance closes - so text streams out while the speaker
// is mid-sentence, and nothing already emitted is ever retracted.

import type { DriverCallbacks, TranscriberSegment, TranscriptionDriver } from "../sttHelper"
import { appendTailWords, trimRepeatedLeadWords } from "../sttHelper"
import path from "path"
import { LocalModelManager } from "../../setup/LocalModelManager"
import { NEMOTRON_MODEL_FILES, NEMOTRON_VAD_FILE } from "../../setup/models/nemotron"

// Worker message protocol - defined here so worker.ts can import them without a circular dependency
export type NemotronWorkerRequest = { type: "start"; language?: string } | { type: "audio"; data: Uint8Array } | { type: "stop" }
export type NemotronWorkerResponse = { type: "ready" } | { type: "segment"; segment: TranscriberSegment } | { type: "interim"; text: string } | { type: "error"; message: string } | { type: "stopped" } | { type: "alive" }

const SAMPLE_RATE = 16000

// utterance boundary tuning. A trailing word softened by the OS noise suppression can drop below the VAD's
// speech threshold, and then the silence countdown runs DURING the word - the utterance closes mid-word and
// the word's tail never reaches the decoder. A lower threshold keeps quiet word endings counted as speech,
// and a slightly longer silence window keeps a soft tail from starting the countdown early.
const VAD_THRESHOLD = 0.3
// VAD closes an utterance after this much trailing silence
const VAD_MIN_SILENCE = 0.8
// low enough that a short soft word after a pause ("...verse" trailing a command) still counts as speech
const VAD_MIN_SPEECH = 0.15
// force a boundary during continuous speech - partial decodes stream the text out along the way,
// this cap mostly bounds how much audio a single (synchronous) batch decode can ever cover
const VAD_MAX_SPEECH = 12

// partial decodes: how much new audio accumulates before the open utterance is re-decoded.
// 1.2s: with soft splits capping utterance length the re-decodes stay cheap, and the backoff
// below still doubles the interval on machines where they run slow
const PARTIAL_INTERVAL_SAMPLES = 1.2 * SAMPLE_RATE
// a re-decode can merge/split words, shifting positions - re-cover this many already emitted words
// across every decode seam and let the seam stitch drop the ones that really did come out already
const SEAM_BACKTRACK_WORDS = 2
// a partial decode slower than this means the utterance has grown heavy for this machine - back the
// re-decode interval off (doubling, capped) instead of going quiet until the close. The cap is
// deep on purpose: a machine drowning in decode work must be able to fall back to near-finalize-only
// pacing, or the worker's queue grows without bound and the transcript freezes
const PARTIAL_SLOW_DECODE_MS = 1000
const PARTIAL_BACKOFF_MAX = 8

// audio kept from just before the VAD triggers - long enough that the batch has lead-in for the encoder to
// warm up on before the first word, or the utterance's opening syllables decode garbled
const PREROLL_MAX_SAMPLES = 16000
// trailing silence appended to each batch, so the decoder flushes the last word's tokens
const FINALIZE_PAD_SAMPLES = 16000
// real audio captured after the VAD closes before the batch is decoded. A soft last word makes the silence
// countdown run DURING the word, so the close can land mid-word - this keeps the word's tail in the batch.
// If speech resumes inside this window the utterance just continues (it was a pause, not an end).
const CLOSE_DEFER_SAMPLES = 8000
// audio re-heard at the start of the next utterance when a boundary was forced mid-speech (the VAD's
// max-speech cap / the buffer cap) - the sliced word decodes whole the second time & the seam stitch
// drops the half that already came out
const SPLIT_OVERLAP_SAMPLES = 16000
// hard cap on buffered utterance audio (the VAD forces a boundary well before this)
const MAX_UTTERANCE_SAMPLES = (VAD_MAX_SPEECH + 5) * SAMPLE_RATE
// long continuous speech: past this length, split at the next between-words dip instead of riding
// to the hard cap - the boundary lands in near-silence (nothing to slice), the batch stays shorter
// (the quantized decoder merges fast repeated words on very long sequences: "churchurch"), and the
// finalize decode returns sooner. The dip is one quiet 100ms chunk - far shorter than the 0.8s of
// silence the VAD needs to close on its own
const SOFT_SPLIT_SAMPLES = 9 * SAMPLE_RATE
const SOFT_SPLIT_RMS = 0.015

interface NemotronOptions extends DriverCallbacks {
    /** Reported on every segment - Nemotron is English only, kept for the segment shape. */
    language?: string
    /** Injected by tests. Production loads the native addon lazily in start(). */
    sherpa?: any
}

export class NemotronDriver implements TranscriptionDriver {
    private options: NemotronOptions

    private recognizer: any = null
    private vad: any = null

    private stopped = false
    private totalSamples = 0
    private utteranceStartSample = 0

    // audio of the utterance currently being spoken (starts with the pre-roll)
    private utterance: Float32Array[] = []
    private utteranceSamples = 0
    private inUtterance = false
    // set when the VAD closed - the decode waits for CLOSE_DEFER_SAMPLES of real tail audio first
    private finalizeAtSample = 0

    // why the pending finalize was armed: "hard" = the buffer cap sliced mid-speech (the last
    // word may be cut), "soft" = a between-words dip (the last word is complete), null = a real
    // VAD pause
    private pendingSplitKind: "hard" | "soft" | null = null

    // partial decode state for the open utterance
    private nextPartialAtSamples = 0
    private partialBackoff = 1 // interval multiplier, doubled while decodes run slow on this machine
    private lastPartialWords: string[] = []
    private emittedWords = 0 // words of the open utterance already emitted
    private emittedTailWords: string[] = [] // what those words actually were, for the seam stitch
    private nextEmitStartMs = 0

    private preroll: Float32Array[] = []
    private prerollSamples = 0

    constructor(options: NemotronOptions) {
        this.options = options
    }

    async start(): Promise<void> {
        if (this.stopped) throw new Error("NemotronDriver has already been stopped")

        // required lazily so the app still starts on a platform where the native addon fails to load
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sherpa = this.options.sherpa || require("sherpa-onnx-node")
        // build runtime paths for the Nemotron model files from the model dir
        const modelDir = LocalModelManager.getModelDir("nemotron")
        const paths = modelDir
            ? {
                  encoder: path.join(modelDir, NEMOTRON_MODEL_FILES.encoder.file),
                  decoder: path.join(modelDir, NEMOTRON_MODEL_FILES.decoder.file),
                  joiner: path.join(modelDir, NEMOTRON_MODEL_FILES.joiner.file),
                  tokens: path.join(modelDir, NEMOTRON_MODEL_FILES.tokens.file)
              }
            : null
        const vadModelPath = modelDir ? path.join(modelDir, NEMOTRON_VAD_FILE) : null

        if (!paths || !vadModelPath) throw new Error("Nemotron model files are missing")

        this.recognizer = new sherpa.OnlineRecognizer({
            featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
            modelConfig: {
                transducer: { encoder: paths.encoder, decoder: paths.decoder, joiner: paths.joiner },
                tokens: paths.tokens,
                numThreads: 2,
                provider: "cpu",
                debug: 0
            },
            // greedy also rules out sherpa's hotword biasing (domain-specific hotwords), which
            // needs modified_beam_search plus a bpe.model to tokenize the hotword list - and the
            // pinned model revision ships no bpe.model (only encoder/decoder/joiner + tokens.txt).
            // Pre-tokenizing hotwords against tokens.txt would be fragile, and beam search decodes
            // materially slower than the partial-decode budget here assumes. Misheard domain-specific
            // vocabulary is recovered downstream by the frontend's phonetic matcher where applicable.
            decodingMethod: "greedy_search",
            // boundaries come from the VAD - see the file header
            enableEndpoint: false
        })

        this.vad = new sherpa.Vad(
            {
                sileroVad: {
                    model: vadModelPath,
                    threshold: VAD_THRESHOLD,
                    minSilenceDuration: VAD_MIN_SILENCE,
                    minSpeechDuration: VAD_MIN_SPEECH,
                    maxSpeechDuration: VAD_MAX_SPEECH,
                    windowSize: 512
                },
                sampleRate: SAMPLE_RATE,
                numThreads: 1,
                provider: "cpu",
                debug: 0
            },
            60
        )
    }

    async stop(): Promise<void> {
        if (this.stopped) return
        this.stopped = true

        // flush whatever was still being spoken (or waiting out the defer window) so its text is not lost
        try {
            if (this.inUtterance) this.finalizeUtterance()
            this.finalizeAtSample = 0
        } catch (err) {
            console.error("[nemotron] Failed to flush the final utterance:", err)
        }

        this.recognizer = null
        this.vad = null
        this.utterance = []
        this.utteranceSamples = 0
        this.preroll = []
        this.prerollSamples = 0
    }

    pushAudio(buffer: Uint8Array): void {
        if (this.stopped || !this.recognizer) return

        const samples = int16ToFloat32(buffer)
        if (!samples.length) return

        try {
            this.vad.acceptWaveform(samples)

            if (this.vad.isDetected()) {
                if (!this.inUtterance) {
                    // the utterance starts with the audio captured just before the VAD fired, so the first word survives
                    this.inUtterance = true
                    this.utterance = this.preroll
                    this.utteranceSamples = this.prerollSamples
                    this.utteranceStartSample = Math.max(0, this.totalSamples - this.prerollSamples)
                    this.preroll = []
                    this.prerollSamples = 0

                    this.nextPartialAtSamples = this.utteranceSamples + PARTIAL_INTERVAL_SAMPLES
                    this.partialBackoff = 1
                    this.lastPartialWords = []
                    this.emittedWords = 0
                    // overlap seeded by a forced split starts before the last emit - times never go backwards
                    this.nextEmitStartMs = Math.max(this.nextEmitStartMs, Math.round((this.utteranceStartSample / SAMPLE_RATE) * 1000))
                }
                // speech resumed inside the defer window - it was a pause, the utterance continues
                this.finalizeAtSample = 0
                this.pendingSplitKind = null
            }

            if (this.inUtterance) {
                // always append - dropping the cap-crossing chunk would splice a 100ms hole exactly
                // where a word is mid-syllable, and both the finalize batch and the seeded overlap
                // would then decode spliced audio ("against afflictions" -> "againstictions")
                this.utterance.push(samples)
                this.utteranceSamples += samples.length
                if (this.utteranceSamples >= MAX_UTTERANCE_SAMPLES && !this.finalizeAtSample) {
                    // the VAD's own max-speech close gets cancelled while speech continues (the
                    // "speech resumed" branch above) - so the cap here IS the working boundary
                    // during long continuous speech; force the decode NOW
                    this.finalizeAtSample = this.totalSamples + samples.length
                    this.pendingSplitKind = "hard"
                } else if (this.utteranceSamples >= SOFT_SPLIT_SAMPLES && !this.finalizeAtSample && computeChunkRms(samples) < SOFT_SPLIT_RMS) {
                    // a between-words dip - split here while the boundary is quiet
                    this.finalizeAtSample = this.totalSamples + samples.length
                    this.pendingSplitKind = "soft"
                }
            } else {
                this.bufferPreroll(samples)
            }

            this.totalSamples += samples.length

            // the VAD closed one or more utterances - arm the deferred decode
            let closed = false
            while (!this.vad.isEmpty()) {
                this.vad.pop()
                closed = true
            }
            if (closed && this.inUtterance) this.finalizeAtSample = this.totalSamples + CLOSE_DEFER_SAMPLES

            // stream the open utterance out early - unless the close is already pending (the full decode is imminent)
            if (this.inUtterance && !this.finalizeAtSample && this.utteranceSamples >= this.nextPartialAtSamples) {
                this.nextPartialAtSamples = this.utteranceSamples + PARTIAL_INTERVAL_SAMPLES * this.partialBackoff
                this.decodePartial()
            }

            if (this.finalizeAtSample && this.totalSamples >= this.finalizeAtSample) {
                this.finalizeAtSample = 0
                this.inUtterance = false
                const splitKind = this.pendingSplitKind
                this.pendingSplitKind = null
                this.finalizeUtterance(splitKind)
            }
        } catch (err) {
            this.options.onError(String((err as Error)?.message || err))
        }
    }

    // UTTERANCE HANDLING

    /** Decode the buffered utterance in one batch on a fresh stream - see the file header for why. */
    private decodeBatch(finalize: boolean): string {
        // partials skip the trailing pad: the unflushed last word is exactly the unstable tail being held back
        const batch = new Float32Array(this.utteranceSamples + (finalize ? FINALIZE_PAD_SAMPLES : 0))
        let offset = 0
        for (const part of this.utterance) {
            batch.set(part, offset)
            offset += part.length
        }

        const stream = this.recognizer.createStream()
        stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: batch })
        while (this.recognizer.isReady(stream)) this.recognizer.decode(stream)
        return ((this.recognizer.getResult(stream).text || "") as string).trim()
    }

    /** Re-decode the open utterance & emit the words two consecutive decodes agree on. */
    private decodePartial() {
        const startedAt = Date.now()
        const text = this.decodeBatch(false)
        // the utterance has grown heavy for this machine: re-decode less often, but keep streaming
        if (Date.now() - startedAt > PARTIAL_SLOW_DECODE_MS) this.partialBackoff = Math.min(PARTIAL_BACKOFF_MAX, this.partialBackoff * 2)

        const words = text ? text.split(/\s+/) : []
        let agreed = 0
        while (agreed < words.length && agreed < this.lastPartialWords.length && words[agreed] === this.lastPartialWords[agreed]) agreed++
        this.lastPartialWords = words

        // emitted words are never retracted - a revision earlier in the text only holds further emission back
        if (agreed > this.emittedWords) {
            const candidate = words.slice(Math.max(0, this.emittedWords - SEAM_BACKTRACK_WORDS), agreed).join(" ")
            this.emittedWords = agreed
            this.emitText(trimRepeatedLeadWords(this.emittedTailWords, candidate))
        }

        // the unstable tail goes to the display only (shown greyed) - it may still change, so it
        // never reaches detection & the next decode replaces it wholesale
        this.options.onInterim?.(words.slice(this.emittedWords).join(" "))
    }

    private finalizeUtterance(splitKind: "hard" | "soft" | null = null) {
        const text = this.decodeBatch(true)

        // a mid-speech boundary seeds the next utterance with the tail audio, so anything the cut
        // touched is re-heard whole and the seam stitch drops what already came out
        if (splitKind) {
            this.preroll = tailOf(this.utterance, SPLIT_OVERLAP_SAMPLES)
            this.prerollSamples = this.preroll.reduce((sum, part) => sum + part.length, 0)
        }

        this.utterance = []
        this.utteranceSamples = 0

        // the final read delivers whatever follows the words already emitted by the partial decodes.
        // Only a HARD cap can slice its last word ("depl", "right") - that one is held back for the
        // overlap's re-decode. A soft split lands in a quiet dip, so its last word is complete and
        // holding it back would DROP a word the greyed interim already showed
        const words = text ? text.split(/\s+/) : []
        const wordsEnd = splitKind === "hard" ? Math.max(this.emittedWords, words.length - 1) : words.length
        const candidate = words.slice(Math.max(0, Math.min(this.emittedWords, wordsEnd) - SEAM_BACKTRACK_WORDS), wordsEnd).join(" ")
        const trimmed = trimRepeatedLeadWords(this.emittedTailWords, candidate)
        if (trimmed) this.emitText(trimmed, true)
        else if (this.emittedWords > 0) this.emitBoundary() // the boundary must reach the display even textless
        this.options.onInterim?.("")

        this.lastPartialWords = []
        this.emittedWords = 0
        this.partialBackoff = 1
    }

    private emitText(text: string, utteranceEnd = false) {
        if (!text) return

        const endMs = Math.round((this.totalSamples / SAMPLE_RATE) * 1000)
        const segment: TranscriberSegment = { text, startMs: this.nextEmitStartMs, endMs }
        if (utteranceEnd) segment.utteranceEnd = true
        this.nextEmitStartMs = endMs
        this.emittedTailWords = appendTailWords(this.emittedTailWords, text)

        if (this.options.language) segment.language = this.options.language
        this.options.onSegment(segment)
    }

    /** An utterance that ends with no new words still ends - the display closes its line on this marker. */
    private emitBoundary() {
        const endMs = Math.round((this.totalSamples / SAMPLE_RATE) * 1000)
        const segment: TranscriberSegment = { text: "", startMs: this.nextEmitStartMs, endMs, utteranceEnd: true }
        this.nextEmitStartMs = endMs
        if (this.options.language) segment.language = this.options.language
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

/** RMS of one audio chunk - cheap enough to run per 100ms message once an utterance grows long. */
function computeChunkRms(samples: Float32Array): number {
    if (!samples.length) return 0
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
    return Math.sqrt(sum / samples.length)
}

/** The last `maxSamples` of the buffered parts - the first kept part is cut with a subarray view. */
function tailOf(parts: Float32Array[], maxSamples: number): Float32Array[] {
    const tail: Float32Array[] = []
    let total = 0
    for (let i = parts.length - 1; i >= 0 && total < maxSamples; i--) {
        tail.unshift(parts[i])
        total += parts[i].length
    }
    if (total > maxSamples && tail.length) tail[0] = tail[0].subarray(total - maxSamples)
    return tail
}

/** Int16 LE PCM bytes (as sent over IPC) to the Float32 samples sherpa expects. */
function int16ToFloat32(buffer: Uint8Array): Float32Array {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const count = Math.floor(buffer.byteLength / 2)
    const samples = new Float32Array(count)
    for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 32768
    return samples
}

/**
 * Runs the Nemotron engine in an Electron utilityProcess, so its synchronous native decodes can
 * never freeze the app - audio goes out as messages, segments come back as messages. When the
 * worker cannot be spawned, decoding falls back in-process (the previous behavior).
 */

// AI STT - nemotron decode host (Electron utilityProcess entry)
// Runs the NemotronDriver in its own process, where its synchronous ONNX decodes are free to
// block: the app's main process only forwards audio and receives segments over the port, so a
// slow decode can never freeze the UI, IPC or the audio feed. A crash in the native addon takes
// down this process alone - the transcriber proxy surfaces it as an engine error.

// present only when this file runs as a utilityProcess entry (the type import above is free)
const parentPort = (process as NodeJS.Process & { parentPort?: { postMessage(message: unknown): void; on(event: "message", listener: (event: { data: NemotronWorkerRequest }) => void): void } }).parentPort

if (parentPort) {
    let driver: NemotronDriver | null = null
    const post = (message: NemotronWorkerResponse) => parentPort.postMessage(message)

    // liveness heartbeat: a decode that never returns (native hang) silences this too - which is
    // exactly what lets the host tell a hung worker from a merely quiet room and restart it
    setInterval(() => post({ type: "alive" }), 5000).unref?.()

    const handle = async (message: NemotronWorkerRequest) => {
        try {
            if (message.type === "start") {
                driver = new NemotronDriver({
                    language: message.language,
                    onSegment: (segment) => post({ type: "segment", segment }),
                    onInterim: (text) => post({ type: "interim", text }),
                    onError: (errorMessage) => post({ type: "error", message: errorMessage })
                })
                await driver.start()
                post({ type: "ready" })
            } else if (message.type === "audio") {
                driver?.pushAudio(message.data)
            } else if (message.type === "stop") {
                // stop() flushes the open utterance first, so its segment message precedes "stopped"
                await driver?.stop()
                driver = null
                post({ type: "stopped" })
            }
        } catch (err) {
            post({ type: "error", message: String((err as Error)?.message || err) })
        }
    }

    parentPort.on("message", (event) => void handle(event.data))
}
