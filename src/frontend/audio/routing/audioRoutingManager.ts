import { get } from "svelte/store"
import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { keysToID } from "../../components/helpers/array"
import { audioChannelsData, audioEffects, audioRouting, outputs } from "../../stores"
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

interface SubSpeakerStream {
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
    dispose: () => void
}

interface Connection {
    from: string
    to: string
    channelIndex?: number
}

type SubSpeakerMap = Map<string, { speakerNode: ChannelMergerNode; maxChannels: number }>

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
    private config: AudioRoutingConfig = { channels: [], connections: [] }
    private audioCtx: AudioContext | null = null
    private updateScheduled = false

    // gain nodes = channel nodes
    private gainNodes = new Map<string, GainNode>()
    private delayNodes = new Map<string, DelayNode>()
    private effectChains = new Map<string, { firstInput: AudioNode; output: AudioNode; segments: EffectChainSegment[]; topologyHash: string; dispose: () => void }>()

    private inputNodes = new Map<string, Set<AudioNode>>()
    private destinationNodes = new Map<string, AudioNode>()
    private recorderDestinations = new Map<string, MediaStreamAudioDestinationNode>()
    private outputNodes = new Map<string, AudioNode>()

    private speakerSinks = new Map<string, SpeakerSink>()
    private speakerStreams = new Map<string, SubSpeakerStream>()

    private constructor() {
        let previousOutputsCount = 0
        outputs.subscribe((a) => {
            const count = Object.keys(a).length
            if (count !== previousOutputsCount) {
                previousOutputsCount = count
                this.updateRoutingNodes()
            }
        })

        audioRouting.subscribe((a) => {
            if (!a) return

            a.connections = deduplicateConnections(a.connections)
            this.config = a

            this.updateRoutingNodes()
            AudioAnalyser.recorderActivate()

            if (a.desktopAudioEnabled) AudioInputCapture.getInstance().captureDesktopAudio("desktop_default")
            else AudioInputCapture.getInstance().stopDesktopAudio()
        })

        audioChannelsData.subscribe((data) => data && this.updateAllGains())
        audioEffects.subscribe(() => this.audioCtx && this.updateRoutingNodes())

        // const triggerUpdate = () => {
        //     AudioAnalyser.recorderActivate()
        //     this.updateRoutingNodes()
        // }

        // disabledServers.subscribe(triggerUpdate)
        // serverData.subscribe(triggerUpdate)
        // special.subscribe(triggerUpdate)
    }

    private static instance: AudioRoutingManager
    public static getInstance(): AudioRoutingManager {
        return (AudioRoutingManager.instance ??= new AudioRoutingManager())
    }

    setAudioContext(ctx: AudioContext) {
        if (this.audioCtx === ctx) return
        this.audioCtx = ctx
        this.cleanup()

        this.updateRoutingNodes()
    }

    setDestinationNode(targetId: string, node: AudioNode) {
        if (this.destinationNodes.get(targetId) === node) return
        this.destinationNodes.set(targetId, node)
        this.updateRoutingNodes()
    }

    private cleanup() {
        this.removeAllEffectChains()

        this.destinationNodes.forEach(this.disconnect)
        this.destinationNodes.clear()

        this.outputNodes.clear()
    }

    private connect(source: AudioNode, destination: AudioNode) {
        try {
            source.connect(destination)
        } catch {
            console.error(`[AudioRoutingManager] Failed to connect source to destination.`)
        }
    }

    private disconnect(node?: AudioNode) {
        if (!node) return

        try {
            node.disconnect()
        } catch {
            console.warn(`[AudioRoutingManager] Could not disconnect node.`)
        }

        AudioInputCapture.getInstance().onNodeDisconnected(node)
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

        this.speakerStreams.forEach((stream, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            if (activeDeviceIds.has(deviceId)) return

            this.stopSpeakerStream(stream)
            this.speakerStreams.delete(targetId)
        })
    }

    private stopSpeakerStream(stream: SubSpeakerStream) {
        try {
            stream.streamDest.stream.getAudioTracks().forEach((track) => track.stop())
            stream.streamDest.disconnect()
            stream.streamSource.disconnect()
        } catch {}
    }

    private applyGain(id: string, gainNode: GainNode) {
        if (!this.audioCtx) return

        const chData = get(audioChannelsData)[id] || {}
        const vol = this.getChannelVolume(id)

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
        const delayNode = this.delayNodes.get(id)
        if (delayNode) {
            try {
                delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx.currentTime)
            } catch {}
            if (delaySec === 0) this.updateRoutingNodes()
        } else if (delaySec > 0) {
            this.updateRoutingNodes()
        }
    }

    private updateAllGains() {
        if (!this.audioCtx) return
        this.gainNodes.forEach((node, id) => this.applyGain(id, node))
    }

    private getChainTopologyHash(channelEffects: any): string {
        const stack = channelEffects?.stack || []
        if (!stack.length) return ""

        const parts: string[] = []
        for (const item of stack) {
            if (item?.enabled !== false) parts.push(`${item.id}:${item.type}`)
        }
        return parts.join("|")
    }

    private buildEffectChain(id: string, node: GainNode, channelEffects: any): AudioNode {
        if (!this.audioCtx) return node

        const topologyHash = this.getChainTopologyHash(channelEffects)
        const existingChain = this.effectChains.get(id)
        if (existingChain?.topologyHash === topologyHash) {
            const stack = channelEffects?.stack || []
            for (const seg of existingChain.segments) {
                const item = stack.find((s: any) => s.id === seg.id)
                if (item?.config) seg.instance?.updateConfig?.(item.config)
            }

            this.disconnect(existingChain.firstInput)
            this.connect(node, existingChain.firstInput)

            return existingChain.output
        }

        this.removeEffectChain(id)

        if (!channelEffects || topologyHash === "") return node

        const chain: EffectChainSegment[] = []
        const stack = channelEffects?.stack || []
        for (const item of stack) {
            if (item?.enabled === false || !item?.config) continue

            const EffectClass = EFFECT_CLASSES[item.type]
            if (!EffectClass) continue

            const instance = new EffectClass(this.audioCtx, item.config)
            if (!instance.input || !instance.output) continue

            chain.push({
                id: item.id,
                type: item.type,
                input: instance.input,
                output: instance.output,
                instance,
                dispose: () => instance.dispose?.()
            })
        }

        if (chain.length === 0) return node

        let prev: AudioNode = node
        for (const seg of chain) {
            this.connect(prev, seg.input)
            prev = seg.output
        }

        this.effectChains.set(id, {
            firstInput: chain[0].input,
            output: prev,
            segments: chain,
            topologyHash,
            dispose: () => {
                chain.forEach((seg) => {
                    this.disconnect(seg.output)
                    seg.dispose()
                })
            }
        })

        return prev
    }

    private removeAllEffectChains() {
        this.effectChains.forEach((chain) => chain.dispose())
        this.effectChains.clear()
    }

    private removeEffectChain(id: string) {
        const chain = this.effectChains.get(id)
        if (!chain) return

        chain.dispose()
        this.effectChains.delete(id)
    }

    updateRoutingNodes() {
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
        const activeChannels = (this.config.channels || []).filter((m) => !inactiveChannelIds.has(m.id))

        this.syncGainNodes(activeChannels)
        this.cleanupRemovedChannels(new Set(activeChannels.map((m) => m.id)))

        const connections = (this.config.connections || []) as Connection[]
        const connectionsByFrom = this.indexActiveNodesAndConnections(connections)
        const subSpeakers = this.buildSubSpeakers(connections)

        this.routeOutputNodes(connectionsByFrom, subSpeakers)
        this.connectSpeakerSinks(subSpeakers)
        this.routeInputNodes()

        const duration = performance.now() - startTime
        if (duration > 15) console.warn(`[AudioRoutingManager] Lag detected: Audio routing update took ${duration.toFixed(2)}ms`)
    }

    private syncGainNodes(activeChannels: Array<{ id: string }>) {
        // "main" channel must always exist
        const allChannelIds = ["main", ...new Set(activeChannels.map((c) => c.id))]
        allChannelIds.forEach((id) => {
            let gainNode = this.gainNodes.get(id)

            if (!gainNode) {
                gainNode = this.audioCtx!.createGain()
                this.gainNodes.set(id, gainNode)
            }

            this.applyGain(id, gainNode)
        })
    }

    private cleanupRemovedChannels(currentChannelIds: Set<string>) {
        this.gainNodes.forEach((node, id) => {
            // "main" channel should never be removed
            if (id === "main") return
            if (currentChannelIds.has(id)) return

            this.disconnect(node)
            this.disconnect(this.delayNodes.get(id))
            AudioInputCapture.getInstance().removeInput(id)
            this.removeEffectChain(id)

            this.recorderDestinations.delete(id)
            this.gainNodes.delete(id)
            this.delayNodes.delete(id)
            this.outputNodes.delete(id)
        })
    }

    private indexActiveNodesAndConnections(connections: Connection[]) {
        const activeNodeIds = new Set(["drawer_audio", "playlists_default", "output_window", "mic_default", ...this.inputNodes.keys(), ...this.gainNodes.keys()])
        const activeSubDeviceIds = new Set<string>()
        const connectionsByFrom = new Map<string, Connection[]>()

        for (const c of connections) {
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

        return connectionsByFrom
    }

    private buildSubSpeakers(connections: Connection[]): SubSpeakerMap {
        const subSpeakers: SubSpeakerMap = new Map()

        for (const c of connections) {
            if (!c.to.startsWith("speaker_sub_")) continue

            const chIndex = c.channelIndex ?? 0
            const current = subSpeakers.get(c.to)
            const count = Math.max(current?.maxChannels || 2, chIndex + 1)

            if (!current || count > current.maxChannels) {
                subSpeakers.set(c.to, {
                    speakerNode: this.audioCtx!.createChannelMerger(count),
                    maxChannels: count
                })
            }
        }

        return subSpeakers
    }

    private buildProcessedOutputNode(id: string, node: GainNode, allEffects: any, allChannelData: any): AudioNode {
        let outNode = this.buildEffectChain(id, node, allEffects[id])
        if (outNode !== node) this.disconnect(outNode)

        const chData = allChannelData[id] || {}
        const delaySec = Math.max(0, Math.min(5, (chData.delay || 0) / 1000))

        if (delaySec > 0) {
            let delayNode = this.delayNodes.get(id)
            if (!delayNode) {
                delayNode = this.audioCtx!.createDelay(5.0)
                this.delayNodes.set(id, delayNode)
            }
            delayNode.delayTime.setValueAtTime(delaySec, this.audioCtx!.currentTime)

            this.disconnect(delayNode)
            this.connect(outNode, delayNode)
            outNode = delayNode
        }

        return outNode
    }

    private routeOutputNodes(connectionsByFrom: Map<string, Connection[]>, subSpeakers: SubSpeakerMap) {
        const allEffects = get(audioEffects) || {}
        const allChannelData = get(audioChannelsData) || {}

        this.gainNodes.forEach((node, id) => {
            this.disconnect(node)

            const outNode = this.buildProcessedOutputNode(id, node, allEffects, allChannelData)
            this.outputNodes.set(id, outNode)

            AudioInputCapture.getInstance().captureInput(id, outNode)

            const recDest = this.recorderDestinations.get(id)
            if (recDest) this.connect(outNode, recDest)

            const conns = connectionsByFrom.get(id) || []

            // main speaker out
            if (conns.some((c) => c.to === "speaker_default")) {
                let speakerNode = this.destinationNodes.get("speaker_default")
                if (!speakerNode) {
                    // speakerNode = AudioAnalyser.getOrCreateDestinationNode("speaker_default")
                    speakerNode = this.audioCtx!.createGain()
                    this.connect(speakerNode, this.audioCtx!.destination)
                    this.destinationNodes.set("speaker_default", speakerNode)
                }
                if (speakerNode) this.connect(outNode, speakerNode)

                AudioInputCapture.getInstance().captureInput("speaker_default", outNode)
            }

            // sub speaker out
            subSpeakers.forEach(({ speakerNode, maxChannels }, targetId) => {
                const subConns = conns.filter((c) => c.to === targetId)

                if (subConns.length === 1) {
                    outNode.connect(speakerNode, 0, subConns[0].channelIndex ?? 0)
                } else if (subConns.length > 1) {
                    const splitter = this.audioCtx!.createChannelSplitter(maxChannels)
                    outNode.connect(splitter)
                    subConns.forEach((c) => {
                        const chIdx = c.channelIndex ?? 0
                        if (chIdx < maxChannels) splitter.connect(speakerNode, chIdx, chIdx)
                    })
                }
            })

            // network destinations
            conns
                .filter((c) => c.to.startsWith("network_sub_"))
                .forEach((c) => {
                    const targetKey = c.to.replace("network_sub_", "")
                    let destNode = this.destinationNodes.get(targetKey)
                    if (!destNode) destNode = AudioAnalyser.getOrCreateDestinationNode(targetKey)
                    if (destNode) this.connect(outNode, destNode)

                    AudioInputCapture.getInstance().captureInput(c.to, outNode)
                })

            // Icecast
            if (conns.some((c) => c.to === "icecast")) {
                let icecastNode = this.destinationNodes.get("icecast")
                if (!icecastNode) icecastNode = AudioAnalyser.getOrCreateDestinationNode("icecast")
                if (icecastNode) this.connect(outNode, icecastNode)

                setTimeout(() => {
                    AudioInputCapture.getInstance().captureInput("icecast", outNode)
                })
            }
        })
    }

    private connectSpeakerSinks(subSpeakers: SubSpeakerMap) {
        subSpeakers.forEach(({ speakerNode, maxChannels }, targetId) => {
            const deviceId = targetId.replace("speaker_sub_", "")
            const sink = this.getOrCreateSpeakerSink(deviceId)
            if (!sink) return

            const prev = this.speakerStreams.get(targetId)
            if (prev && prev.maxChannels === maxChannels) {
                this.connect(speakerNode, prev.streamDest)
                AudioInputCapture.getInstance().captureInput(targetId, speakerNode, maxChannels)
                return
            }

            if (prev) this.stopSpeakerStream(prev)

            const streamDest = this.audioCtx!.createMediaStreamDestination()
            streamDest.channelCount = maxChannels
            this.connect(speakerNode, streamDest)

            setTimeout(() => {
                AudioInputCapture.getInstance().captureInput(targetId, speakerNode, maxChannels)
            })

            const streamSource = sink.ctx.createMediaStreamSource(streamDest.stream)
            this.connect(streamSource, sink.ctx.destination)
            if (sink.ctx.state === "suspended") {
                sink.ctx.resume().catch(() => {})
            }

            this.speakerStreams.set(targetId, { streamDest, streamSource, maxChannels })
        })
    }

    private routeInputNodes() {
        const nodeToIds = new Map<AudioNode, Set<string>>()
        this.inputNodes.forEach((nodes, inputId) => {
            nodes.forEach((node) => {
                if (!nodeToIds.has(node)) nodeToIds.set(node, new Set())
                nodeToIds.get(node)!.add(inputId)
            })
        })

        nodeToIds.forEach((inputIds, node) => {
            this.disconnect(node)
            const targetIds = new Set<string>()

            inputIds.forEach((inputId) => {
                AudioInputCapture.getInstance().captureInput(inputId, node)
                this.getConnectionsFrom(inputId).forEach((id) => targetIds.add(id))
            })

            targetIds.forEach((id) => {
                const gainNode = this.getGainNode(id)
                if (gainNode) this.connect(node, gainNode)
            })
        })
    }

    private routeInput(inputId: string, inputNode: AudioNode) {
        AudioInputCapture.getInstance().captureInput(inputId, inputNode)

        const targets = this.getConnectionsFrom(inputId)

        targets.forEach((id) => {
            const gainNode = this.getGainNode(id)
            if (gainNode) this.connect(inputNode, gainNode)
        })
    }

    private getGainNode(id: string): GainNode | null {
        if (!this.audioCtx) return null

        let node = this.gainNodes.get(id)
        if (!node) {
            node = this.audioCtx.createGain()
            this.gainNodes.set(id, node)
            this.applyGain(id, node)
        }

        return node
    }

    private getConnectionsFrom(sourceId: string): string[] {
        const inactiveChannelIds = this.getInactiveChannelIds()
        if (inactiveChannelIds.has(sourceId)) return []

        return this.config.connections.filter((c) => c.from === sourceId && !inactiveChannelIds.has(c.to)).map((c) => c.to)
    }

    getInputNodes(inputId: string): AudioNode[] {
        const nodes = this.inputNodes.get(inputId)
        return nodes ? Array.from(nodes) : []
    }

    registerInputNode(inputId: string, node: AudioNode) {
        if (!this.inputNodes.has(inputId)) this.inputNodes.set(inputId, new Set())
        const nodes = this.inputNodes.get(inputId)!
        if (nodes.has(node)) return

        nodes.add(node)
        this.routeInput(inputId, node)
    }

    unregisterInputNode(inputId: string, node?: AudioNode) {
        const nodes = this.inputNodes.get(inputId)
        if (!nodes) return

        if (!node) {
            nodes.forEach(this.disconnect)
            this.inputNodes.delete(inputId)
            return
        }

        if (nodes.has(node)) {
            this.disconnect(node)
            nodes.delete(node)
        }

        if (nodes.size === 0) {
            this.inputNodes.delete(inputId)
        }
    }

    registerChannelRecorder(channelId: string, dest: MediaStreamAudioDestinationNode) {
        this.recorderDestinations.set(channelId, dest)
        const outNode = this.getChannelOutputNode(channelId)
        if (!outNode) return

        this.connect(outNode, dest)
    }

    unregisterChannelRecorder(channelId: string, dest?: MediaStreamAudioDestinationNode) {
        const current = this.recorderDestinations.get(channelId)
        if (!current) return
        if (dest && current !== dest) return

        try {
            const outNode = this.getChannelOutputNode(channelId)
            if (outNode) outNode.disconnect(current)
        } catch {}
        this.recorderDestinations.delete(channelId)
    }

    private getChannelOutputNode(channelId: string): AudioNode | null {
        return this.outputNodes.get(channelId) || this.gainNodes.get(channelId) || null
    }

    private getChannelVolume(channelId: string) {
        const channel = get(audioChannelsData)[channelId]
        if (!channel) return 1

        let volume = Number(channel.volume ?? 1)
        if (volume > 5) volume = volume / 100 // in case a 0-100 value was set instead of 0-1
        if (volume > 5) volume = 1

        return Math.max(0, Math.min(5, volume))
    }

    public static sortChannels(config: AudioRoutingConfig): AudioRoutingConfig {
        if (!config?.channels || config.channels.length <= 1) return config

        const mainChannel: typeof config.channels = []
        const unlinkedChannels: typeof config.channels = []
        const outputLinkedChannels: typeof config.channels = []

        const outputsMap = get(outputs) || {}
        const isLinkedToOutput = (id: string) => outputsMap[id.split("_")?.[1]]

        for (const ch of config.channels) {
            if (ch.id === "main") mainChannel.push(ch)
            else if (isLinkedToOutput(ch.id)) outputLinkedChannels.push(ch)
            else unlinkedChannels.push(ch)
        }

        const sortByName = (a: any, b: any) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })

        unlinkedChannels.sort(sortByName)
        outputLinkedChannels.sort(sortByName)

        return { ...config, channels: [...mainChannel, ...unlinkedChannels, ...outputLinkedChannels] }
    }
}
