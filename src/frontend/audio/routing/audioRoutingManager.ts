import { get } from "svelte/store"
import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { keysToID } from "../../components/helpers/array"
import { audioChannelsData, audioEffects, audioRouting, disabledServers, outputs, serverData, special } from "../../stores"
import { AudioAnalyser } from "../audioAnalyser"
import { AudioCompressor } from "../effects/audioCompressor"
import { AudioDelay } from "../effects/audioDelay"
import { AudioEqualizer } from "../effects/audioEqualizer"
import { AudioFilter } from "../effects/audioFilter"
import { AudioLimiter } from "../effects/audioLimiter"
import { AudioNoiseGate } from "../effects/audioNoiseGate"
import { AudioReverb } from "../effects/audioReverb"
import { AudioStereoShaper } from "../effects/audioStereoShaper"
import { AudioInputCapture } from "./audioInputCapture"
import { deduplicateConnections } from "./audioRoutingInit"

interface SpeakerSink {
    ctx: AudioContext
    element: HTMLAudioElement
}

interface SpeakerSubStream {
    streamDest: MediaStreamAudioDestinationNode
    streamSource: MediaStreamAudioSourceNode
    maxChannels: number
}

interface EffectChainSegment {
    id: string
    type: string
    input: AudioNode
    output: AudioNode
    instance: any
    dispose?: () => void
}

interface Connection {
    from: string
    to: string
    channelIndex?: number
}

const EFFECT_CLASSES: Record<string, any> = {
    equalizer: AudioEqualizer,
    filter: AudioFilter,
    noiseGate: AudioNoiseGate,
    compressor: AudioCompressor,
    reverb: AudioReverb,
    delay: AudioDelay,
    limiter: AudioLimiter,
    stereoShaper: AudioStereoShaper
}

export class AudioRoutingManager {
    private static instance: AudioRoutingManager
    private config: AudioRoutingConfig = { channels: [], connections: [] }
    private audioCtx: AudioContext | null = null

    private mergerNodes = new Map<string, GainNode>()
    private channelDelayNodes = new Map<string, DelayNode>()
    private mergerEffectChains = new Map<string, { firstInput: AudioNode; output: AudioNode; segments: EffectChainSegment[]; topologyHash: string; dispose: () => void }>()
    private destinationNodes = new Map<string, AudioNode>()
    private inputNodes = new Map<string, Set<AudioNode>>()
    private channelRecorderDestinations = new Map<string, MediaStreamAudioDestinationNode>()
    private channelOutputNodes = new Map<string, AudioNode>()

    private speakerSinks = new Map<string, SpeakerSink>()
    private speakerSubStreams = new Map<string, SpeakerSubStream>()
    private updateScheduled = false

    private constructor() {
        outputs.subscribe(() => this.updateRoutingNodes())

        audioRouting.subscribe((val) => {
            if (!val) return
            val.connections = deduplicateConnections(val.connections)
            this.config = val
            this.updateRoutingNodes()
            AudioAnalyser.recorderActivate()

            if (val.desktopAudioEnabled) {
                AudioInputCapture.getInstance().captureDesktopAudio("desktop_default")
            } else {
                AudioInputCapture.getInstance().stopDesktopAudio("screen:0:0")
            }
        })

        audioChannelsData.subscribe((data) => data && this.updateAllGains())
        audioEffects.subscribe(() => this.audioCtx && this.updateRoutingNodes())

        const triggerUpdate = () => {
            AudioAnalyser.recorderActivate()
            this.updateRoutingNodes()
        }

        disabledServers.subscribe(triggerUpdate)
        serverData.subscribe(triggerUpdate)
        special.subscribe(triggerUpdate)
    }

    public static getInstance(): AudioRoutingManager {
        return (AudioRoutingManager.instance ??= new AudioRoutingManager())
    }

    public setAudioContext(ctx: AudioContext) {
        if (this.audioCtx === ctx) return
        this.audioCtx = ctx

        try {
            if (!this.destinationNodes.has("main")) {
                const mainGain = this.audioCtx.createGain()
                mainGain.connect(this.audioCtx.destination)
                this.destinationNodes.set("main", mainGain)
            }
        } catch {}

        this.updateRoutingNodes()
    }

    public setDestinationNode(targetId: string, node: AudioNode) {
        if (this.destinationNodes.get(targetId) === node) return
        this.destinationNodes.set(targetId, node)
        this.updateRoutingNodes()
    }

    private safelyDisconnect(node?: AudioNode) {
        if (!node) return
        try {
            node.disconnect()
            AudioInputCapture.getInstance().onNodeDisconnected(node)
        } catch {}
    }

