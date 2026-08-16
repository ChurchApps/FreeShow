class PcmSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super()

        this.bufferL = new Float32Array(960)
        this.bufferR = new Float32Array(960)
        this.offset = 0

        this.mainPort = null
        this.targetId = null
        this.sampleRate = 48000
        this.icecastConfig = null

        this.port.onmessage = (e) => {
            if (e.data?.type === "INIT_PORT") {
                if (e.ports && e.ports[0]) {
                    this.mainPort = e.ports[0]
                    if (this.mainPort.start) this.mainPort.start()
                }
                if (e.data.targetId) this.targetId = e.data.targetId
                if (e.data.sampleRate) this.sampleRate = e.data.sampleRate
                if (e.data.icecastConfig) this.icecastConfig = e.data.icecastConfig
            }
        }
    }

    process(inputs) {
        const input = inputs[0]
        const left = input && input.length > 0 ? input[0] : null
        const right = input && input.length > 1 && input[1] && input[1].length === (left ? left.length : 0) ? input[1] : left
        const len = left && left.length > 0 ? left.length : 128

        // ensure buffers exist and are not detached
        if (this.bufferL.byteLength === 0) this.bufferL = new Float32Array(960)
        if (this.bufferR.byteLength === 0) this.bufferR = new Float32Array(960)

        for (let i = 0; i < len; i++) {
            this.bufferL[this.offset] = left ? left[i] : 0.0
            this.bufferR[this.offset] = right ? right[i] : 0.0
            this.offset++

            if (this.offset >= 960) {
                const planar = new Float32Array(1920)
                planar.set(this.bufferL, 0)
                planar.set(this.bufferR, 960)

                if (this.mainPort) {
                    this.mainPort.postMessage({
                        channel: "AUDIO",
                        payload: {
                            id: this.targetId,
                            buffer: new Uint8Array(planar.buffer),
                            sampleRate: this.sampleRate,
                            icecast: this.icecastConfig
                        }
                    })
                }

                this.offset = 0
            }
        }

        return true
    }
}
registerProcessor("pcm-sender-processor", PcmSenderProcessor)
