// AI AUTO SCRIPTURE - streaming transcription over sherpa-onnx (NVIDIA Nemotron)
// Receives Int16 LE PCM @ 16kHz mono from the renderer (IPC) and decodes it as it
// arrives, so a spoken reference is finalized shortly after the speaker stops talking
// instead of on a fixed window boundary.
//
// Two details are load bearing and were found the hard way in live services:
//
// 1. Utterance boundaries come from Silero VAD, not from the recognizer's own
//    endpointing. Energy gates fail in rooms with constant background noise, where
//    speech sits only a few dB above the ambient level.
// 2. Every utterance gets a FRESH recognizer stream. Reusing one stream across an
//    endpoint (recognizer.reset) leaves the NeMo decoder intermittently deaf for the
//    following utterances - the audio is accepted and decodes to nothing.
//
// Note for Electron: sherpa returns external ArrayBuffers by default, which Electron
// forbids, so vad.front(false) is required.

import type { DriverCallbacks, TranscriberSegment, TranscriptionDriver } from "./types"
import type { NemotronModelPaths } from "../nemotronManager"

const SAMPLE_RATE = 16000

// VAD closes an utterance after this much trailing silence
const VAD_MIN_SILENCE = 0.6
const VAD_MIN_SPEECH = 0.25
// force a boundary during continuous speech so segments keep flowing
const VAD_MAX_SPEECH = 20

// audio kept from just before the VAD triggers, so the first word is not clipped
const PREROLL_MAX_SAMPLES = 8000
// silence fed before finalizing, so the decoder flushes its trailing tokens
const FINALIZE_PAD_SAMPLES = 8000

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
    private stream: any = null

    private stopped = false
    private totalSamples = 0
    private utteranceStartSample = 0

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
            decodingMethod: "greedy_search",
            // boundaries come from the VAD - see the file header
            enableEndpoint: false
        })

        this.vad = new sherpa.Vad(
            {
                sileroVad: {
                    model: vadModelPath,
                    threshold: 0.5,
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

        // flush whatever was still being spoken so its text is not lost
        try {
            if (this.stream) this.finalizeUtterance()
        } catch (err) {
            console.error("[nemotron] Failed to flush the final utterance:", err)
        }

        this.stream = null
        this.recognizer = null
        this.vad = null
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
                if (!this.stream) this.openUtterance()

                this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
                while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)
            } else if (this.stream) {
                // the VAD's confidence decays before a word actually ends - while an utterance is open, keep
                // feeding it through the dip or the tail of the last word is lost ("next verse" -> "next").
                // the VAD still decides where the utterance closes, so this only adds trailing audio, never a new one
                this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples })
                while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)
            } else {
                this.bufferPreroll(samples)
            }

            this.totalSamples += samples.length

            // the VAD closed one or more utterances
            let closed = false
            while (!this.vad.isEmpty()) {
                this.vad.pop()
                closed = true
            }
            if (closed) this.finalizeUtterance()
        } catch (err) {
            this.options.onError(String((err as Error)?.message || err))
        }
    }

    // UTTERANCE HANDLING

    private openUtterance() {
        this.stream = this.recognizer.createStream()
        this.utteranceStartSample = Math.max(0, this.totalSamples - this.prerollSamples)

        // replay the audio captured just before the VAD fired, so the first word survives
        for (const chunk of this.preroll) this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: chunk })
        while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)

        this.preroll = []
        this.prerollSamples = 0
    }

    private finalizeUtterance() {
        if (!this.stream) return

        this.stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: new Float32Array(FINALIZE_PAD_SAMPLES) })
        while (this.recognizer.isReady(this.stream)) this.recognizer.decode(this.stream)

        const text: string = (this.recognizer.getResult(this.stream).text || "").trim()
        const startMs = Math.round((this.utteranceStartSample / SAMPLE_RATE) * 1000)
        const endMs = Math.round((this.totalSamples / SAMPLE_RATE) * 1000)

        this.stream = null

        if (!text) return

        const segment: TranscriberSegment = { text, startMs, endMs }
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