    private getInactiveChannelIds(): Set<string> {
        const allOuts = keysToID(get(outputs) || {})
        return new Set(allOuts.filter((out) => !out.enabled).map((out) => `channel_${out.id}`))
    }

    private getOrCreateSpeakerSink(deviceId: string): SpeakerSink | null {
        if (this.speakerSinks.has(deviceId)) return this.speakerSinks.get(deviceId)!

        try {
            const ctx = new AudioContext({ latencyHint: "playback" })
            if ("setSinkId" in ctx) {
                ;(ctx as any).setSinkId(deviceId).catch((e: any) => console.error(`[AudioRoutingManager] Failed to set sinkId ${deviceId}:`, e))
            }
            const element = new Audio()
            element.muted = true

            const sink = { ctx, element }
            this.speakerSinks.set(deviceId, sink)
            return sink
        } catch (e) {
            console.error(`[AudioRoutingManager] Could not create sink for device ${deviceId}:`, e)
            return null
        }
    }

    private cleanupUnusedSpeakerSinks(activeDeviceIds: Set<string>) {
        this.speakerSinks.forEach((sink, deviceId) => {
            if (!activeDeviceIds.has(deviceId)) {
                try {
                    sink.element.pause()
                    sink.element.srcObject = null
                    sink.element.removeAttribute("src")
                    sink.ctx.close()
                } catch {}
                this.speakerSinks.delete(deviceId)
            }
        })

        this.speakerSubStreams.forEach((sub, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            if (!activeDeviceIds.has(deviceId)) {
                this.teardownSubStream(sub)
                this.speakerSubStreams.delete(targetId)
            }
        })
    }

    private teardownSubStream(sub: SpeakerSubStream) {
        try {
            sub.streamDest.stream.getAudioTracks().forEach((track) => track.stop())
            sub.streamDest.disconnect()
            sub.streamSource.disconnect()
        } catch {}
    }

    private applyMergerGain(id: string, gainNode: GainNode) {
        if (!this.audioCtx) return
        const chData = get(audioChannelsData)[id] || {}

        let vol = chData.volume ?? 1
        if (vol > 5) vol /= 100

        const targetGain = chData.isMuted ? 0 : Math.max(0, vol)
        try {
            const currentTime = this.audioCtx.currentTime
            const currentGain = gainNode.gain.value

            // when changing volume (or mute state) fade for 250ms instead of cutting
            if (Math.abs(currentGain - targetGain) > 0.001) {
                gainNode.gain.cancelScheduledValues(currentTime)
                gainNode.gain.setValueAtTime(currentGain, currentTime)
                gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + 0.25)
            } else {
                gainNode.gain.setValueAtTime(targetGain, currentTime)
            }
        } catch {}

        const delaySec = Math.max(0, Math.min(5, (chData.delay || 0) / 1000))
        const delayNode = this.channelDelayNodes.get(id)

