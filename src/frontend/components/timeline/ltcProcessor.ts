const BUFFER_SIZE = 4096

// Declare AudioWorklet types locally since they aren't in the default DOM lib
declare class AudioWorkletProcessor {
    port: MessagePort
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean
}

declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void

class LTCProcessor extends AudioWorkletProcessor {
    buffer: Uint8Array
    index: number

    constructor() {
        super()
        this.buffer = new Uint8Array(BUFFER_SIZE)
        this.index = 0
    }

    process(inputs: Float32Array[][]) {
        const input = inputs[0]
        if (input && input.length > 0) {
            const channelData = input[0]

            for (let i = 0; i < channelData.length; i++) {
                let s = Math.max(-1, Math.min(1, channelData[i]))
                s = s * 128 + 128
                this.buffer[this.index++] = Math.floor(s)

                if (this.index >= BUFFER_SIZE) {
                    this.port.postMessage(this.buffer.slice(0, BUFFER_SIZE))
                    this.index = 0
                }
            }
        }
        return true
    }
}

registerProcessor("ltc-processor", LTCProcessor)
