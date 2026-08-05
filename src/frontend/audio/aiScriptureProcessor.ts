// AudioWorklet processor for AI auto scripture
// Captures microphone audio at the context sample rate (48kHz), decimates it to 16kHz
// (whisper's expected sample rate), converts to 16-bit PCM & posts 1 second chunks

export {} // module scope, so the AudioWorklet declarations don't collide with ltcProcessor.ts

const DECIMATION_FACTOR = 3 // 48000 / 3 = 16000
const OUTPUT_SAMPLE_COUNT = 16000 // 1 second of 16kHz audio per message

// Declare AudioWorklet types locally since they aren't in the default DOM lib
declare class AudioWorkletProcessor {
    port: MessagePort
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
}

declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void

class AiScriptureProcessor extends AudioWorkletProcessor {
    buffer: Int16Array
    index: number
    // carry over samples when a block size is not a multiple of the decimation factor (blocks are 128 frames)
    carry: Float32Array
    carryLength: number

    constructor() {
        super()
        this.buffer = new Int16Array(OUTPUT_SAMPLE_COUNT)
        this.index = 0
        this.carry = new Float32Array(DECIMATION_FACTOR)
        this.carryLength = 0
    }

    process(inputs: Float32Array[][]) {
        const input = inputs[0]
        if (input && input.length > 0) {
            const channelData = input[0]

            for (let i = 0; i < channelData.length; i++) {
                this.carry[this.carryLength++] = channelData[i]
                if (this.carryLength < DECIMATION_FACTOR) continue
                this.carryLength = 0

                // decimate by averaging groups of 3 samples (weak anti-alias filter, adequate for speech + whisper robustness)
                const average = (this.carry[0] + this.carry[1] + this.carry[2]) / DECIMATION_FACTOR

                // convert Float32 (-1.0 to 1.0) to Int16
                const s = Math.max(-1, Math.min(1, average))
                this.buffer[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff

                if (this.index >= OUTPUT_SAMPLE_COUNT) {
                    const bytes = new Uint8Array(this.buffer.buffer.slice(0))
                    this.port.postMessage(bytes, [bytes.buffer])
                    this.index = 0
                }
            }
        }
        return true
    }
}

registerProcessor("ai-scripture-processor", AiScriptureProcessor)
