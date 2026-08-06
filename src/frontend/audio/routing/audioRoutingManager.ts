import { get } from "svelte/store"
import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { audioChannelsData, audioEffects, audioRouting, outputs } from "../../stores"
import { keysToID } from "../../components/helpers/array"
import { AudioAnalyser } from "../audioAnalyser"
import { AudioCompressor } from "../effects/audioCompressor"
import { AudioDelay } from "../effects/audioDelay"
import { AudioEqualizer } from "../effects/audioEqualizer"
import { AudioFilter } from "../effects/audioFilter"
import { AudioLimiter } from "../effects/audioLimiter"
import { AudioNoiseGate } from "../effects/audioNoiseGate"
import { AudioReverb } from "../effects/audioReverb"
import { AudioStereoShaper } from "../effects/audioStereoShaper"
import { deduplicateConnections } from "./audioRoutingInit"
import { AudioInputCapture } from "./audioInputCapture"

export class AudioRoutingManager {
    private static instance: AudioRoutingManager
    private config: AudioRoutingConfig = { channels: [], connections: [] }
    private audioCtx: AudioContext | null = null
    private mergerNodes: Map<string, GainNode> = new Map()
    private channelDelayNodes: Map<string, DelayNode> = new Map()
    private mergerEffectChains: Map<string, { input: AudioNode; output: AudioNode; dispose: () => void }> = new Map()
    private masterNode: AudioNode | null = null
    private destinationNode: AudioNode | null = null
    private inputNodes: Map<string, Set<AudioNode>> = new Map()

    private constructor() {
        outputs.subscribe(() => {
            this.updateRoutingNodes()
        })

        audioRouting.subscribe((val) => {
            if (val) {
                val.connections = deduplicateConnections(val.connections)
                this.config = val
                this.updateRoutingNodes()
                AudioAnalyser.recorderActivate()

                // Ensure desktop audio is captured if connected
                if (val.connections.some((c) => c.from === "desktop_default")) {
                    AudioInputCapture.getInstance().captureDesktopAudio("desktop_default")
                }
            }
        })
        audioChannelsData.subscribe((data) => {
            if (data) {
                this.updateAllGains()
            }
        })
        audioEffects.subscribe(() => {
            if (this.audioCtx) {
                this.updateRoutingNodes()
            }
        })
    }

    public static getInstance(): AudioRoutingManager {
        if (!AudioRoutingManager.instance) {
            AudioRoutingManager.instance = new AudioRoutingManager()
        }
        return AudioRoutingManager.instance
    }

    public setAudioContext(ctx: AudioContext) {
        if (this.audioCtx === ctx) return

        this.audioCtx = ctx
        this.updateRoutingNodes()
    }

    public setMasterNode(node: AudioNode) {
        this.masterNode = node
        this.updateRoutingNodes()
        this.updateAllGains()
    }

    public setDestinationNode(node: AudioNode) {
        this.destinationNode = node
        this.updateRoutingNodes()
    }

    private speakerSinks: Map<string, { ctx: AudioContext; element: HTMLAudioElement }> = new Map()
    private speakerSubStreams: Map<string, { streamDest: MediaStreamAudioDestinationNode; streamSource: MediaStreamAudioSourceNode; maxChannels: number }> = new Map()

    private getOrCreateSpeakerSink(deviceId: string): { ctx: AudioContext; element: HTMLAudioElement } | null {
        if (this.speakerSinks.has(deviceId)) {
            return this.speakerSinks.get(deviceId)!
        }
        try {
            const ctx = new AudioContext({ latencyHint: "playback" })
            if ((ctx as any).setSinkId) {
                ;(ctx as any).setSinkId(deviceId).catch((e: any) => console.error(`[AudioRoutingManager] Failed to set sinkId ${deviceId}:`, e))
            }
            const element = new Audio()
            element.muted = true
            this.speakerSinks.set(deviceId, { ctx, element })
            return { ctx, element }
        } catch (e) {
            console.error(`[AudioRoutingManager] Could not create sink for device ${deviceId}:`, e)
            return null
        }
    }

