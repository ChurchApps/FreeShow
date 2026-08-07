// AudioWorklet processor for AI auto scripture
// Captures microphone audio at the actual context sample rate, resamples it to 16kHz
// (the rate both engines expect), converts to 16-bit PCM & posts it in short chunks

export {} // module scope, so the AudioWorklet declarations don't collide with ltcProcessor.ts

const TARGET_RATE = 16000
// 100ms per message. The streaming engine decodes whatever it is handed, so this is its
// floor for detecting the end of a phrase - whisper buffers into a ring and triggers on
// sample counts instead, so a smaller chunk costs it nothing (same bytes, more messages).
const OUTPUT_SAMPLE_COUNT = 1600

// Declare AudioWorklet types locally since they aren't in the default DOM lib
declare class AudioWorkletProcessor {
    port: MessagePort
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
}

declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void
declare const sampleRate: number // AudioWorkletGlobalScope - the context's real rate (not necessarily the 48000 we request)

class AiScriptureProcessor extends AudioWorkletProcessor {
    buffer: Int16Array
    index: number
    // rolling input window so each output sample can be filtered across block boundaries (blocks are 128 frames)
    pending: Float32Array
    pendingLength: number
    position: number // fractional read position into pending

    constructor() {
        super()
        this.buffer = new Int16Array(OUTPUT_SAMPLE_COUNT)
        this.index = 0
        this.pending = new Float32Array(1024)
        this.pendingLength = 0
        this.position = 2
    }

    process(inputs: Float32Array[][]) {
        const input = inputs[0]
        if (!input || !input.length) return true

        const channelData = input[0]
        this.pending.set(channelData, this.pendingLength)
        this.pendingLength += channelData.length

        // resample to 16kHz at the context's REAL rate (assuming 48kHz pitch-shifts the audio on 44.1kHz devices,
        // which wrecks whisper accuracy), with a triangular anti-alias filter (1,2,3,2,1)/9 + linear interpolation
        const step = sampleRate / TARGET_RATE
        const p = this.pending
        while (Math.floor(this.position) + 3 < this.pendingLength) {
            const i = Math.floor(this.position)
            const frac = this.position - i

            const f0 = (p[i - 2] + 2 * p[i - 1] + 3 * p[i] + 2 * p[i + 1] + p[i + 2]) / 9
            const f1 = (p[i - 1] + 2 * p[i] + 3 * p[i + 1] + 2 * p[i + 2] + p[i + 3]) / 9
            const value = f0 + (f1 - f0) * frac

            // convert Float32 (-1.0 to 1.0) to Int16
            const s = Math.max(-1, Math.min(1, value))
            this.buffer[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff

            if (this.index >= OUTPUT_SAMPLE_COUNT) {
                const bytes = new Uint8Array(this.buffer.buffer.slice(0))
                this.port.postMessage(bytes, [bytes.buffer])
                this.index = 0
            }

            this.position += step
        }

        // keep the tail samples the next block's filter window still needs
        const keepFrom = Math.max(0, Math.floor(this.position) - 2)
        this.pending.copyWithin(0, keepFrom, this.pendingLength)
        this.pendingLength -= keepFrom
        this.position -= keepFrom

        return true
    }
}

registerProcessor("ai-scripture-processor", AiScriptureProcessor)
