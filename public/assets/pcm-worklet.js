class PcmSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super()

        this.planar = new Float32Array(1920)
        this.planarBytes = new Uint8Array(this.planar.buffer)
        this.offset = 0

        this.mainPort = null
        this.targetId = null
        this.sampleRate = 48000
        this.icecastConfig = null
        this.isDestroyed = false

        this.port.onmessage = (e) => {
            if (e.data?.type === "INIT_PORT") {
                if (e.ports && e.ports[0]) {
                    if (this.mainPort) {
                        try {
                            this.mainPort.close()
                        } catch {}
                    }
                    this.mainPort = e.ports[0]
                    if (this.mainPort.start) this.mainPort.start()
                }
                if (e.data.targetId) this.targetId = e.data.targetId
                if (e.data.sampleRate) this.sampleRate = e.data.sampleRate
                if (e.data.icecastConfig) this.icecastConfig = e.data.icecastConfig
            } else if (e.data?.type === "DESTROY") {
                this.isDestroyed = true
                if (this.mainPort) {
                    try {
                        this.mainPort.close()
                    } catch {}
                    this.mainPort = null
                }
            }
        }
    }

    process(inputs) {
        if (this.isDestroyed) return false

        const input = inputs[0]
        const left = input && input.length > 0 ? input[0] : null
        const right = input && input.length > 1 && input[1] && input[1].length === (left ? left.length : 0) ? input[1] : left
        const len = left && left.length > 0 ? left.length : 128

        if (this.planar.byteLength === 0) {
            this.planar = new Float32Array(1920)
            this.planarBytes = new Uint8Array(this.planar.buffer)
        }

        let srcOffset = 0
        while (srcOffset < len) {
            const copyLen = Math.min(len - srcOffset, 960 - this.offset)

            if (left) {
                this.planar.set(left.subarray(srcOffset, srcOffset + copyLen), this.offset)
            } else {
                this.planar.fill(0, this.offset, this.offset + copyLen)
            }

            if (right) {
                this.planar.set(right.subarray(srcOffset, srcOffset + copyLen), 960 + this.offset)
            } else {
                this.planar.fill(0, 960 + this.offset, 960 + this.offset + copyLen)
            }

            this.offset += copyLen
            srcOffset += copyLen

            if (this.offset >= 960) {
                if (this.mainPort) {
                    this.mainPort.postMessage({
                        channel: "AUDIO",
                        payload: {
                            id: this.targetId,
                            buffer: this.planarBytes.slice(),
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