    private cleanupUnusedSpeakerSinks(activeDeviceIds: Set<string>) {
        this.speakerSinks.forEach((sink, deviceId) => {
            if (!activeDeviceIds.has(deviceId)) {
                try {
                    sink.ctx.close()
                    sink.element.pause()
                    sink.element.srcObject = null
                } catch (e) {}
                this.speakerSinks.delete(deviceId)
            }
        })
        this.speakerSubStreams.forEach((sub, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            if (!activeDeviceIds.has(deviceId)) {
                try {
                    sub.streamDest.stream.getAudioTracks().forEach((track) => track.stop())
                    sub.streamDest.disconnect()
                    sub.streamSource.disconnect()
                } catch (e) {}
                this.speakerSubStreams.delete(targetId)
            }
        })
    }

    private setNodeGainAndDelay(id: string, gainNode: GainNode, chData: any) {
        if (!this.audioCtx) return
        const isMuted = !!chData.isMuted
        let vol = chData.volume ?? 1
        if (vol > 5) vol /= 100 // Normalize if volume was accidentally saved as 0-100 percentage
        const targetGain = isMuted ? 0 : Math.max(0, vol)
        try {
            gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime)
        } catch (e) {}

        const delaySec = Math.max(0, Math.min(5, (chData.delay || 0) / 1000))
        if (delaySec > 0 && !this.channelDelayNodes.has(id)) {
            this.updateRoutingNodes()
        } else {
            const delayNode = this.channelDelayNodes.get(id)
            if (delayNode) {
                try {
                    delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx.currentTime)
                } catch (e) {}
            }
        }
    }

    private applyMergerGain(id: string, node: GainNode) {
        const data = get(audioChannelsData)[id] || {}
        this.setNodeGainAndDelay(id, node, data)
    }

    public updateAllGains() {
        if (!this.audioCtx) return
        const data = get(audioChannelsData) || {}
        this.mergerNodes.forEach((node, id) => {
            this.applyMergerGain(id, node)
        })
        if (this.masterNode && (this.masterNode as GainNode).gain) {
            this.setNodeGainAndDelay("main", this.masterNode as GainNode, data.main || {})
        }
    }

    private buildMergerEffectChain(id: string, node: GainNode, channelEffects: any): AudioNode {
        const existingChain = this.mergerEffectChains.get(id)
        if (existingChain) {
            existingChain.dispose()
            this.mergerEffectChains.delete(id)
        }

        if (!channelEffects || !this.audioCtx) return node

        const ctx = this.audioCtx
        const effectConstructors: Record<string, (cfg: any) => { input: GainNode; output: GainNode; dispose?: () => void } | null> = {
            equalizer: (cfg) => {
                const eq = new AudioEqualizer(cfg)
                eq.initialize(ctx)
                const nodes = eq.getNodes()
                return nodes ? { ...nodes, dispose: () => eq.dispose() } : null
            },
            filter: (cfg) => new AudioFilter(ctx, cfg),
            noiseGate: (cfg) => new AudioNoiseGate(ctx, cfg),
            compressor: (cfg) => new AudioCompressor(ctx, cfg),
            reverb: (cfg) => new AudioReverb(ctx, cfg),
            delay: (cfg) => new AudioDelay(ctx, cfg),
            limiter: (cfg) => new AudioLimiter(ctx, cfg),
            stereoShaper: (cfg) => new AudioStereoShaper(ctx, cfg)
        }

        const chain: { input: GainNode; output: GainNode; dispose?: () => void }[] = []
        for (const key of Object.keys(effectConstructors)) {
            const cfg = channelEffects[key]
            if (cfg?.enabled) {
                const seg = effectConstructors[key](cfg)
                if (seg) chain.push(seg)
            }
        }

        if (chain.length === 0) return node

        let prev: AudioNode = node
        for (const seg of chain) {
            prev.connect(seg.input)
            prev = seg.output
        }

        this.mergerEffectChains.set(id, {
            input: node,
            output: prev,
            dispose: () => {
                chain.forEach((seg) => {
                    try {
                        seg.output.disconnect()
                    } catch (e) {}
                    seg.dispose?.()
                })
            }
        })

        return prev
    }

    private updateScheduled = false

    public updateRoutingNodes() {
        if (!this.audioCtx) return

        if (this.updateScheduled) return
        this.updateScheduled = true

        Promise.resolve().then(() => {
            if (!this.updateScheduled) return
            this.updateScheduled = false
            this.executeRoutingUpdate()
        })
    }

    private executeRoutingUpdate() {
        if (!this.audioCtx) return
        const startTime = performance.now()

        const allOuts = keysToID(get(outputs) || {})
        const inactiveOutputChannelIds = new Set<string>(
            allOuts.filter((out) => !out.enabled).map((out) => `channel_${out.id}`)
        )

        // Ensure all configured active channels have corresponding GainNode instances
        const channels = (this.config.channels || []).filter((m) => !inactiveOutputChannelIds.has(m.id))
        channels.forEach((m) => {
            if (!this.mergerNodes.has(m.id)) {
                const gainNode = this.audioCtx!.createGain()
                this.mergerNodes.set(m.id, gainNode)
                this.applyMergerGain(m.id, gainNode)
            } else {
                this.applyMergerGain(m.id, this.mergerNodes.get(m.id)!)
            }
        })

        // Clean up removed channels
        const currentChannelIds = new Set(channels.map((m) => m.id))
        this.mergerNodes.forEach((node, id) => {
            if (!currentChannelIds.has(id)) {
                try {
                    node.disconnect()
                    AudioInputCapture.getInstance().onNodeDisconnected(node)
                    const delayNode = this.channelDelayNodes.get(id)
                    if (delayNode) {
                        delayNode.disconnect()
                        AudioInputCapture.getInstance().onNodeDisconnected(delayNode)
                    }
                    AudioInputCapture.getInstance().removeInput(id)
                } catch (e) {}
                this.mergerNodes.delete(id)
                this.channelDelayNodes.delete(id)
            }
        })

        const activeNodeIds = new Set<string>()
        activeNodeIds.add("drawer_audio")
        activeNodeIds.add("output_window")
        activeNodeIds.add("mic_default")
        this.inputNodes.forEach((_, key) => activeNodeIds.add(key))
        this.mergerNodes.forEach((_, key) => activeNodeIds.add(key))
        this.config.connections.forEach((c) => {
            activeNodeIds.add(c.from)
            activeNodeIds.add(c.to)
        })
        AudioInputCapture.getInstance().pruneStaleInputs(activeNodeIds)

        // Track active child speaker device IDs
        const activeSubDeviceIds = new Set<string>()
        this.config.connections.forEach((c) => {
            if (c.to.startsWith("speaker_sub_")) {
                activeSubDeviceIds.add(c.to.replace("speaker_sub_", ""))
            }
        })
        this.cleanupUnusedSpeakerSinks(activeSubDeviceIds)

        // Connect mergers to sinks (Speakers / Network)
        const speakerSubMergers = new Map<string, { mergerNode: ChannelMergerNode; maxChannels: number }>()

        // 1. Pre-pass: calculate max channels needed per speaker sub-device and create per-speaker merger nodes
        this.config.connections.forEach((c) => {
            if (c.to.startsWith("speaker_sub_")) {
                const chIndex = (c as any).channelIndex ?? 0
                const current = speakerSubMergers.get(c.to)
                const count = Math.max(current?.maxChannels || 2, chIndex + 1)
                if (!current) {
                    const mergerNode = this.audioCtx!.createChannelMerger(count)
                    speakerSubMergers.set(c.to, { mergerNode, maxChannels: count })
                } else if (count > current.maxChannels) {
                    const mergerNode = this.audioCtx!.createChannelMerger(count)
                    speakerSubMergers.set(c.to, { mergerNode, maxChannels: count })
                }
            }
        })

        // 2. Connect individual merger sources through their per-merger DSP effect chain to target speaker channel pins
        const allEffects = get(audioEffects)
        this.mergerNodes.forEach((node, id) => {
            try {
                node.disconnect()
                AudioInputCapture.getInstance().onNodeDisconnected(node)
            } catch (e) {}

            let outNode = this.buildMergerEffectChain(id, node, allEffects[id])

            // Channel Delay node (0-5000ms) - only route through DelayNode if delay is configured
            const chData = get(audioChannelsData)[id] || {}
            const delaySec = Math.max(0, Math.min(5, (chData.delay || 0) / 1000))
            if (delaySec > 0) {
                if (!this.channelDelayNodes.has(id)) {
                    const delayNode = this.audioCtx!.createDelay(5.0)
                    this.channelDelayNodes.set(id, delayNode)
                }
                const delayNode = this.channelDelayNodes.get(id)!
                delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx!.currentTime)

                try {
                    delayNode.disconnect()
                    AudioInputCapture.getInstance().onNodeDisconnected(delayNode)
                } catch (e) {}

                outNode.connect(delayNode)
                outNode = delayNode
            }

            // Re-connect visualizer after disconnect
            AudioInputCapture.getInstance().captureInput(id, outNode)

            // Speaker Sink
            const speakerConns = this.config.connections.filter((c) => c.from === id && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_")))
            speakerConns.forEach((c) => {
                if (c.to === "speaker_default") {
                    if (this.audioCtx) {
                        const master = AudioAnalyser.getMasterGainNode()
                        outNode.connect(master)
                    }
                } else if (c.to.startsWith("speaker_sub_")) {
                    const targetSpeaker = speakerSubMergers.get(c.to)
                    if (targetSpeaker) {
                        const channelIndex = (c as any).channelIndex ?? 0
                        // Connect source merger to target speaker pin
                        outNode.connect(targetSpeaker.mergerNode, 0, channelIndex)
                    }
                }
            })

            // Network Sink
            const networkConns = this.config.connections.filter((c) => c.from === id && (c.to === "network_default" || c.to === "icecast" || c.to.startsWith("network_sub_")))
            if (networkConns.length > 0) {
                if (this.destinationNode) {
                    try {
                        outNode.connect(this.destinationNode)
                    } catch (e) {}
                }
                networkConns.forEach((c) => {
                    AudioInputCapture.getInstance().captureInput(c.to, outNode)
                })
            }
        })

        // 3. Connect each per-speaker merger to its sub-speaker AudioContext sink & visualizer capture
        speakerSubMergers.forEach(({ mergerNode, maxChannels }, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            const sink = this.getOrCreateSpeakerSink(deviceId)
            if (sink) {
                const prev = this.speakerSubStreams.get(targetId)

                // Reuse existing sub-stream if maxChannels has not changed to avoid tearing down MediaStream nodes
                if (prev && prev.maxChannels === maxChannels) {
                    mergerNode.connect(prev.streamDest)
                    AudioInputCapture.getInstance().captureInput(targetId, mergerNode, maxChannels)
                    return
                }

                if (prev) {
                    try {
                        prev.streamDest.stream.getAudioTracks().forEach((track) => track.stop())
                        prev.streamDest.disconnect()
                        prev.streamSource.disconnect()
                    } catch (e) {}
                }

                const streamDest = this.audioCtx!.createMediaStreamDestination()
                mergerNode.connect(streamDest)

                // Capture combined multi-channel output for speaker visualizer meter with exact channel count
                AudioInputCapture.getInstance().captureInput(targetId, mergerNode, maxChannels)

                const streamSource = sink.ctx.createMediaStreamSource(streamDest.stream)
                streamSource.connect(sink.ctx.destination)
                if (sink.ctx.state === "suspended") {
                    sink.ctx.resume().catch(() => {})
                }
                this.speakerSubStreams.set(targetId, { streamDest, streamSource, maxChannels })
            }
        })

        const duration = performance.now() - startTime
        if (duration > 15) {
            console.warn(`[AudioRoutingManager] Lag detected: Audio routing update took ${duration.toFixed(2)}ms (budget: 15ms)`)
        }

        // Update Sink Visualizers
        if (this.masterNode) {
            AudioInputCapture.getInstance().captureInput("speaker_default", this.masterNode)
        }
        if (this.destinationNode) {
            if (this.config.connections.some((c) => c.to === "network_default")) {
                AudioInputCapture.getInstance().captureInput("network_default", this.destinationNode)
            }
            if (this.config.connections.some((c) => c.to === "icecast")) {
                AudioInputCapture.getInstance().captureInput("icecast", this.destinationNode)
            }
        }

        // Update input connectivity (real-time routing)
        // Group by node to avoid redundant disconnects clearing multi-group connections
        const nodeToIds = new Map<AudioNode, Set<string>>()
        this.inputNodes.forEach((nodes, inputId) => {
            nodes.forEach((node) => {
                if (!nodeToIds.has(node)) nodeToIds.set(node, new Set())
                nodeToIds.get(node)!.add(inputId)
            })
        })

        nodeToIds.forEach((inputIds, node) => {
            try {
                node.disconnect()
            } catch (e) {}
            AudioInputCapture.getInstance().onNodeDisconnected(node)

            inputIds.forEach((inputId) => {
                this.routeInput(inputId, node)
            })
        })
    }

    private routeInput(inputId: string, inputNode: AudioNode) {
        // Attach capture visualizer to input node
        AudioInputCapture.getInstance().captureInput(inputId, inputNode)

        const targetMergerIds = this.getConnectionsFrom(inputId)
        targetMergerIds.forEach((mergerId) => {
            const mergerNode = this.getMergerNode(mergerId)
            if (mergerNode) {
                try {
                    inputNode.connect(mergerNode)
                } catch (e) {
                    console.error(`[AudioRoutingManager] Could not connect source to merger ${mergerId}:`, e)
                }
            }
        })
    }

    public getMergerNode(mergerId: string): GainNode | null {
        return this.mergerNodes.get(mergerId) || null
    }

    public getConnectionsFrom(sourceId: string): string[] {
        const allOuts = keysToID(get(outputs) || {})
        const inactiveOutputChannelIds = new Set<string>(
            allOuts.filter((out) => !out.enabled).map((out) => `channel_${out.id}`)
        )
        if (inactiveOutputChannelIds.has(sourceId)) return []

        return this.config.connections
            .filter((c) => c.from === sourceId)
            .map((c) => c.to)
            .filter((targetId) => !inactiveOutputChannelIds.has(targetId))
    }

    public getConnectionsTo(targetId: string): string[] {
        const allOuts = keysToID(get(outputs) || {})
        const inactiveOutputChannelIds = new Set<string>(
            allOuts.filter((out) => !out.enabled).map((out) => `channel_${out.id}`)
        )
        if (inactiveOutputChannelIds.has(targetId)) return []

        return this.config.connections
            .filter((c) => c.to === targetId)
            .map((c) => c.from)
            .filter((sourceId) => !inactiveOutputChannelIds.has(sourceId))
    }

    public isConnected(fromId: string, toId: string): boolean {
        return this.config.connections.some((c) => c.from === fromId && c.to === toId)
    }

    /**
     * Register an active input node (e.g. from AudioAnalyser) so we can
     * update its connections in real-time when the routing config changes.
     */
    public registerInputNode(inputId: string, node: AudioNode) {
        if (!this.inputNodes.has(inputId)) this.inputNodes.set(inputId, new Set())
        const nodes = this.inputNodes.get(inputId)!
        if (nodes.has(node)) return
        nodes.add(node)
        this.routeInput(inputId, node)
    }

    public unregisterInputNode(inputId: string, node?: AudioNode) {
        if (!node) {
            const nodes = this.inputNodes.get(inputId)
            if (nodes) {
                nodes.forEach((n) => {
                    try {
                        n.disconnect()
                    } catch (e) {}
                })
            }
            this.inputNodes.delete(inputId)
            return
        }
        const nodes = this.inputNodes.get(inputId)
        if (nodes) {
            if (nodes.has(node)) {
                try {
                    node.disconnect()
                } catch (e) {}
                nodes.delete(node)
            }
            if (nodes.size === 0) {
                this.inputNodes.delete(inputId)
            }
        }
    }
}
