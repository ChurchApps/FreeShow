import { get } from "svelte/store"
import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { audioChannelsData, audioRouting } from "../../stores"
import { AudioAnalyser } from "../audioAnalyser"
import { AudioInputCapture } from "./audioInputCapture"

export class AudioRoutingManager {
    private static instance: AudioRoutingManager
    private config: AudioRoutingConfig = { mergers: [], connections: [] }
    private audioCtx: AudioContext | null = null
    private mergerNodes: Map<string, GainNode> = new Map()
    private masterNode: AudioNode | null = null
    private destinationNode: AudioNode | null = null
    private inputNodes: Map<string, Set<AudioNode>> = new Map()

    private constructor() {
        audioRouting.subscribe((val) => {
            if (val) {
                this.config = val
                this.updateRoutingNodes()
                AudioAnalyser.recorderActivate()
            }
        })
        audioChannelsData.subscribe((data) => {
            if (data) {
                this.updateAllGains()
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
        this.audioCtx = ctx
        this.updateRoutingNodes()
    }

    public setMasterNode(node: AudioNode) {
        this.masterNode = node
        this.updateRoutingNodes()
    }

    public setDestinationNode(node: AudioNode) {
        this.destinationNode = node
        this.updateRoutingNodes()
    }

    private speakerSinks: Map<string, { ctx: AudioContext; element: HTMLAudioElement }> = new Map()

    private getOrCreateSpeakerSink(deviceId: string): { ctx: AudioContext; element: HTMLAudioElement } | null {
        if (this.speakerSinks.has(deviceId)) {
            return this.speakerSinks.get(deviceId)!
        }
        try {
            const ctx = new AudioContext({ latencyHint: "interactive" })
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
    }

    private applyMergerGain(id: string, node: GainNode) {
        if (!this.audioCtx) return
        const data = get(audioChannelsData)[id] || {}
        const isMuted = !!data.isMuted
        const vol = data.volume ?? 1
        const targetGain = isMuted ? 0 : Math.max(0, vol)
        try {
            node.gain.setValueAtTime(targetGain, this.audioCtx.currentTime)
        } catch (e) {}
    }

    public updateAllGains() {
        if (!this.audioCtx) return
        const data = get(audioChannelsData) || {}
        this.mergerNodes.forEach((node, id) => {
            this.applyMergerGain(id, node)
        })
        if (this.masterNode && (this.masterNode as GainNode).gain) {
            const mainData = data.main || {}
            const isMuted = !!mainData.isMuted
            const vol = mainData.volume ?? 1
            const targetGain = isMuted ? 0 : Math.max(0, vol)
            try {
                ;(this.masterNode as GainNode).gain.setValueAtTime(targetGain, this.audioCtx.currentTime)
            } catch (e) {}
        }
    }

    public updateRoutingNodes() {
        if (!this.audioCtx) return

        // Ensure all configured mergers have corresponding GainNode instances
        this.config.mergers.forEach((m) => {
            if (!this.mergerNodes.has(m.id)) {
                const gainNode = this.audioCtx!.createGain()
                this.mergerNodes.set(m.id, gainNode)
                this.applyMergerGain(m.id, gainNode)
            } else {
                this.applyMergerGain(m.id, this.mergerNodes.get(m.id)!)
            }
        })

        // Clean up removed mergers
        const currentMergerIds = new Set(this.config.mergers.map((m) => m.id))
        this.mergerNodes.forEach((node, id) => {
            if (!currentMergerIds.has(id)) {
                try {
                    node.disconnect()
                    AudioInputCapture.getInstance().removeInput(id)
                } catch (e) {}
                this.mergerNodes.delete(id)
            }
        })

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

        // 2. Connect individual merger sources to their target speaker channel pins
        this.mergerNodes.forEach((node, id) => {
            try {
                node.disconnect()
            } catch (e) {}

            // Re-connect visualizer after disconnect
            AudioInputCapture.getInstance().captureInput(id, node)

            // Speaker Sink
            const speakerConns = this.config.connections.filter((c) => c.from === id && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_")))
            speakerConns.forEach((c) => {
                if (c.to === "speaker_default") {
                    if (this.audioCtx) {
                        node.connect(this.audioCtx.destination)
                        AudioInputCapture.getInstance().captureInput("speaker_default", node)
                    }
                } else if (c.to.startsWith("speaker_sub_")) {
                    const targetSpeaker = speakerSubMergers.get(c.to)
                    if (targetSpeaker) {
                        const channelIndex = (c as any).channelIndex ?? 0
                        // Connect source merger to target speaker pin
                        node.connect(targetSpeaker.mergerNode, 0, channelIndex)
                    }
                }
            })

            // Network Sink
            const networkConns = this.config.connections.filter((c) => c.from === id && (c.to === "network_default" || c.to === "icecast" || c.to.startsWith("network_sub_")))
            if (networkConns.length > 0 && this.destinationNode) {
                node.connect(this.destinationNode)
                networkConns.forEach((c) => {
                    AudioInputCapture.getInstance().captureInput(c.to, node)
                })
            }
        })

        // 3. Connect each per-speaker merger to its sub-speaker AudioContext sink & visualizer capture
        speakerSubMergers.forEach(({ mergerNode, maxChannels }, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            const sink = this.getOrCreateSpeakerSink(deviceId)
            if (sink) {
                const streamDest = this.audioCtx!.createMediaStreamDestination()
                mergerNode.connect(streamDest)

                // Capture combined multi-channel output for speaker visualizer meter with exact channel count
                AudioInputCapture.getInstance().captureInput(targetId, mergerNode, maxChannels)

                const streamSource = sink.ctx.createMediaStreamSource(streamDest.stream)
                streamSource.connect(sink.ctx.destination)
                if (sink.ctx.state === "suspended") {
                    sink.ctx.resume().catch(() => {})
                }
            }
        })

        // Update Sink Visualizers
        if (this.masterNode) {
            AudioInputCapture.getInstance().captureInput("speaker_default", this.masterNode)
        }
        if (this.destinationNode) {
            AudioInputCapture.getInstance().captureInput("network_default", this.destinationNode)
            AudioInputCapture.getInstance().captureInput("icecast", this.destinationNode)
            this.config.connections.forEach((c) => {
                if (c.to.startsWith("network_sub_")) {
                    AudioInputCapture.getInstance().captureInput(c.to, this.destinationNode!)
                }
            })
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
        return this.config.connections.filter((c) => c.from === sourceId).map((c) => c.to)
    }

    public getConnectionsTo(targetId: string): string[] {
        return this.config.connections.filter((c) => c.to === targetId).map((c) => c.from)
    }

    public isConnected(fromId: string, toId: string): boolean {
        return this.config.connections.some((c) => c.from === fromId && c.to === toId)
    }

    /**
     * Register an active input node (e.g. from AudioAnalyser) so we can
     * update its connections in real-time when the routing config changes.
     */
    public registerInputNode(inputId: string, node: AudioNode) {
        console.log(`[AudioRoutingManager] registering input node for "${inputId}"`)
        if (!this.inputNodes.has(inputId)) {
            this.inputNodes.set(inputId, new Set())
        }
        this.inputNodes.get(inputId)!.add(node)
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
