class PcmSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.bufferL = new Float32Array(960)
        this.bufferR = new Float32Array(960)
        this.offset = 0
        this.phase = 0
    }

    process(inputs) {
        const input = inputs[0]
        const left = input && input.length > 0 ? input[0] : null
        const right = input && input.length > 1 && input[1] && input[1].length === (left ? left.length : 0) ? input[1] : left
        const len = left && left.length > 0 ? left.length : 128

        for (let i = 0; i < len; i++) {
            this.bufferL[this.offset] = left ? left[i] : 0.0
            this.bufferR[this.offset] = right ? right[i] : 0.0
            this.offset++

            if (this.offset >= 960) {
                const planar = new Float32Array(1920)
                planar.set(this.bufferL, 0)
                planar.set(this.bufferR, 960)

                const wallTime = Date.now()
                this.port.postMessage({ buffer: planar.buffer, sendTime: wallTime }, [planar.buffer])

                this.offset = 0
            }
        }

        return true
    }
}
registerProcessor("pcm-sender-processor", PcmSenderProcessor)
