export interface InputVisualizerData {
    nodeId: string
    db: number
    spectrum: number[]
}

export class AudioInputCapture {
    private static instance: AudioInputCapture
    private analysers: Map<string, AnalyserNode> = new Map()
    private buffers: Map<string, Uint8Array> = new Map()
    private audioCtx: AudioContext | null = null

    private constructor() {}

    public static getInstance(): AudioInputCapture {
        return (AudioInputCapture.instance ??= new AudioInputCapture())
    }

    public setAudioContext(ctx: AudioContext) {
        this.audioCtx = ctx
    }

    /**
     * Connect a node to an analyzer for visualization.
     * Reuses existing analyzer if available to prevent node churn.
     */
    public captureInput(nodeId: string, source: AudioNode): AnalyserNode | null {
        const ctx = (this.audioCtx ??= source.context as AudioContext)
        if (!ctx) return null

        let analyser = this.analysers.get(nodeId)
        if (!analyser) {
            try {
                analyser = ctx.createAnalyser()
                analyser.fftSize = 64
                analyser.smoothingTimeConstant = 0.8
                this.analysers.set(nodeId, analyser)
            } catch (e) {
                console.warn(`Could not create analyser for ${nodeId}:`, e)
                return null
            }
        }

        try {
            source.connect(analyser)
            return analyser
        } catch (e) {
            return null
        }
    }

    public removeInput(nodeId: string) {
        const analyser = this.analysers.get(nodeId)
        if (analyser) {
            analyser.disconnect()
            this.analysers.delete(nodeId)
            this.buffers.delete(nodeId)
        }
    }

    public getVisualizerData(nodeId: string): InputVisualizerData | null {
        const analyser = this.analysers.get(nodeId)
        if (!analyser) return null

        let buffer = this.buffers.get(nodeId)
        if (!buffer) {
            buffer = new Uint8Array(analyser.frequencyBinCount)
            this.buffers.set(nodeId, buffer)
        }

        analyser.getByteFrequencyData(buffer as Uint8Array<ArrayBuffer>)

        let sum = 0
        const spectrum = new Array(buffer.length)
        for (let i = 0; i < buffer.length; i++) {
            const val = buffer[i] / 255
            sum += val
            spectrum[i] = val
        }

        const avg = buffer.length ? sum / buffer.length : 0
        const db = avg > 0 ? 20 * Math.log10(avg) : -80

        return { nodeId, db, spectrum }
    }
}
