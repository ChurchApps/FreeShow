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
    connectedSources: Set<AudioNode>
}

export class AudioInputCapture {
    private static instance: AudioInputCapture
    private analysers: Map<string, CapturedAnalyzers> = new Map()
    private buffers: Map<string, Uint8Array[]> = new Map()
    private mergedLevels: Map<string, number> = new Map()
    private lastCalcTimestamp: Map<string, number> = new Map()
    private lastQueryTimestamp: Map<string, number> = new Map()
    private audioCtx: AudioContext | null = null

    private constructor() {}

    public static getInstance(): AudioInputCapture {
        return (AudioInputCapture.instance ??= new AudioInputCapture())
    }

    private windowStreams: Map<string, MediaStream> = new Map()

    public setAudioContext(ctx: AudioContext) {
        this.audioCtx = ctx
    }

    public setMergedDb(nodeId: string, db: number) {
        this.mergedLevels.set(nodeId, db)
    }

    public clearMergedDbs() {
        this.mergedLevels.clear()
    }

    public onNodeDisconnected(node: AudioNode) {
        this.analysers.forEach((entry) => {
            entry.connectedSources.delete(node)
        })
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

                entry = { splitter, analysers, channelCount, connectedSources: new Set() }
                this.analysers.set(nodeId, entry)
            } catch (e) {
                console.warn(`Could not create ${channelCount}-channel analysers for ${nodeId}:`, e)
                return null
            }
        }

        if (entry.connectedSources.has(source)) return entry

        try {
            source.connect(entry.splitter)
            entry.connectedSources.add(source)
            return entry
        } catch (e) {
            return null
        }
    }

    private resultCache: Map<string, InputVisualizerData> = new Map()

    public isNodeObserved(nodeId: string): boolean {
        if (nodeId === "main" || nodeId === "drawer_audio" || nodeId === "speaker_default") return true
        const lastQuery = this.lastQueryTimestamp.get(nodeId) || 0
        return performance.now() - lastQuery < 3000
    }

    public pruneStaleInputs(activeNodeIds: Set<string>) {
        this.analysers.forEach((_, nodeId) => {
            if (!activeNodeIds.has(nodeId) || !this.isNodeObserved(nodeId)) {
                this.removeInput(nodeId)
            }
        })
    }

    public removeInput(nodeId: string) {
        const entry = this.analysers.get(nodeId)
        if (entry) {
            entry.connectedSources.forEach((s) => {
                try {
                    s.disconnect(entry.splitter)
                } catch (e) {}
            })
            entry.connectedSources.clear()
            try {
                entry.splitter.disconnect()
                entry.analysers.forEach((a) => a.disconnect())
            } catch (e) {}
            this.analysers.delete(nodeId)
            this.buffers.delete(nodeId)
            this.buffers.delete(nodeId + "_float")
            this.resultCache.delete(nodeId)
        }
    }

    public getAnalysers(nodeId: string = "speaker_default"): AnalyserNode[] {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        return this.analysers.get(nodeId)?.analysers || this.analysers.get("drawer_audio")?.analysers || []
    }

    public getVisualizerData(nodeId: string): InputVisualizerData | null {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        const entry = this.analysers.get(nodeId)
        if (!entry) {
            const mergedDb = this.mergedLevels.get(nodeId)
            if (mergedDb !== undefined) {
                let cachedResult = this.resultCache.get(nodeId)
                if (!cachedResult || cachedResult.channels.length !== 1) {
                    cachedResult = { nodeId, db: mergedDb, channels: [{ channelIndex: 0, db: mergedDb, spectrum: [] }], dbL: mergedDb, dbR: mergedDb, spectrum: [] }
                    this.resultCache.set(nodeId, cachedResult)
                } else {
                    cachedResult.db = mergedDb
                    cachedResult.channels[0].db = mergedDb
                    cachedResult.dbL = mergedDb
                    cachedResult.dbR = mergedDb
                }
                return cachedResult
            }
            return null
        }

        const now = performance.now()
        const lastCalc = this.lastCalcTimestamp.get(nodeId) || 0
        let cachedResult = this.resultCache.get(nodeId)

        // Return cached calculation if computed within the last 20ms (~50fps max rate)
        if (cachedResult && now - lastCalc < 20) {
            return cachedResult
        }
        this.lastCalcTimestamp.set(nodeId, now)

        let nodeFloatBuffers = this.buffers.get(nodeId + "_float") as unknown as Float32Array[]
        if (!nodeFloatBuffers || nodeFloatBuffers.length !== entry.channelCount) {
            nodeFloatBuffers = entry.analysers.map((a) => new Float32Array(a.fftSize))
            this.buffers.set(nodeId + "_float", nodeFloatBuffers as unknown as Uint8Array[])
        }

        if (!cachedResult || cachedResult.channels.length !== entry.channelCount) {
            const channels: ChannelVisualizerData[] = []
            for (let i = 0; i < entry.channelCount; i++) {
                channels.push({ channelIndex: i, db: -60, spectrum: [] })
            }
            cachedResult = {
                nodeId,
                db: -60,
                channels,
                dbL: -60,
                dbR: -60,
                spectrum: []
            }
            this.resultCache.set(nodeId, cachedResult)
        }

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
            const db = rms > 0.000001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60

            if (db > maxDb) maxDb = db
            cachedResult!.channels[i].db = db
        })

        cachedResult.db = maxDb
        cachedResult.dbL = cachedResult.channels[0]?.db ?? -60
        cachedResult.dbR = cachedResult.channels[1]?.db ?? cachedResult.channels[0]?.db ?? -60

        return cachedResult
    }
}
