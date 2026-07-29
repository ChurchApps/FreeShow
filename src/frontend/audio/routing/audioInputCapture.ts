export interface ChannelVisualizerData {
    channelIndex: number
    db: number
    spectrum: number[]
}

export interface InputVisualizerData {
    nodeId: string
    db: number
    channels: ChannelVisualizerData[]
    // Backwards compatibility properties
    dbL?: number
    dbR?: number
    spectrum?: number[]
}

interface CapturedAnalyzers {
    splitter: ChannelSplitterNode
    analysers: AnalyserNode[]
    channelCount: number
}

export class AudioInputCapture {
    private static instance: AudioInputCapture
    private analysers: Map<string, CapturedAnalyzers> = new Map()
    private buffers: Map<string, Uint8Array[]> = new Map()
    private audioCtx: AudioContext | null = null

    private constructor() {}

    public static getInstance(): AudioInputCapture {
        return (AudioInputCapture.instance ??= new AudioInputCapture())
    }

    public setAudioContext(ctx: AudioContext) {
        this.audioCtx = ctx
    }

    /**
     * Connect a node to dynamic N-channel analyzers based on the node's channel count.
     */
    public captureInput(nodeId: string, source: AudioNode, forcedChannelCount?: number): CapturedAnalyzers | null {
        const ctx = (this.audioCtx ??= source.context as AudioContext)
        if (!ctx) return null

        const channelCount = forcedChannelCount ?? Math.max(source.numberOfOutputs || 1, source.channelCount || 2)
        let entry = this.analysers.get(nodeId)

        if (!entry || entry.channelCount !== channelCount) {
            if (entry) this.removeInput(nodeId)

            try {
                const splitter = ctx.createChannelSplitter(channelCount)
                const analysers: AnalyserNode[] = []

                for (let i = 0; i < channelCount; i++) {
                    const analyser = ctx.createAnalyser()
                    analyser.fftSize = 64
                    analyser.smoothingTimeConstant = 0.8
                    splitter.connect(analyser, i)
                    analysers.push(analyser)
                }

                entry = { splitter, analysers, channelCount }
                this.analysers.set(nodeId, entry)
            } catch (e) {
                console.warn(`Could not create ${channelCount}-channel analysers for ${nodeId}:`, e)
                return null
            }
        }

        try {
            source.connect(entry.splitter)
            return entry
        } catch (e) {
            return null
        }
    }

    public removeInput(nodeId: string) {
        const entry = this.analysers.get(nodeId)
        if (entry) {
            try {
                entry.splitter.disconnect()
                entry.analysers.forEach((a) => a.disconnect())
            } catch (e) {}
            this.analysers.delete(nodeId)
            this.buffers.delete(nodeId)
        }
    }

    public getVisualizerData(nodeId: string): InputVisualizerData | null {
        const entry = this.analysers.get(nodeId)
        if (!entry) return null

        let nodeBuffers = this.buffers.get(nodeId)
        if (!nodeBuffers || nodeBuffers.length !== entry.channelCount) {
            nodeBuffers = entry.analysers.map((a) => new Uint8Array(a.frequencyBinCount))
            this.buffers.set(nodeId, nodeBuffers)
        }

        const channelResults: ChannelVisualizerData[] = []
        let maxDb = -80

        entry.analysers.forEach((analyser, i) => {
            const buf = nodeBuffers![i]
            analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>)

            let sumSquare = 0
            const spectrum = new Array(buf.length)
            for (let j = 0; j < buf.length; j++) {
                const norm = buf[j] / 255
                sumSquare += norm * norm
                spectrum[j] = norm
            }

            const rms = Math.sqrt(buf.length ? sumSquare / buf.length : 0)
            // Convert RMS (0..1) to decibels (-60 dB floor to 0 dB max)
            const db = rms > 0.001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60
            if (db > maxDb) maxDb = db

            channelResults.push({ channelIndex: i, db, spectrum })
        })

        return {
            nodeId,
            db: maxDb,
            channels: channelResults,
            dbL: channelResults[0]?.db ?? -80,
            dbR: channelResults[1]?.db ?? channelResults[0]?.db ?? -80,
            spectrum: channelResults[0]?.spectrum || []
        }
    }
}