        if (delaySec > 0 && !delayNode) {
            this.updateRoutingNodes()
        } else if (delayNode) {
            try {
                delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx.currentTime)
            } catch {}
        }
    }

    public updateAllGains() {
        if (!this.audioCtx) return
        this.mergerNodes.forEach((node, id) => this.applyMergerGain(id, node))
    }

    private getChainTopologyHash(channelEffects: any): string {
        const stack = channelEffects?.stack || []
        if (!stack.length) return ""

        const parts: string[] = []
        for (const item of stack) {
            if (item?.enabled !== false) {
                parts.push(`${item.id}:${item.type}`)
            }
        }
        return parts.join("|")
    }

    private buildMergerEffectChain(id: string, node: GainNode, channelEffects: any): AudioNode {
        if (!this.audioCtx) return node

        const topologyHash = this.getChainTopologyHash(channelEffects)
        const existingChain = this.mergerEffectChains.get(id)

        if (existingChain) {
            if (existingChain.topologyHash === topologyHash) {
                const stack = channelEffects?.stack || []
                for (const seg of existingChain.segments) {
                    const item = stack.find((s: any) => s.id === seg.id)
                    if (item?.config && seg.instance?.updateConfig) {
                        seg.instance.updateConfig(item.config)
                    }
                }
                node.connect(existingChain.firstInput)
                return existingChain.output
            }
            existingChain.dispose()
            this.mergerEffectChains.delete(id)
        }

        if (!channelEffects || topologyHash === "") return node

        const chain: EffectChainSegment[] = []
        const stack = channelEffects?.stack || []
        for (const item of stack) {
            if (item?.enabled === false) continue

            const EffectClass = EFFECT_CLASSES[item.type]
            if (EffectClass && item.config) {
                const instance = new EffectClass(this.audioCtx, item.config)
                if (instance.input && instance.output) {
                    chain.push({
                        id: item.id,
                        type: item.type,
                        input: instance.input,
                        output: instance.output,
                        instance,
                        dispose: () => instance.dispose?.()
                    })
                }
            }
        }

        if (chain.length === 0) return node

        let prev: AudioNode = node
        for (const seg of chain) {
            prev.connect(seg.input)
            prev = seg.output
        }

        this.mergerEffectChains.set(id, {
            firstInput: chain[0].input,
            output: prev,
            segments: chain,
            topologyHash,
            dispose: () => {
                chain.forEach((seg) => {
                    this.safelyDisconnect(seg.output)
                    seg.dispose?.()
                })
            }
        })

        return prev
    }

    public updateRoutingNodes() {
        if (!this.audioCtx || this.updateScheduled) return
        this.updateScheduled = true

        requestAnimationFrame(() => {
            if (!this.updateScheduled) return
            this.updateScheduled = false
            this.executeRoutingUpdate()
        })
    }

    private executeRoutingUpdate() {
        if (!this.audioCtx) return
        const startTime = performance.now()
        const inactiveChannelIds = this.getInactiveChannelIds()

        // 1. Manage merger gain nodes for active channels
        const channels = (this.config.channels || []).filter((m) => !inactiveChannelIds.has(m.id))
        channels.forEach((m) => {
            let gainNode = this.mergerNodes.get(m.id)
            if (!gainNode) {
                gainNode = this.audioCtx!.createGain()
                this.mergerNodes.set(m.id, gainNode)
            }
            this.applyMergerGain(m.id, gainNode)
        })

        // 2. Clean up removed channels and their cached effect chains & recorder destinations
        const currentChannelIds = new Set(channels.map((m) => m.id))
        this.mergerNodes.forEach((node, id) => {
            if (!currentChannelIds.has(id)) {
                this.safelyDisconnect(node)
                this.safelyDisconnect(this.channelDelayNodes.get(id))
                AudioInputCapture.getInstance().removeInput(id)

                const chain = this.mergerEffectChains.get(id)
                if (chain) {
                    chain.dispose()
                    this.mergerEffectChains.delete(id)
                }

                this.channelRecorderDestinations.delete(id)
                this.mergerNodes.delete(id)
                this.channelDelayNodes.delete(id)
                this.channelOutputNodes.delete(id)
            }
        })

        // 3. Pre-index active connections
        const activeNodeIds = new Set(["drawer_audio", "playlists_default", "output_window", "mic_default", ...this.inputNodes.keys(), ...this.mergerNodes.keys()])
        const activeSubDeviceIds = new Set<string>()
        const connectionsByFrom = new Map<string, Connection[]>()

        const rawConns = (this.config.connections || []) as Connection[]
        for (const c of rawConns) {
            activeNodeIds.add(c.from)
            activeNodeIds.add(c.to)

            if (c.to.startsWith("speaker_sub_")) {
                activeSubDeviceIds.add(c.to.replace("speaker_sub_", ""))
            }

            let list = connectionsByFrom.get(c.from)
            if (!list) {
                list = []
                connectionsByFrom.set(c.from, list)
            }
            list.push(c)
        }

        AudioInputCapture.getInstance().pruneStaleInputs(activeNodeIds)
        this.cleanupUnusedSpeakerSinks(activeSubDeviceIds)

        // 4. Pre-calculate per-speaker merger channels
        const speakerSubMergers = new Map<string, { mergerNode: ChannelMergerNode; maxChannels: number }>()
        for (const c of rawConns) {
            if (c.to.startsWith("speaker_sub_")) {
                const chIndex = c.channelIndex ?? 0
                const current = speakerSubMergers.get(c.to)
                const count = Math.max(current?.maxChannels || 2, chIndex + 1)

                if (!current || count > current.maxChannels) {
                    speakerSubMergers.set(c.to, {
                        mergerNode: this.audioCtx.createChannelMerger(count),
                        maxChannels: count
                    })
                }
            }
        }

        // 5. Route merger output nodes
        const allEffects = get(audioEffects) || {}
        const allChannelData = get(audioChannelsData) || {}

        this.mergerNodes.forEach((node, id) => {
            this.safelyDisconnect(node)
            let outNode = this.buildMergerEffectChain(id, node, allEffects[id])
            if (outNode !== node) this.safelyDisconnect(outNode)

            const chData = allChannelData[id] || {}
            const delaySec = Math.max(0, Math.min(5, (chData.delay || 0) / 1000))

            if (delaySec > 0) {
                let delayNode = this.channelDelayNodes.get(id)
                if (!delayNode) {
                    delayNode = this.audioCtx!.createDelay(5.0)
                    this.channelDelayNodes.set(id, delayNode)
                }
                delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx!.currentTime)

                this.safelyDisconnect(delayNode)
                outNode.connect(delayNode)
                outNode = delayNode
            }

            this.channelOutputNodes.set(id, outNode)
            AudioInputCapture.getInstance().captureInput(id, outNode)

            const recDest = this.channelRecorderDestinations.get(id)
            if (recDest) {
                try {
                    outNode.connect(recDest)
                } catch (e) {
                    console.error(`[AudioRoutingManager] Could not connect outNode to channel recorder for ${id}:`, e)
                }
            }

            const conns = connectionsByFrom.get(id) || []

            // Connect to main destination if requested
            if (conns.some((c) => c.to === "speaker_default")) {
                const mainNode = this.destinationNodes.get("main")
                if (mainNode) {
                    try {
                        outNode.connect(mainNode)
                    } catch {}
                }
            }

            // Dedicated splitter per target speaker sub-merger
            speakerSubMergers.forEach(({ mergerNode }, targetId) => {
                const subConns = conns.filter((c) => c.to === targetId)

                if (subConns.length === 1) {
                    outNode.connect(mergerNode, 0, subConns[0].channelIndex ?? 0)
                } else if (subConns.length > 1) {
                    const splitter = this.audioCtx!.createChannelSplitter(2)
                    outNode.connect(splitter)
                    subConns.forEach((c) => {
                        const chIdx = c.channelIndex ?? 0
                        splitter.connect(mergerNode, Math.min(chIdx, 1), chIdx)
                    })
                }
            })

            // Network destinations
            conns
                .filter((c) => c.to === "icecast" || c.to.startsWith("network_sub_"))
                .forEach((c) => {
                    const targetKey = c.to.startsWith("network_sub_") ? c.to.replace("network_sub_", "") : c.to
                    let destNode = this.destinationNodes.get(targetKey)
                    if (!destNode) destNode = AudioAnalyser.getOrCreateDestinationNode(targetKey)
                    if (destNode) {
                        try {
                            outNode.connect(destNode)
                        } catch {}
                    }
                    AudioInputCapture.getInstance().captureInput(c.to, outNode)
                })
        })

        // 6. Connect speaker sinks
        speakerSubMergers.forEach(({ mergerNode, maxChannels }, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            const sink = this.getOrCreateSpeakerSink(deviceId)
            if (!sink) return

            const prev = this.speakerSubStreams.get(targetId)
            if (prev && prev.maxChannels === maxChannels) {
                mergerNode.connect(prev.streamDest)
                AudioInputCapture.getInstance().captureInput(targetId, mergerNode, maxChannels)
                return
            }

            if (prev) this.teardownSubStream(prev)

            const streamDest = this.audioCtx!.createMediaStreamDestination()
            streamDest.channelCount = maxChannels
            mergerNode.connect(streamDest)

            AudioInputCapture.getInstance().captureInput(targetId, mergerNode, maxChannels)

            const streamSource = sink.ctx.createMediaStreamSource(streamDest.stream)
            streamSource.connect(sink.ctx.destination)
            if (sink.ctx.state === "suspended") {
                sink.ctx.resume().catch(() => {})
            }

            this.speakerSubStreams.set(targetId, { streamDest, streamSource, maxChannels })
        })

        const duration = performance.now() - startTime
        if (duration > 15) {
            console.warn(`[AudioRoutingManager] Lag detected: Audio routing update took ${duration.toFixed(2)}ms (budget: 15ms)`)
        }

        // 7. Capture visualizers for destinations
        this.destinationNodes.forEach((destNode, targetKey) => {
            const visualizerKey = targetKey === "icecast" ? "icecast" : targetKey === "main" ? "speaker_default" : `network_sub_${targetKey}`
            AudioInputCapture.getInstance().captureInput(visualizerKey, destNode)
        })

        // 8. Route inputs
        const nodeToIds = new Map<AudioNode, Set<string>>()
        this.inputNodes.forEach((nodes, inputId) => {
            nodes.forEach((node) => {
                if (!nodeToIds.has(node)) nodeToIds.set(node, new Set())
                nodeToIds.get(node)!.add(inputId)
            })
        })

        nodeToIds.forEach((inputIds, node) => {
            this.safelyDisconnect(node)
            const targetMergerIds = new Set<string>()

            inputIds.forEach((inputId) => {
                AudioInputCapture.getInstance().captureInput(inputId, node)
                this.getConnectionsFrom(inputId).forEach((mergerId) => targetMergerIds.add(mergerId))
            })

            targetMergerIds.forEach((mergerId) => {
                const mergerNode = this.getMergerNode(mergerId)
                if (mergerNode) {
                    try {
                        node.connect(mergerNode)
                    } catch (e) {
                        console.error(`[AudioRoutingManager] Could not connect source to merger ${mergerId}:`, e)
                    }
                }
            })
        })
    }

    private routeInput(inputId: string, inputNode: AudioNode) {
        AudioInputCapture.getInstance().captureInput(inputId, inputNode)

        this.getConnectionsFrom(inputId).forEach((mergerId) => {
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
        const inactiveChannelIds = this.getInactiveChannelIds()
        if (inactiveChannelIds.has(sourceId)) return []

        return this.config.connections.filter((c) => c.from === sourceId && !inactiveChannelIds.has(c.to)).map((c) => c.to)
    }

    public getConnectionsTo(targetId: string): string[] {
        const inactiveChannelIds = this.getInactiveChannelIds()
        if (inactiveChannelIds.has(targetId)) return []

        return this.config.connections.filter((c) => c.to === targetId && !inactiveChannelIds.has(c.from)).map((c) => c.from)
    }

    public isConnected(fromId: string, toId: string): boolean {
        return this.config.connections.some((c) => c.from === fromId && c.to === toId)
    }

    public getInputNodes(inputId: string): AudioNode[] {
        const nodes = this.inputNodes.get(inputId)
        return nodes ? Array.from(nodes) : []
    }

    public registerInputNode(inputId: string, node: AudioNode) {
        if (!this.inputNodes.has(inputId)) this.inputNodes.set(inputId, new Set())
        const nodes = this.inputNodes.get(inputId)!
        if (nodes.has(node)) return
        nodes.add(node)
        this.routeInput(inputId, node)
    }

    public unregisterInputNode(inputId: string, node?: AudioNode) {
        const nodes = this.inputNodes.get(inputId)
        if (!nodes) return

        if (!node) {
            nodes.forEach((n) => {
                try {
                    n.disconnect()
                } catch {}
            })
            this.inputNodes.delete(inputId)
            return
        }

        if (nodes.has(node)) {
            try {
                node.disconnect()
            } catch {}
            nodes.delete(node)
        }

        if (nodes.size === 0) {
            this.inputNodes.delete(inputId)
        }
    }

    public registerChannelRecorder(channelId: string, dest: MediaStreamAudioDestinationNode) {
        this.channelRecorderDestinations.set(channelId, dest)
        const outNode = this.getChannelOutputNode(channelId)
        if (outNode) {
            try {
                outNode.connect(dest)
            } catch {}
        }
    }

    public unregisterChannelRecorder(channelId: string, dest?: MediaStreamAudioDestinationNode) {
        const current = this.channelRecorderDestinations.get(channelId)
        if (!current) return
        if (!dest || current === dest) {
            try {
                const outNode = this.getChannelOutputNode(channelId)
                if (outNode) {
                    outNode.disconnect(current)
                }
            } catch {}
            this.channelRecorderDestinations.delete(channelId)
        }
    }

    public getChannelOutputNode(channelId: string): AudioNode | null {
        return this.channelOutputNodes.get(channelId) || this.mergerNodes.get(channelId) || null
    }

    public static sortChannels(config: AudioRoutingConfig): AudioRoutingConfig {
        if (!config?.channels || config.channels.length <= 1) return config

        const mainChannels: typeof config.channels = []
        const unlinkedChannels: typeof config.channels = []
        const outputLinkedChannels: typeof config.channels = []

        const outputsMap = get(outputs) || {}
        const isLinkedToOutput = (id: string) => outputsMap[id.split("_")?.[1]]

        for (const ch of config.channels) {
            if (ch.id === "main") mainChannels.push(ch)
            else if (isLinkedToOutput(ch.id)) outputLinkedChannels.push(ch)
            else unlinkedChannels.push(ch)
        }

        const sortByName = (a: any, b: any) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })

        unlinkedChannels.sort(sortByName)
        outputLinkedChannels.sort(sortByName)

        return { ...config, channels: [...mainChannels, ...unlinkedChannels, ...outputLinkedChannels] }
    }
}
