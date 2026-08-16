// AI AUTO SCRIPTURE - streaming transcription over sherpa-onnx (NVIDIA Nemotron)
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
// 2. Each utterance is decoded with ONE acceptWaveform call on a FRESH stream.
//    Feeding the same audio in small chunks - fresh stream, reused stream or one
//    persistent stream - leaves the NeMo decoder intermittently deaf: short utterances
//    ("next verse") accept the audio and decode to nothing. Batch decoding the exact
//    same samples returns the full text every time, and matches how sherpa's own
//    VAD-segmented examples drive their recognizers.
//
// Long continuous speech does NOT wait for the VAD boundary: while an utterance is open,
// the audio so far is periodically re-decoded (still one batch on a fresh stream), and the
// words two consecutive decodes agree on are emitted immediately. The unstable tail is held
// back until it stabilizes or the utterance closes - so text streams out while the speaker
// is mid-sentence, and nothing already emitted is ever retracted.

import { appendTailWords, trimRepeatedLeadWords } from "../seam"
import type { DriverCallbacks, TranscriberSegment, TranscriptionDriver } from "../types"
import type { NemotronModelPaths } from "./manager"

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

// partial decodes: how much new audio accumulates before the open utterance is re-decoded
const PARTIAL_INTERVAL_SAMPLES = 1.6 * SAMPLE_RATE
// a re-decode can merge/split words, shifting positions - re-cover this many already emitted words
// across every decode seam and let the seam stitch drop the ones that really did come out already
const SEAM_BACKTRACK_WORDS = 2
// a partial decode slower than this means the utterance has grown heavy for this machine - back the
// re-decode interval off (doubling, capped) instead of going quiet until the close
const PARTIAL_SLOW_DECODE_MS = 1000
const PARTIAL_BACKOFF_MAX = 4

// audio kept from just before the VAD triggers - long enough that the batch has lead-in for the encoder to
// warm up on before the first word, or the utterance's opening syllables decode garbled
const PREROLL_MAX_SAMPLES = 16000
// trailing silence appended to each batch, so the decoder flushes the last word's tokens
const FINALIZE_PAD_SAMPLES = 16000
// real audio captured after the VAD closes before the batch is decoded. A soft last word makes the silence
// countdown run DURING the word, so the close can land mid-word - this keeps the word's tail in the batch.
// If speech resumes inside this window the utterance just continues (it was a pause, not an end).
const CLOSE_DEFER_SAMPLES = 8000
// hard cap on buffered utterance audio (the VAD forces a boundary well before this)
const MAX_UTTERANCE_SAMPLES = (VAD_MAX_SPEECH + 5) * SAMPLE_RATE

interface NemotronOptions extends DriverCallbacks {
    paths: NemotronModelPaths
    vadModelPath: string
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
        const { paths, vadModelPath } = this.options

        this.recognizer = new sherpa.OnlineRecognizer({
            featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
            modelConfig: {
                transducer: { encoder: paths.encoder, decoder: paths.decoder, joiner: paths.joiner },
                tokens: paths.tokens,
                numThreads: 2,
                provider: "cpu",
                debug: 0
            },
            // greedy also rules out sherpa's hotword biasing (biblical names/KJV vocabulary), which
            // needs modified_beam_search plus a bpe.model to tokenize the hotword list - and the
            // pinned model revision ships no bpe.model (only encoder/decoder/joiner + tokens.txt).
            // Pre-tokenizing hotwords against tokens.txt would be fragile, and beam search decodes
            // materially slower than the partial-decode budget here assumes. Misheard biblical
            // vocabulary is instead recovered downstream by the quote matcher's phonetic layer
            // (frontend/ai/scripture/quoteMatchTokens.ts), which works for every engine
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
                    this.nextEmitStartMs = Math.round((this.utteranceStartSample / SAMPLE_RATE) * 1000)
                }
                // speech resumed inside the defer window - it was a pause, the utterance continues
                this.finalizeAtSample = 0
            }

            if (this.inUtterance) {
                if (this.utteranceSamples < MAX_UTTERANCE_SAMPLES) {
                    this.utterance.push(samples)
                    this.utteranceSamples += samples.length
                } else if (!this.finalizeAtSample) {
                    // the VAD never closed (constant program audio can defeat it) - force the boundary
                    // NOW instead of silently discarding everything after the cap until it does
                    this.finalizeAtSample = this.totalSamples
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
                this.finalizeUtterance()
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
        if (agreed <= this.emittedWords) return
        const candidate = words.slice(Math.max(0, this.emittedWords - SEAM_BACKTRACK_WORDS), agreed).join(" ")
        this.emittedWords = agreed
        this.emitText(trimRepeatedLeadWords(this.emittedTailWords, candidate))
    }

    private finalizeUtterance() {
        const text = this.decodeBatch(true)
        this.utterance = []
        this.utteranceSamples = 0

        // the final read delivers whatever follows the words already emitted by the partial decodes
        const words = text ? text.split(/\s+/) : []
        const candidate = words.slice(Math.max(0, Math.min(this.emittedWords, words.length) - SEAM_BACKTRACK_WORDS)).join(" ")
        this.emitText(trimRepeatedLeadWords(this.emittedTailWords, candidate))

        this.lastPartialWords = []
        this.emittedWords = 0
        this.partialBackoff = 1
    }

    private emitText(text: string) {
        if (!text) return

        const endMs = Math.round((this.totalSamples / SAMPLE_RATE) * 1000)
        const segment: TranscriberSegment = { text, startMs: this.nextEmitStartMs, endMs }
        this.nextEmitStartMs = endMs
        this.emittedTailWords = appendTailWords(this.emittedTailWords, text)

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

/** Int16 LE PCM bytes (as sent over IPC) to the Float32 samples sherpa expects. */
function int16ToFloat32(buffer: Uint8Array): Float32Array {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const count = Math.floor(buffer.byteLength / 2)
    const samples = new Float32Array(count)
    for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 32768
    return samples
}
