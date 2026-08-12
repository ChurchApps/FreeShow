class PcmSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.bufferL = new Float32Array(1024)
        this.bufferR = new Float32Array(1024)
        this.offset = 0
        this.testTone = false
        this.phase = 0

        this.port.onmessage = (ev) => {
            if (ev.data && typeof ev.data.testTone === "boolean") {
                this.testTone = ev.data.testTone
            }
        }
    }

    process(inputs) {
        const input = inputs[0]
        const left = (input && input.length > 0) ? input[0] : null
        const right = (input && input.length > 1 && input[1] && input[1].length === (left ? left.length : 0)) ? input[1] : left
        const len = (left && left.length > 0) ? left.length : 128

        for (let i = 0; i < len; i++) {
            if (this.testTone) {
                // Pure 440Hz Sine Wave at 48000Hz sample rate
                const sampleVal = Math.sin(this.phase) * 0.3
                this.phase += (2 * Math.PI * 440) / sampleRate
                if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI

                this.bufferL[this.offset] = sampleVal
                this.bufferR[this.offset] = sampleVal
            } else {
                this.bufferL[this.offset] = left ? left[i] : 0.0
                this.bufferR[this.offset] = right ? right[i] : 0.0
            }
            this.offset++

            if (this.offset >= 1024) {
                const planar = new Float32Array(2048)
                planar.set(this.bufferL, 0)
                planar.set(this.bufferR, 1024)

                const wallTime = Date.now()
                this.port.postMessage({ buffer: planar.buffer, sendTime: wallTime }, [planar.buffer])

                this.offset = 0
            }
        }

        return true
    }
}
registerProcessor("pcm-sender-processor", PcmSenderProcessor)
