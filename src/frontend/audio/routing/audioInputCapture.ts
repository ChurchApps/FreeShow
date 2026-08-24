import { AudioAnalyser } from "../audioAnalyser"
import { calculatePeakDb, MIN_DB } from "../dBUtils"
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

const ALWAYS_OBSERVED_NODES = new Set(["main", "drawer_audio", "speaker_default", "output_window"])

export class AudioInputCapture {
    private static instance: AudioInputCapture

    private analysers = new Map<string, CapturedAnalyzers>()
    private floatBuffers = new Map<string, Float32Array[]>()
    private mergedLevels = new Map<string, number>()
    private lastCalcTimestamp = new Map<string, number>()
    private lastQueryTimestamp = new Map<string, number>()
    private windowStreams = new Map<string, MediaStream>()
    private resultCache = new Map<string, InputVisualizerData>()

    private audioCtx: AudioContext | null = null

    private constructor() {}

    public static getInstance(): AudioInputCapture {
        return (AudioInputCapture.instance ??= new AudioInputCapture())
    }

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
        this.analysers.forEach((entry) => entry.connectedSources.delete(node))
    }

    /**
     * Capture window/desktop audio loopback via desktopCapturer source ID and connect to AudioRoutingManager.
     */
    public async captureDesktopAudio(nodeId: string, mediaId = "screen:0:0") {
        this.audioCtx ??= AudioAnalyser.getAudioContext()
        if (!this.audioCtx || this.windowStreams.has(mediaId)) return

        try {
            const constraints = {
                audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: mediaId } },
                video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: mediaId } }
            } as unknown as MediaStreamConstraints

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            this.windowStreams.set(mediaId, stream)

            if (stream.getAudioTracks().length > 0) {
                const sourceNode = this.audioCtx.createMediaStreamSource(stream)
                const parentId = nodeId.includes("output_win_sub_") ? "output_window" : "desktop_default"

                this.captureInput(nodeId, sourceNode)

                if (parentId === "output_window") {
                    AudioRoutingManager.getInstance().registerInputNode(nodeId, sourceNode)
                }
                AudioRoutingManager.getInstance().registerInputNode(parentId, sourceNode)
            }
        } catch (e) {
            console.warn(`[AudioInputCapture] Could not capture desktop audio for ${nodeId}:`, e)
        }
    }

    /** @deprecated Use captureDesktopAudio instead */
    public async captureOutputWindowStream(windowMediaId: string, outputId = "output_window") {
        return this.captureDesktopAudio(`output_win_sub_${outputId}`, windowMediaId)
    }

    public stopOutputWindowStream(windowMediaId: string) {
        const stream = this.windowStreams.get(windowMediaId)
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            this.windowStreams.delete(windowMediaId)
        }
    }

    public stopDesktopAudio(mediaId = "screen:0:0") {
        this.stopOutputWindowStream(mediaId)
        this.removeInput("desktop_default")
    }

    /**
     * Capture or connect a node to dynamic N-channel analyzers without repeatedly re-creating native C++ Web Audio nodes.
     */
    public captureInput(nodeId: string, source: AudioNode, forcedChannelCount?: number): CapturedAnalyzers | null {
        const ctx = (this.audioCtx ??= source.context as AudioContext)
        if (!ctx) return null

        const channelCount = forcedChannelCount ?? Math.max(source.numberOfOutputs || 1, source.channelCount || 2)
        let entry = this.analysers.get(nodeId)

        // Re-use existing entry if channelCount matches
        if (entry && entry.channelCount === channelCount) {
            if (!entry.connectedSources.has(source)) {
                try {
                    source.connect(entry.splitter)
                    entry.connectedSources.add(source)
                } catch {
                    return null
                }
            }
            return entry
        }

        // Clean up previous connections if channel count changed
        if (entry) {
            this.removeInput(nodeId)
        }

        try {
            const splitter = ctx.createChannelSplitter(channelCount)
            const analysers: AnalyserNode[] = new Array(channelCount)

            for (let i = 0; i < channelCount; i++) {
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 256
                analyser.smoothingTimeConstant = 0.8
                splitter.connect(analyser, i)
                analysers[i] = analyser
            }

            entry = { splitter, analysers, channelCount, connectedSources: new Set([source]) }
            source.connect(splitter)

            this.analysers.set(nodeId, entry)
        } catch (e) {
            console.warn(`Could not create ${channelCount}-channel analysers for ${nodeId}:`, e)
            return null
        }

        return entry
    }

    public isNodeObserved(nodeId: string): boolean {
        if (ALWAYS_OBSERVED_NODES.has(nodeId) || nodeId.startsWith("output_win_sub_")) return true
        return performance.now() - (this.lastQueryTimestamp.get(nodeId) || 0) < 3000
    }

    private getOrCaptureEntry(nodeId: string): CapturedAnalyzers | undefined {
        let entry = this.analysers.get(nodeId)
        if (!entry) {
            const nodes = AudioRoutingManager.getInstance().getInputNodes(nodeId)
            for (let i = 0; i < nodes.length; i++) {
                this.captureInput(nodeId, nodes[i])
            }
            entry = this.analysers.get(nodeId)
        }
        return entry
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
                } catch {}
            })
            entry.connectedSources.clear()

            try {
                entry.splitter.disconnect()
                for (let i = 0; i < entry.analysers.length; i++) {
                    entry.analysers[i].disconnect()
                }
            } catch {}

            this.analysers.delete(nodeId)
            this.floatBuffers.delete(nodeId)
            this.resultCache.delete(nodeId)
        }
    }

    public getAnalysers(nodeId = "speaker_default"): AnalyserNode[] {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        return this.getOrCaptureEntry(nodeId)?.analysers || this.analysers.get("drawer_audio")?.analysers || []
    }

    public getVisualizerData(nodeId: string): InputVisualizerData | null {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        const entry = this.getOrCaptureEntry(nodeId)

        if (!entry) {
            const mergedDb = this.mergedLevels.get(nodeId)
            if (mergedDb === undefined) return null

            let cachedResult = this.resultCache.get(nodeId)
            if (!cachedResult || cachedResult.channels.length !== 1) {
                cachedResult = {
                    nodeId,
                    db: mergedDb,
                    channels: [{ channelIndex: 0, db: mergedDb, spectrum: [] }],
                    dbL: mergedDb,
                    dbR: mergedDb,
                    spectrum: []
                }
                this.resultCache.set(nodeId, cachedResult)
            } else {
                cachedResult.db = mergedDb
                cachedResult.channels[0].db = mergedDb
                cachedResult.dbL = mergedDb
                cachedResult.dbR = mergedDb
            }
            return cachedResult
        }

        const now = performance.now()
        const lastCalc = this.lastCalcTimestamp.get(nodeId) || 0
        let cachedResult = this.resultCache.get(nodeId)

        // ~50fps throttle
        if (cachedResult && now - lastCalc < 20) {
            return cachedResult
        }
        this.lastCalcTimestamp.set(nodeId, now)

        // Ensure Float32Array buffers exist
        let buffers = this.floatBuffers.get(nodeId)
        if (!buffers || buffers.length !== entry.channelCount) {
            buffers = new Array(entry.channelCount)
            for (let i = 0; i < entry.channelCount; i++) {
                buffers[i] = new Float32Array(entry.analysers[i].fftSize)
            }
            this.floatBuffers.set(nodeId, buffers)
        }

        // Ensure structure cache exists
        if (!cachedResult || cachedResult.channels.length !== entry.channelCount) {
            const channelsArr: ChannelVisualizerData[] = new Array(entry.channelCount)
            for (let i = 0; i < entry.channelCount; i++) {
                channelsArr[i] = { channelIndex: i, db: MIN_DB, spectrum: [] }
            }

            cachedResult = {
                nodeId,
                db: MIN_DB,
                channels: channelsArr,
                dbL: MIN_DB,
                dbR: MIN_DB,
                spectrum: []
            }
            this.resultCache.set(nodeId, cachedResult)
        }

        let maxDb = MIN_DB
        for (let i = 0; i < entry.channelCount; i++) {
            const analyser = entry.analysers[i]
            const buf = buffers[i] as Float32Array<ArrayBuffer>
            analyser.getFloatTimeDomainData(buf)

            const db = calculatePeakDb(buf)
            if (db > maxDb) maxDb = db
            cachedResult.channels[i].db = db
        }

        cachedResult.db = maxDb
        cachedResult.dbL = cachedResult.channels[0]?.db ?? MIN_DB
        cachedResult.dbR = cachedResult.channels[1]?.db ?? cachedResult.channels[0]?.db ?? MIN_DB

        return cachedResult
    }
}
