// AudioWorklet processor for AI auto scripture
// The AudioContext is created at 16kHz (the rate both engines expect), so chromium's own
// resampler brings the microphone down to 16kHz with proper anti-aliasing before this runs -
// the processor only converts to 16-bit PCM & posts it in short chunks

export {} // module scope, so the AudioWorklet declarations don't collide with ltcProcessor.ts

// 100ms per message at the 16kHz context rate. The streaming engine decodes whatever it is
// handed, so this is its floor for detecting the end of a phrase - whisper buffers into a ring
// and triggers on sample counts instead, so a smaller chunk costs it nothing (same bytes, more messages).
const OUTPUT_SAMPLE_COUNT = 1600

// Declare AudioWorklet types locally since they aren't in the default DOM lib
declare class AudioWorkletProcessor {
    port: MessagePort
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
}

declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void

class AiScriptureProcessor extends AudioWorkletProcessor {
    buffer: Int16Array
    index: number

    constructor() {
        super()
        this.buffer = new Int16Array(OUTPUT_SAMPLE_COUNT)
        this.index = 0
    }

    process(inputs: Float32Array[][]) {
        const input = inputs[0]
        if (!input || !input.length) return true

        // blocks are 128 frames & 1600 is not a multiple of 128 - the persistent index spans blocks
        const channelData = input[0]
        for (let i = 0; i < channelData.length; i++) {
            // convert Float32 (-1.0 to 1.0) to Int16
            const s = Math.max(-1, Math.min(1, channelData[i]))
            this.buffer[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff

            if (this.index >= OUTPUT_SAMPLE_COUNT) {
                const bytes = new Uint8Array(this.buffer.buffer.slice(0))
                this.port.postMessage(bytes, [bytes.buffer])
                this.index = 0
            }
        }

        return true
    }
}

registerProcessor("ai-scripture-processor", AiScriptureProcessor)
