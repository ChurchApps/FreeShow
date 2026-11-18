const OUTPUT_SAMPLE_COUNT = 1600

class STTProcessor extends AudioWorkletProcessor {
    buffer = new Int16Array(OUTPUT_SAMPLE_COUNT)
    index = 0
    sumSq = 0

    process(inputs) {
        const channelData = inputs[0]?.[0]
        if (!channelData) return true

        // blocks are 128 frames & 1600 is not a multiple of 128 - the persistent index spans blocks
        for (let i = 0; i < channelData.length; i++) {
            const raw = channelData[i]
            this.sumSq += raw * raw

            // convert Float32 (-1.0 to 1.0) to Int16
            const s = Math.max(-1, Math.min(1, raw))
            this.buffer[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff

            if (this.index >= OUTPUT_SAMPLE_COUNT) {
                const rms = Math.sqrt(this.sumSq / OUTPUT_SAMPLE_COUNT)
                const level = Math.min(1.0, Math.round(rms * 4.5 * 100) / 100)

                const bytes = new Uint8Array(this.buffer.buffer.slice(0))
                this.port.postMessage({ buffer: bytes, level }, [bytes.buffer])

                this.index = 0
                this.sumSq = 0
            }
        }

        return true
    }
}

registerProcessor("stt-processor", STTProcessor)
