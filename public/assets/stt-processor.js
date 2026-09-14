const OUTPUT_SAMPLE_COUNT = 1600

class STTProcessor extends AudioWorkletProcessor {
    buffer = new Int16Array(OUTPUT_SAMPLE_COUNT)
    index = 0

    process(inputs) {
        const channelData = inputs[0]?.[0]
        if (!channelData) return true

        // blocks are 128 frames & 1600 is not a multiple of 128 - the persistent index spans blocks
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

registerProcessor("stt-processor", STTProcessor)
