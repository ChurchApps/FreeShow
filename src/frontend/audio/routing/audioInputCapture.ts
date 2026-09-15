import { AudioAnalyser } from "../audioAnalyser"
import { calculatePeakDb, MIN_DB } from "../dBUtils"
import { AudioRoutingManager } from "./audioRoutingManager"

export interface ChannelVisualizerData {
    channelIndex: number
    db: number
}

export interface InputVisualizerData {
    nodeId: string
    db: number
    channels: ChannelVisualizerData[]
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
    public static getInstance(): AudioInputCapture {
        return (AudioInputCapture.instance ??= new AudioInputCapture())
    }

    private analysers = new Map<string, CapturedAnalyzers>()
    private floatBuffers = new Map<string, Float32Array[]>()
    private lastCalcTimestamp = new Map<string, number>()
    private lastQueryTimestamp = new Map<string, number>()
    private windowStreams = new Map<string, MediaStream>()
    private resultCache = new Map<string, InputVisualizerData>()
    private pendingCaptures = new Set<string>()

    private get context(): AudioContext | null {
        return AudioAnalyser.getAudioContext()
    }

    onNodeDisconnected(node: AudioNode) {
        this.analysers.forEach((entry) => entry.connectedSources.delete(node))
    }

    async captureDesktopAudio(nodeId: string, mediaId = "screen:0:0") {
        const ctx = this.context
        if (!ctx || this.windowStreams.has(mediaId)) return

        this.pendingCaptures.add(mediaId)

        try {
            const constraints = {
                audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: mediaId } },
                video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: mediaId } }
            } as unknown as MediaStreamConstraints

            const stream = await navigator.mediaDevices.getUserMedia(constraints)

            // if cancelled during getUserMedia
            if (!this.pendingCaptures.has(mediaId)) {
                stream.getTracks().forEach((track) => track.stop())
                return
            }

            this.windowStreams.set(mediaId, stream)

            if (stream.getAudioTracks().length > 0) {
                const sourceNode = ctx.createMediaStreamSource(stream)
                const parentId = nodeId.includes("output_win_sub_") ? "output_window" : "desktop_default"

                this.captureInput(nodeId, sourceNode)
                if (parentId === "output_window") {
                    AudioRoutingManager.getInstance().registerInputNode(nodeId, sourceNode)
                }
                AudioRoutingManager.getInstance().registerInputNode(parentId, sourceNode)
            }
        } catch (e) {
            console.warn(`[AudioInputCapture] Could not capture desktop audio for ${nodeId}:`, e)
        } finally {
            this.pendingCaptures.delete(mediaId)
        }
    }

    stopDesktopAudio(mediaId = "screen:0:0") {
        this.pendingCaptures.delete(mediaId)

        const stream = this.windowStreams.get(mediaId)
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            this.windowStreams.delete(mediaId)
        }

        this.removeInput("desktop_default")
    }

    captureInput(nodeId: string, source: AudioNode, forcedChannelCount?: number): CapturedAnalyzers | null {
        const ctx = this.context
        if (!ctx) return null

        const channelCount = forcedChannelCount ?? Math.max(source.numberOfOutputs || 1, source.channelCount || 2)
        let entry = this.analysers.get(nodeId)

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

        if (entry) this.removeInput(nodeId)

        try {
            const splitter = ctx.createChannelSplitter(channelCount)
            const analysers = Array.from({ length: channelCount }, (_, i) => {
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 256
                analyser.smoothingTimeConstant = 0.8
                splitter.connect(analyser, i)
                return analyser
            })

            entry = { splitter, analysers, channelCount, connectedSources: new Set([source]) }
            source.connect(splitter)

            this.analysers.set(nodeId, entry)
            return entry
        } catch (e) {
            console.warn(`Could not create ${channelCount}-channel analysers for ${nodeId}:`, e)
            return null
        }
    }

    private isNodeObserved(nodeId: string): boolean {
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

    pruneStaleInputs(activeNodeIds: Set<string>) {
        this.analysers.forEach((_, nodeId) => {
            if (!activeNodeIds.has(nodeId) || !this.isNodeObserved(nodeId)) {
                this.removeInput(nodeId)
            }
        })
    }

    removeInput(nodeId: string) {
        const entry = this.analysers.get(nodeId)
        if (!entry) return

        entry.connectedSources.forEach((s) => {
            try {
                s.disconnect(entry.splitter)
            } catch {}
        })

        try {
            entry.splitter.disconnect()
            entry.analysers.forEach((a) => a.disconnect())
        } catch {}

        this.analysers.delete(nodeId)
        this.floatBuffers.delete(nodeId)
        this.resultCache.delete(nodeId)
    }

    getAnalysers(nodeId = "speaker_default"): AnalyserNode[] {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        return this.getOrCaptureEntry(nodeId)?.analysers || this.analysers.get("drawer_audio")?.analysers || []
    }

    getVisualizerData(nodeId: string): InputVisualizerData | null {
        this.lastQueryTimestamp.set(nodeId, performance.now())
        const entry = this.getOrCaptureEntry(nodeId)
        if (!entry) return null

        const now = performance.now()
        let cachedResult = this.resultCache.get(nodeId)

        // ~50fps throttling
        if (cachedResult && now - (this.lastCalcTimestamp.get(nodeId) || 0) < 20) {
            return cachedResult
        }
        this.lastCalcTimestamp.set(nodeId, now)

        // Ensure Float32Buffers exist
        let buffers = this.floatBuffers.get(nodeId)
        if (!buffers || buffers.length !== entry.channelCount) {
            buffers = Array.from({ length: entry.channelCount }, (_, i) => new Float32Array(entry.analysers[i].fftSize))
            this.floatBuffers.set(nodeId, buffers)
        }

        // Initialize cache structural template
        if (!cachedResult || cachedResult.channels.length !== entry.channelCount) {
            cachedResult = {
                nodeId,
                db: MIN_DB,
                channels: Array.from({ length: entry.channelCount }, (_, i) => ({ channelIndex: i, db: MIN_DB }))
            }
            this.resultCache.set(nodeId, cachedResult)
        }

        let maxDb = MIN_DB
        entry.analysers.forEach((analyser, i) => {
            const buf = buffers![i] as Float32Array<ArrayBuffer>
            analyser.getFloatTimeDomainData(buf)

            const db = calculatePeakDb(buf)
            if (db > maxDb) maxDb = db
            cachedResult!.channels[i].db = db
        })

        cachedResult.db = maxDb

        return cachedResult
    }
}
