import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { audioRouting } from "../../stores"
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

    public updateRoutingNodes() {
        if (!this.audioCtx) return

        // Ensure all configured mergers have corresponding GainNode instances
        this.config.mergers.forEach((m) => {
            if (!this.mergerNodes.has(m.id)) {
                this.mergerNodes.set(m.id, this.audioCtx!.createGain())
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

        // Connect mergers to sinks (Speakers / Network)
        this.mergerNodes.forEach((node, id) => {
            try {
                node.disconnect()
            } catch (e) {}

            // Re-connect visualizer after disconnect
            AudioInputCapture.getInstance().captureInput(id, node)

            // Speaker Sink
            const targetsSpeakers = this.config.connections.some((c) => c.from === id && (c.to === "speaker_default" || c.to.startsWith("speaker_sub_")))
            if (targetsSpeakers && this.masterNode) {
                node.connect(this.masterNode)
            }

            // Network Sink
            const targetsNetwork = this.config.connections.some((c) => c.from === id && (c.to === "network_default" || c.to === "icecast" || c.to.startsWith("network_sub_")))
            if (targetsNetwork && this.destinationNode) {
                node.connect(this.destinationNode)
            }
        })

        // Update Sink Visualizers
        if (this.masterNode) {
            AudioInputCapture.getInstance().captureInput("speaker_default", this.masterNode)
        }
        if (this.destinationNode) {
            AudioInputCapture.getInstance().captureInput("network_default", this.destinationNode)
            AudioInputCapture.getInstance().captureInput("icecast", this.destinationNode)
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
