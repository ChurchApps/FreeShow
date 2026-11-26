import { get } from "svelte/store"
import type { AudioRoutingConfig } from "../../../types/AudioRouting"
import { keysToID } from "../../components/helpers/array"
import { audioChannelsData, audioEffects, audioRouting, outputs } from "../../stores"
import { AudioAnalyser } from "../audioAnalyser"
import { AudioSidechain } from "../audioSidechain"
import { AudioCompressor } from "../effects/audioCompressor"
import { AudioDelay } from "../effects/audioDelay"
import { AudioEqualizer } from "../effects/audioEqualizer"
import { AudioFilter } from "../effects/audioFilter"
import { AudioLimiter } from "../effects/audioLimiter"
import { AudioNoiseGate } from "../effects/audioNoiseGate"
import { AudioReverb } from "../effects/audioReverb"
import { AudioStereoShaper } from "../effects/audioStereoShaper"
import { AudioInputCapture } from "./audioInputCapture"
import { deduplicateConnections, getConnectionFromChannel, getConnectionToChannel } from "./audioRoutingHelpers"

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
    fromChannelIndex?: number
    toChannelIndex?: number
    type?: "audio" | "sidechain"
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
    private static instance: AudioRoutingManager
    public static getInstance(): AudioRoutingManager {
        if (!AudioRoutingManager.instance) {
            AudioRoutingManager.instance = new AudioRoutingManager()
            AudioRoutingManager.instance.init()
        }
        return AudioRoutingManager.instance
    }

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

    private constructor() {}

    private init() {
        let prevOutputCount = 0
        outputs.subscribe((a) => {
            const count = Object.keys(a || {}).length
            if (count !== prevOutputCount) {
                prevOutputCount = count
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

        AudioSidechain.getInstance()
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
        for (const c of this.effectChains.values()) c.dispose()
        this.effectChains.clear()

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
        const set = new Set<string>()
        for (let i = 0; i < allOuts.length; i++) {
            if (!allOuts[i].enabled) set.add(`channel_${allOuts[i].id}`)
        }
        return set
    }

    private getOrCreateSpeakerSink(deviceId: string): SpeakerSink | null {
        if (this.speakerSinks.has(deviceId)) return this.speakerSinks.get(deviceId)!

        try {
            const ctx = new AudioContext({ latencyHint: "playback" })
            if ("setSinkId" in ctx) {
                ;(ctx as any).setSinkId(deviceId).catch((err: unknown) => {
                    console.warn(`[AudioRoutingManager] Could not set sink ID for device ${deviceId}:`, err)
                })
            }
            const element = new Audio()
            element.muted = true

            const sink = { ctx, element }
            this.speakerSinks.set(deviceId, sink)
            if (sink.ctx.destination.maxChannelCount > 2) {
                try {
                    sink.ctx.destination.channelCount = sink.ctx.destination.maxChannelCount
                    sink.ctx.destination.channelCountMode = "explicit"
                    sink.ctx.destination.channelInterpretation = "discrete"
                } catch {}
            }
            return sink
        } catch (e) {
            console.error(`[AudioRoutingManager] Could not create sink for device ${deviceId}:`, e)
            return null
        }
    }

    private cleanupUnusedSpeakerSinks(activeDeviceIds: Set<string>) {
        for (const [deviceId, sink] of this.speakerSinks.entries()) {
            if (!activeDeviceIds.has(deviceId)) {
                try {
                    sink.element.pause()
                    sink.element.srcObject = null
                    sink.ctx.close()
                } catch {}
                this.speakerSinks.delete(deviceId)
            }
        }

        for (const [targetId, stream] of this.speakerStreams.entries()) {
            if (!activeDeviceIds.has(targetId.replace("speaker_sub_", ""))) {
                this.stopSpeakerStream(stream)
                this.speakerStreams.delete(targetId)
            }
        }
    }

    private stopSpeakerStream(stream: SubSpeakerStream) {
        try {
            const tracks = stream.streamDest.stream.getAudioTracks()
            for (let i = 0; i < tracks.length; i++) tracks[i].stop()
            stream.streamDest.disconnect()
            stream.streamSource.disconnect()
        } catch {}
    }

    private applyGain(id: string, gainNode: GainNode, instant = false) {
        if (!this.audioCtx) return

        const chData = get(audioChannelsData)[id] || {}
        const vol = this.getChannelVolume(id)
        let targetGain = chData.isMuted ? 0 : Math.max(0, vol)

        const sidechainMult = this.channelSidechainMultipliers.get(id) ?? 1.0
        if (sidechainMult < 1.0) targetGain *= sidechainMult

        try {
            const currTime = this.audioCtx.currentTime
            const currGain = gainNode.gain.value

            // when changing volume (or mute state) fade instead of cutting
            const fadeDuration = chData.fadeDuration ?? 250
            if (!instant && fadeDuration > 0 && Math.abs(currGain - targetGain) > 0.001) {
                gainNode.gain.cancelScheduledValues(currTime)
                gainNode.gain.setValueAtTime(currGain, currTime)
                gainNode.gain.linearRampToValueAtTime(targetGain, currTime + fadeDuration / 1000)
            } else {
                gainNode.gain.cancelScheduledValues(currTime)
                gainNode.gain.setValueAtTime(targetGain, currTime)
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

    private channelSidechainMultipliers = new Map<string, number>()
    public setChannelSidechain(channelMultipliers: Map<string, number>) {
        if (!this.audioCtx) return

        const currTime = this.audioCtx.currentTime
        for (const [id, node] of this.gainNodes.entries()) {
            const mult = channelMultipliers.get(id) ?? 1.0
            const prevMult = this.channelSidechainMultipliers.get(id) ?? 1.0
            if (Math.abs(mult - prevMult) < 0.001) continue

            this.channelSidechainMultipliers.set(id, mult)
            const chData = get(audioChannelsData)[id] || {}
            const vol = this.getChannelVolume(id)
            const targetGain = (chData.isMuted ? 0 : Math.max(0, vol)) * mult

            try {
                node.gain.cancelScheduledValues(currTime)
                node.gain.setValueAtTime(node.gain.value, currTime)
                node.gain.linearRampToValueAtTime(targetGain, currTime + 0.04)
            } catch {}
        }
    }

    private updateAllGains() {
        if (!this.audioCtx) return
        for (const [id, node] of this.gainNodes.entries()) {
            this.applyGain(id, node)
        }
    }

    private buildEffectChain(id: string, node: GainNode, channelEffects: any): AudioNode {
        if (!this.audioCtx) return node

        const rawStack = channelEffects?.stack || []
        const stack: any[] = []
        for (let i = 0; i < rawStack.length; i++) {
            const s = rawStack[i]
            if (s?.enabled !== false && s?.config) stack.push(s)
        }

        const topologyHash = stack.map((s) => `${s.id}:${s.type}`).join("|")
        const existingChain = this.effectChains.get(id)
        if (existingChain && existingChain.topologyHash === topologyHash) {
            for (let i = 0; i < existingChain.segments.length; i++) {
                const seg = existingChain.segments[i]
                const item = stack.find((s) => s.id === seg.id)
                if (item?.config) seg.instance?.updateConfig?.(item.config)
            }

            this.connect(node, existingChain.firstInput)

            return existingChain.output
        }

        this.removeEffectChain(id)
        if (!stack.length) return node

        const chain: EffectChainSegment[] = []
        for (let i = 0; i < stack.length; i++) {
            const item = stack[i]
            const EffectClass = EFFECT_CLASSES[item.type]
            if (!EffectClass) continue

            const instance = new EffectClass(this.audioCtx, item.config)
            if (instance.input && instance.output) {
                chain.push({ id: item.id, type: item.type, input: instance.input, output: instance.output, instance, dispose: () => instance.dispose?.() })
            }
        }

        if (!chain.length) return node

        let prev: AudioNode = node
        for (let i = 0; i < chain.length; i++) {
            const seg = chain[i]
            this.connect(prev, seg.input)
            prev = seg.output
        }

        this.effectChains.set(id, {
            firstInput: chain[0].input,
            output: prev,
            segments: chain,
            topologyHash,
            dispose: () => {
                for (let i = 0; i < chain.length; i++) {
                    this.disconnect(chain[i].output)
                    chain[i].dispose()
                }
            }
        })

        return prev
    }

    private removeEffectChain(id: string) {
        this.effectChains.get(id)?.dispose()
        this.effectChains.delete(id)
    }

    updateRoutingNodes() {
        if (!this.audioCtx || this.updateScheduled) return
        this.updateScheduled = true

        requestAnimationFrame(() => {
            this.updateScheduled = false
            this.executeRoutingUpdate()
        })
    }

    private executeRoutingUpdate() {
        if (!this.audioCtx) return

        const inactiveChannels = this.getInactiveChannelIds()
        const rawChannels = this.config.channels || []
        const activeChannels: Array<{ id: string }> = []

        for (let i = 0; i < rawChannels.length; i++) {
            if (!inactiveChannels.has(rawChannels[i].id)) activeChannels.push(rawChannels[i])
        }

        this.syncGainNodes(activeChannels)

        const activeChannelIds = new Set<string>()
        for (let i = 0; i < activeChannels.length; i++) activeChannelIds.add(activeChannels[i].id)
        this.cleanupRemovedChannels(activeChannelIds)

        const connections = (this.config.connections || []) as Connection[]
        const connectionsByFrom = this.indexActiveNodesAndConnections(connections)
        const subSpeakers = this.buildSubSpeakers(connections)

        this.routeOutputNodes(connectionsByFrom, subSpeakers)
        this.connectSpeakerSinks(subSpeakers)
        this.routeInputNodes()
    }

    private syncGainNodes(activeChannels: Array<{ id: string }>) {
        // "main" channel must always exist
        this.ensureGainNode("main")
        for (let i = 0; i < activeChannels.length; i++) {
            this.ensureGainNode(activeChannels[i].id)
        }
    }

    private ensureGainNode(id: string): GainNode {
        let gainNode = this.gainNodes.get(id)
        const isNew = !gainNode
        if (!gainNode) {
            gainNode = this.audioCtx!.createGain()
            gainNode.channelCount = 2
            gainNode.channelCountMode = "explicit"
            gainNode.channelInterpretation = "discrete"
            this.gainNodes.set(id, gainNode)
        }
        this.applyGain(id, gainNode, isNew)
        return gainNode
    }

    private cleanupRemovedChannels(currentChannelIds: Set<string>) {
        for (const [id, node] of this.gainNodes.entries()) {
            // "main" channel should never be removed
            if (id === "main") continue
            if (currentChannelIds.has(id)) continue

            this.disconnect(node)
            this.disconnect(this.delayNodes.get(id))
            AudioInputCapture.getInstance().removeInput(id)
            this.removeEffectChain(id)

            this.recorderDestinations.delete(id)
            this.gainNodes.delete(id)
            this.delayNodes.delete(id)
            this.outputNodes.delete(id)
        }
    }

    private indexActiveNodesAndConnections(connections: Connection[]) {
        const activeNodeIds = new Set(["drawer_audio", "playlists_default", "output_window", "mic_default", ...this.inputNodes.keys(), ...this.gainNodes.keys(), ...AudioAnalyser.getActiveSourceIds()])
        const activeSubDeviceIds = new Set<string>()
        const connectionsByFrom = new Map<string, Connection[]>()

        for (let i = 0; i < connections.length; i++) {
            const c = connections[i]
            activeNodeIds.add(c.from)
            activeNodeIds.add(c.to)

            if (c.type === "sidechain") continue

            if (c.to.startsWith("speaker_sub_")) activeSubDeviceIds.add(c.to.replace("speaker_sub_", ""))

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
            if (c.type === "sidechain" || !c.to.startsWith("speaker_sub_")) continue

            const toCh = getConnectionToChannel(c)
            const current = subSpeakers.get(c.to)
            const count = Math.max(current?.maxChannels || 2, (toCh ?? 1) + 1)

            if (!current || count > current.maxChannels) {
                subSpeakers.set(c.to, {
                    speakerNode: this.audioCtx!.createChannelMerger(count),
                    maxChannels: count
                })
            }
        }

        return subSpeakers
    }

    private routeSourceConnections(sourceNode: AudioNode, conns: Connection[], destNode: AudioNode, destChannels = 2) {
        if (!this.audioCtx || !conns.length) return

        const isMergerDest = destNode instanceof ChannelMergerNode
        const hasFullStereo = conns.some((c) => getConnectionFromChannel(c) === undefined && getConnectionToChannel(c) === undefined)
        if (hasFullStereo && !isMergerDest) {
            this.connect(sourceNode, destNode)
            return
        }

        let maxCh = 1
        for (const c of conns) {
            maxCh = Math.max(maxCh, getConnectionFromChannel(c) ?? 0, getConnectionToChannel(c) ?? 0)
        }
        const splitter = this.audioCtx.createChannelSplitter(Math.max(maxCh + 1, (sourceNode as any).channelCount || 2))
        this.connect(sourceNode, splitter)

        const merger = isMergerDest ? destNode : this.audioCtx.createChannelMerger(Math.max(2, destChannels))
        const inLimit = merger.numberOfInputs
        const outLimit = splitter.numberOfOutputs

        for (const c of conns) {
            const fromCh = getConnectionFromChannel(c)
            const toCh = getConnectionToChannel(c)
            if (fromCh === undefined && toCh === undefined) {
                for (let ch = 0; ch < Math.min(2, outLimit, inLimit); ch++) {
                    splitter.connect(merger, ch, ch)
                }
                continue
            }

            const srcIdx = fromCh ?? Math.min(toCh ?? 0, outLimit - 1)
            const dstIdx = toCh ?? Math.min(fromCh ?? 0, inLimit - 1)
            if (srcIdx >= 0 && srcIdx < outLimit && dstIdx >= 0 && dstIdx < inLimit) {
                splitter.connect(merger, srcIdx, dstIdx)
            }
        }

        if (!isMergerDest) this.connect(merger, destNode)
    }

    private routeOutputNodes(connectionsByFrom: Map<string, Connection[]>, subSpeakers: SubSpeakerMap) {
        const allEffects = get(audioEffects) || {}
        const allChannelData = get(audioChannelsData) || {}

        for (const [id, node] of this.gainNodes.entries()) {
            this.disconnect(node)

            let outNode = this.buildEffectChain(id, node, allEffects[id])
            if (outNode !== node) this.disconnect(outNode)

            const delaySec = Math.max(0, Math.min(5, (allChannelData[id]?.delay || 0) / 1000))
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

            this.outputNodes.set(id, outNode)
            AudioInputCapture.getInstance().captureInput(id, outNode)

            const recDest = this.recorderDestinations.get(id)
            if (recDest) this.connect(outNode, recDest)

            const conns = connectionsByFrom.get(id) || []
            const connsByTarget = new Map<string, Connection[]>()
            for (const c of conns) {
                let list = connsByTarget.get(c.to)
                if (!list) connsByTarget.set(c.to, (list = []))
                list.push(c)
            }

            // main speaker out
            const speakerConns = connsByTarget.get("speaker_default")
            if (speakerConns) {
                let speakerNode = this.destinationNodes.get("speaker_default")
                if (!speakerNode) {
                    speakerNode = this.audioCtx!.createGain()
                    this.connect(speakerNode, this.audioCtx!.destination)
                    this.destinationNodes.set("speaker_default", speakerNode)
                }
                this.routeSourceConnections(outNode, speakerConns, speakerNode)

                AudioInputCapture.getInstance().captureInput("speaker_default", speakerNode)
            }

            // sub-speaker out
            for (const [targetId, { speakerNode, maxChannels }] of subSpeakers.entries()) {
                const subConns = connsByTarget.get(targetId)
                if (subConns) this.routeSourceConnections(outNode, subConns, speakerNode, maxChannels)
            }

            // network destinations
            for (const [targetId, targetConns] of connsByTarget.entries()) {
                if (targetId.startsWith("network_sub_")) {
                    const targetKey = targetId.replace("network_sub_", "")
                    const destNode = this.destinationNodes.get(targetKey) || AudioAnalyser.getOrCreateDestinationNode(targetKey)
                    if (destNode) {
                        this.routeSourceConnections(outNode, targetConns, destNode, destNode.channelCount || 2)
                        AudioInputCapture.getInstance().captureInput(targetId, destNode, 2)
                    }
                }
            }

            // Icecast
            const icecastConns = connsByTarget.get("icecast")
            if (icecastConns) {
                const icecastNode = this.destinationNodes.get("icecast") || AudioAnalyser.getOrCreateDestinationNode("icecast")
                if (icecastNode) {
                    this.routeSourceConnections(outNode, icecastConns, icecastNode, icecastNode.channelCount || 2)
                    setTimeout(() => AudioInputCapture.getInstance().captureInput("icecast", icecastNode, 2))
                }
            }
        }
    }

    private connectSpeakerSinks(subSpeakers: SubSpeakerMap) {
        for (const [targetId, { speakerNode, maxChannels }] of subSpeakers.entries()) {
            const deviceId = targetId.replace("speaker_sub_", "")
            const sink = this.getOrCreateSpeakerSink(deviceId)
            if (!sink) continue

            const prev = this.speakerStreams.get(targetId)
            if (prev && prev.maxChannels === maxChannels) {
                this.connect(speakerNode, prev.streamDest)
                AudioInputCapture.getInstance().captureInput(targetId, speakerNode, maxChannels)
                continue
            }

            if (prev) this.stopSpeakerStream(prev)

            const streamDest = this.audioCtx!.createMediaStreamDestination()
            streamDest.channelCount = maxChannels
            this.connect(speakerNode, streamDest)

            setTimeout(() => AudioInputCapture.getInstance().captureInput(targetId, speakerNode, maxChannels))

            const streamSource = sink.ctx.createMediaStreamSource(streamDest.stream)
            this.connect(streamSource, sink.ctx.destination)
            if (sink.ctx.state === "suspended") sink.ctx.resume().catch(() => {})

            this.speakerStreams.set(targetId, { streamDest, streamSource, maxChannels })
        }
    }

    private routeInputNodes() {
        const nodeToIds = new Map<AudioNode, Set<string>>()
        for (const [inputId, nodes] of this.inputNodes.entries()) {
            for (const node of nodes) {
                let set = nodeToIds.get(node)
                if (!set) {
                    set = new Set()
                    nodeToIds.set(node, set)
                }
                set.add(inputId)
            }
        }

        for (const [node, inputIds] of nodeToIds.entries()) {
            this.disconnect(node)
            const allConns: Connection[] = []

            for (const inputId of inputIds) {
                AudioInputCapture.getInstance().captureInput(inputId, node)
                const conns = this.getInputConnectionsFrom(inputId)
                for (let i = 0; i < conns.length; i++) allConns.push(conns[i])
            }

            if (!allConns.length || !this.audioCtx) continue

            const connsByTo = new Map<string, Connection[]>()
            for (const c of allConns) {
                let list = connsByTo.get(c.to)
                if (!list) connsByTo.set(c.to, (list = []))
                list.push(c)
            }

            for (const [targetId, targetConns] of connsByTo.entries()) {
                const gainNode = this.getGainNode(targetId)
                if (!gainNode) continue

                this.routeSourceConnections(node, targetConns, gainNode, gainNode.channelCount || 2)
            }
        }
    }

    private getGainNode(id: string): GainNode | null {
        if (!this.audioCtx) return null

        let node = this.gainNodes.get(id)
        if (!node) {
            node = this.audioCtx.createGain()
            node.channelCount = 2
            node.channelCountMode = "explicit"
            node.channelInterpretation = "discrete"
            this.gainNodes.set(id, node)
            this.applyGain(id, node, true)
        }

        return node
    }

    private getInputConnectionsFrom(sourceId: string): Connection[] {
        const inactive = this.getInactiveChannelIds()
        if (inactive.has(sourceId)) return []

        const res: Connection[] = []
        const conns = this.config.connections || []
        for (let i = 0; i < conns.length; i++) {
            const c = conns[i]
            if (c.from === sourceId && !inactive.has(c.to) && c.type !== "sidechain") res.push(c)
        }
        return res
    }

    getInputNodes(inputId: string): AudioNode[] {
        const nodes = this.inputNodes.get(inputId)
        return nodes ? Array.from(nodes) : []
    }

    registerInputNode(inputId: string, node: AudioNode) {
        let nodes = this.inputNodes.get(inputId)
        if (!nodes) {
            nodes = new Set()
            this.inputNodes.set(inputId, nodes)
        }
        if (nodes.has(node)) return

        nodes.add(node)
        this.routeInputNodes()
    }

    unregisterInputNode(inputId: string, node?: AudioNode) {
        const nodes = this.inputNodes.get(inputId)
        if (!nodes) return

        if (!node) {
            for (const n of nodes) this.disconnect(n)
            this.inputNodes.delete(inputId)
            return
        }

        if (nodes.has(node)) {
            this.disconnect(node)
            nodes.delete(node)
        }

        if (nodes.size === 0) this.inputNodes.delete(inputId)
    }

    registerChannelRecorder(channelId: string, dest: MediaStreamAudioDestinationNode) {
        this.recorderDestinations.set(channelId, dest)
        const outNode = this.getChannelOutputNode(channelId)
        if (outNode) this.connect(outNode, dest)
    }

    unregisterChannelRecorder(channelId: string, dest?: MediaStreamAudioDestinationNode) {
        const current = this.recorderDestinations.get(channelId)
        if (!current) return
        if (dest && current !== dest) return

        try {
            this.getChannelOutputNode(channelId)?.disconnect(current)
        } catch {}
        this.recorderDestinations.delete(channelId)
    }

    private getChannelOutputNode(channelId: string): AudioNode | null {
        return this.outputNodes.get(channelId) || this.gainNodes.get(channelId) || null
    }

    private getChannelVolume(channelId: string): number {
        const channel = get(audioChannelsData)[channelId]
        if (!channel) return 1

        let volume = Number(channel.volume ?? 1)
        if (volume > 5) volume = volume / 100 // in case a 0-100 value was set instead of 0-1
        if (volume > 5) volume = 1

        return Math.max(0, Math.min(5, volume))
    }

    public static sortChannels(config: AudioRoutingConfig): AudioRoutingConfig {
        if (!config?.channels || config.channels.length <= 1) return config

        const outputsMap = get(outputs) || {}
        const isLinkedToOutput = (id: string) => outputsMap[id.split("_")?.[1]]

        const main: typeof config.channels = []
        const unlinked: typeof config.channels = []
        const outputLinked: typeof config.channels = []

        for (let i = 0; i < config.channels.length; i++) {
            const ch = config.channels[i]
            if (ch.id === "main") main.push(ch)
            else if (isLinkedToOutput(ch.id)) outputLinked.push(ch)
            else unlinked.push(ch)
        }

        const sortByName = (a: any, b: any) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })
        return { ...config, channels: [...main, ...unlinked.sort(sortByName), ...outputLinked.sort(sortByName)] }
    }
}
