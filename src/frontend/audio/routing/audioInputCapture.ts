import { AudioAnalyser } from "../audioAnalyser"
import { AudioRoutingManager } from "./audioRoutingManager"

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

    private windowStreams: Map<string, MediaStream> = new Map()

    public setAudioContext(ctx: AudioContext) {
        this.audioCtx = ctx
    }

    /**
     * Capture window/desktop audio loopback via desktopCapturer source ID and connect to AudioRoutingManager.
     */
    public async captureDesktopAudio(nodeId: string, mediaId: string = "screen:0:0") {
        if (!this.audioCtx) {
            this.audioCtx = AudioAnalyser.getAudioContext()
        }
        if (!this.audioCtx || this.windowStreams.has(mediaId)) return

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: mediaId
                    }
                } as any,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: mediaId
                    }
                } as any
            })

            this.windowStreams.set(mediaId, stream)

            if (stream.getAudioTracks().length > 0) {
                const sourceNode = this.audioCtx.createMediaStreamSource(stream)
                const nodeSubId = nodeId
                const parentId = nodeId.includes("output_win_sub_") ? "output_window" : "desktop_default"

                // Register for specific sub-node visualizer (for meters in drawer)
                this.captureInput(nodeSubId, sourceNode)

                if (parentId === "output_window") {
                    // Legacy output windows still get their own routable nodes
                    AudioRoutingManager.getInstance().registerInputNode(nodeSubId, sourceNode)
                }

                // All desktop audio feeds into the global desktop_default node
                AudioRoutingManager.getInstance().registerInputNode(parentId, sourceNode)
            }
        } catch (e) {
            console.warn(`[AudioInputCapture] Could not capture desktop audio for ${nodeId}:`, e)
        }
    }

    /**
     * @deprecated Use captureDesktopAudio instead
     */
    public async captureOutputWindowStream(windowMediaId: string, outputId: string = "output_window") {
        return this.captureDesktopAudio("output_win_sub_" + outputId, windowMediaId)
    }

    public stopOutputWindowStream(windowMediaId: string) {
        const stream = this.windowStreams.get(windowMediaId)
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            this.windowStreams.delete(windowMediaId)
        }
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
                    analyser.fftSize = 256
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

        let nodeFloatBuffers = this.buffers.get(nodeId + "_float") as unknown as Float32Array[]
        if (!nodeFloatBuffers || nodeFloatBuffers.length !== entry.channelCount) {
            nodeFloatBuffers = entry.analysers.map((a) => new Float32Array(a.fftSize))
            this.buffers.set(nodeId + "_float", nodeFloatBuffers as unknown as Uint8Array[])
        }

        const channelResults: ChannelVisualizerData[] = []
        let maxDb = -60

        entry.analysers.forEach((analyser, i) => {
            const buf = nodeFloatBuffers[i]
            analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>)

            let sumSquare = 0
            const len = buf.length
            for (let j = 0; j < len; j++) {
                const sample = buf[j]
                sumSquare += sample * sample
            }

            const rms = Math.sqrt(len ? sumSquare / len : 0)
            // OBS Studio RMS / perceived level formula: 20 * log10(rms)
            const db = rms > 0.000001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60

            if (db > maxDb) maxDb = db

            channelResults.push({ channelIndex: i, db, spectrum: [] })
        })

        return {
            nodeId,
            db: maxDb,
            channels: channelResults,
            dbL: channelResults[0]?.db ?? -60,
            dbR: channelResults[1]?.db ?? channelResults[0]?.db ?? -60,
            spectrum: channelResults[0]?.spectrum || []
        }
    }
}
