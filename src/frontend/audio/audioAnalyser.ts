import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { getFirstOutput } from "../components/helpers/output"
import { disabledServers, media, playingAudio, playingVideos, serverData } from "../stores"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { AudioMultichannel, MultichannelInfo } from "./audioMultichannel"
import { AudioProcessor, PitchShiftNode } from "./audioProcessor"
import { AudioSender } from "./audioSender"
import { AudioInputCapture } from "./routing/audioInputCapture"
import { AudioRoutingManager } from "./routing/audioRoutingManager"

// NOTE: we don't have access to analyse audio from Website/YouTube/Vimeo (But the "Desktop audio" input is a good workaround)

export class AudioAnalyser {
    static sampleRate = 48000 // Hz
    static channels = AudioMultichannel.DEFAULT_CHANNELS // default left/right, will be updated dynamically
    static maxChannels = AudioMultichannel.MAX_CHANNELS // support up to 8 channels (7.1 surround)
    static recorderFrameRate = 24 // fps

    private static ac = new AudioContext({ latencyHint: "playback" })
    private static splitter: ChannelSplitterNode | null = null
    private static analysers: AnalyserNode[] = []
    private static sources: { [key: string]: AudioNode } = {}
    private static processors: { [key: string]: PitchShiftNode } = {}
    private static gainNodes: { [key: string]: GainNode } = {}
    private static attachedInputIds: Map<string, string[]> = new Map()

    // Reusable static buffer to prevent GC allocations during level checks
    private static volumeBuffer = new Float32Array(256)
    private static isContextSynced = false

    // Expose the AudioContext for other audio systems to use the same context
    static getAudioContext(): AudioContext {
        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }

        // Sync context to routing manager once or when needed
        if (!this.isContextSynced) {
            this.isContextSynced = true
            try {
                AudioRoutingManager.getInstance().setAudioContext(this.ac)
            } catch {}
        }

        return this.ac
    }

    private static createSourceNode(audio: HTMLMediaElement | MediaStream): AudioNode {
        if (audio instanceof MediaStream) return this.ac.createMediaStreamSource(audio)
        const cached = this.elementSources.get(audio)
        if (cached) return cached
        const source = this.ac.createMediaElementSource(audio)
        this.elementSources.set(audio, source)
        return source
    }

    private static elementSources = new WeakMap<HTMLMediaElement, AudioNode>()

    static hasSource(id: string, outputId?: string): boolean {
        const key = outputId ? `${id}_${outputId}` : id
        return !!this.sources[key]
    }

    static updateSource(id: string, audio: HTMLMediaElement | MediaStream, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        const sourceGain = this.gainNodes[key]
        if (!sourceGain) {
            this.attach(id, audio, outputId)
            return
        }

        const oldSource = this.sources[key]
        if (oldSource && sourceGain) {
            const isShared = Object.values(this.sources).some((node) => node === oldSource && node !== oldSource) // check if another key uses oldSource
            try {
                if (isShared) oldSource.disconnect(sourceGain)
                else oldSource.disconnect()
            } catch {}
        }
        try {
            const newSource = this.createSourceNode(audio)
            this.sources[key] = newSource
            newSource.connect(sourceGain)
        } catch (err) {
            console.error("Could not update media source:", err)
        }
    }

    static async attach(id: string, audio: HTMLMediaElement | MediaStream, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        if (this.sources[key]) return

        if (this.ac.state === "suspended") {
            try {
                await this.ac.resume()
            } catch {}
        }

        let source: AudioNode
        try {
            source = this.createSourceNode(audio)
            this.sources[key] = source
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        // Start pipeline immediately
        AudioRoutingManager.getInstance().setAudioContext(this.getAudioContext())
        this.initAnalysers()
        this.recorderActivate()

        if (this.sources[key]) {
            if (!this.splitter) return

            const processor = AudioProcessor.createNode(this.ac)
            this.processors[key] = processor

            // Create individual gain node to control this source's volume
            const sourceGain = this.ac.createGain()
            this.gainNodes[key] = sourceGain
            const storedVol = this.sourceVolumes[key] ?? this.sourceVolumes[id]
            const initialVolume = storedVol !== undefined ? storedVol : audio instanceof HTMLMediaElement ? audio.volume : 1.0
            sourceGain.gain.setValueAtTime(initialVolume, this.ac.currentTime)

            this.sources[key].connect(sourceGain)
            sourceGain.connect(processor.input)

            // Route audio to configured mergers
            const nodeIds = this.getInputNodeIds(id, outputId)
            this.attachedInputIds.set(key, nodeIds)
            this.connectToSinks(processor, id, outputId)

            if (this.ac.state === "suspended") {
                this.ac.resume().catch((err) => console.error("Could not resume AudioContext:", err))
            }

            setTimeout(() => {
                AudioRoutingManager.getInstance().updateRoutingNodes()
            }, 100)

            const mediaData = get(media)[id]
            if (mediaData) {
                const pitch = mediaData.pitch ?? 0
                const tempo = mediaData.tempo ?? 1
                if ((pitch !== 0 || tempo !== 1) && !AudioProcessor.isRegistered(this.ac)) {
                    AudioProcessor.register(this.ac).catch(() => {})
                }
                processor.pitch = pitch
                processor.tempo = tempo
            }
        } else {
            console.warn(`Failed to connect audio source "${id}" to equalizer`)
        }

        this.detectAndUpgradeChannels(id, audio)
    }

    private static sourceVolumes: { [key: string]: number } = {}

    static setSourceVolume(id: string, volume: number, outputId?: string) {
        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }
        this.sourceVolumes[id] = volume
        if (outputId) this.sourceVolumes[`${id}_${outputId}`] = volume

        const keys = Object.keys(this.gainNodes)
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === id || k.startsWith(`${id}_`)) {
                this.sourceVolumes[k] = volume
                const gainNode = this.gainNodes[k]
                if (gainNode) {
                    gainNode.gain.setValueAtTime(volume, this.ac.currentTime)
                }
            }
        }
    }

    private static detectAndUpgradeChannels(id: string, audio: HTMLMediaElement | MediaStream) {
        if (audio instanceof HTMLMediaElement && audio.src) {
            AudioMultichannel.detectFileChannelCount(audio.src, this.maxChannels)
                .then((channels) => {
                    if (channels > this.channels) {
                        this.updateChannelCount(channels)
                    }
                })
                .catch((err) => {
                    console.debug(`Channel detection skipped for "${id}":`, err)
                })
        } else if (audio instanceof MediaStream) {
            const ch = audio.getAudioTracks()[0]?.getSettings().channelCount
            if (ch && ch > this.channels) this.updateChannelCount(ch)
        }
    }

    static detach(id: string, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        const source = this.sources[key]
        if (!source) return

        const processor = this.processors[key]
        const nodeIds = this.attachedInputIds.get(key) || this.getInputNodeIds(id, outputId)
        this.attachedInputIds.delete(key)

        this.disconnectGain(processor || source, id, outputId)

        const currentAudio = get(playingAudio)
        const currentVideos = get(playingVideos)
        const playingKeys = Object.keys(currentAudio)
        let stillPlayingDrawer = false
        let stillPlayingPlaylist = false

        for (let i = 0; i < playingKeys.length; i++) {
            const k = playingKeys[i]
            if (k !== id && currentAudio[k]?.isMic !== true) {
                if (currentAudio[k]?.playlistId) stillPlayingPlaylist = true
                else stillPlayingDrawer = true
            }
        }

        const stillPlayingVideo = currentVideos.some((v) => v.path !== id)

        nodeIds.forEach((nodeId) => {
            if (nodeId === "drawer_audio" && stillPlayingDrawer) return
            if (nodeId === "playlists_default" && stillPlayingPlaylist) return
            if (nodeId === "output_window" && stillPlayingVideo) return
            AudioInputCapture.getInstance().removeInput(nodeId)
        })

        this.recorderDeactivate()

        if (processor) {
            try {
                processor.dispose()
            } catch {}
            delete this.processors[key]
        }

        const sourceGain = this.gainNodes[key]
        if (sourceGain) {
            try {
                sourceGain.disconnect()
            } catch {}
            delete this.gainNodes[key]
        }

        delete this.sourceVolumes[key]
        delete this.sourceVolumes[id]
        delete this.sources[key]

        const isSourceStillUsed = Object.values(this.sources).some((node) => node === source)
        if (!isSourceStillUsed) {
            try {
                source.disconnect()
            } catch {}
        } else if (sourceGain) {
            try {
                source.disconnect(sourceGain)
            } catch {}
        }
    }

    static shouldAnalyse() {
        return this.getActiveAudio() || this.getActiveVideos() || this.sendOutputShowAudio()
    }

    private static getActiveAudio() {
        const playing = Object.values(get(playingAudio))
        for (let i = 0; i < playing.length; i++) {
            if (!playing[i].paused) return true
        }
        return false
    }

    private static getActiveVideos() {
        const videos = Object.values(get(playingVideos))
        for (let i = 0; i < videos.length; i++) {
            const v = videos[i]
            if (!v.audio?.paused && !v.audio?.muted) return true
        }
        return false
    }

    private static getOutputShowId(): string | null {
        return get(serverData)?.output_stream?.outputId || getFirstOutput()?.id || null
    }

    private static sendOutputShowAudio() {
        return get(disabledServers).output_stream === false && !!get(serverData)?.output_stream?.sendAudio && !!this.getOutputShowId()
    }

    private static initAnalysers() {
        if (this.analysers.length) {
            AudioAnalyserMerger.init()
            return
        }

        if (!this.splitter) {
            this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)
        }

        this.analysers = new Array(this.channels)
        for (let channel = 0; channel < this.channels; channel++) {
            const analyser = this.ac.createAnalyser()
            analyser.smoothingTimeConstant = 0.85
            analyser.fftSize = 256
            this.splitter.connect(analyser, channel)
            this.analysers[channel] = analyser
        }

        AudioAnalyserMerger.init()
    }

    // MULTI CHANNEL

    static getChannelInfo(): MultichannelInfo {
        return AudioMultichannel.getChannelInfo(this.ac, this.channels, this.maxChannels)
    }

    static supportsMultichannel(): boolean {
        return AudioMultichannel.supportsMultichannel(this.ac)
    }

    static getMaxSupportedChannels(): number {
        return AudioMultichannel.getMaxSupportedChannels(this.ac, this.maxChannels)
    }

    static updateChannelCount(newChannelCount: number) {
        const validatedChannelCount = AudioMultichannel.validateChannelCount(newChannelCount)
        if (!AudioMultichannel.shouldUpdateChannelCount(this.channels, validatedChannelCount)) return

        if (this.splitter) {
            try {
                this.splitter.disconnect()
            } catch {}
        }

        this.analysers = []
        this.channels = validatedChannelCount
        this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)

        this.destinationNodes.forEach((destNode) => {
            AudioMultichannel.configureNodeForMultichannel(destNode, this.channels)
        })

        this.reconnectAllSources()
    }

    private static reconnectAllSources() {
        const sourceKeys = Object.keys(this.sources)
        for (let i = 0; i < sourceKeys.length; i++) {
            const id = sourceKeys[i]
            try {
                const source = this.sources[id]
                if (!source) continue

                const processor = this.processors[id]
                if (!processor || !this.splitter) continue

                const audioPlaying = get(playingAudio)[id]
                const isMic = audioPlaying?.isMic === true || id.startsWith("mic_sub_")
                if (!isMic) {
                    processor.output.connect(this.splitter)
                }
                this.connectGain(processor, id)
            } catch (err) {
                console.error(`Failed to reconnect source ${id}:`, err)
            }
        }

        this.initAnalysers()
    }

    static setPitch(id: string, value: number, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        const keys = Object.keys(this.processors)
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === key || k === id || k.startsWith(`${id}_`)) {
                this.processors[k].pitch = value
            }
        }
    }

    static setTempo(id: string, value: number, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        const keys = Object.keys(this.processors)
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === key || k === id || k.startsWith(`${id}_`)) {
                this.processors[k].tempo = value
            }
        }
    }

    static connectToSinks(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        this.connectGain(source, id, outputId)
    }

    static disconnectFromSinks(source: AudioNode | PitchShiftNode, id?: string) {
        this.disconnectGain(source, id)
    }

    static getInputNodeIds(id?: string, outputId?: string): string[] {
        if (!id) return ["drawer_audio"]
        if (id === "metronome") return ["metronome"]

        const audioPlaying = get(playingAudio)[id]
        const videoPlaying = get(playingVideos).some((v) => v.path === id)
        const isMic = audioPlaying?.isMic === true || id.startsWith("mic_sub_")
        const isVideo = videoPlaying || id.startsWith("output_win_sub_") || !!outputId

        if (isMic) return [id, "mic_default"]
        if (isVideo) {
            const ids = ["output_window"]
            if (outputId) ids.push(`output_win_sub_${outputId}`)
            return ids
        }

        const playlistId = audioPlaying?.playlistId
        if (playlistId) {
            return [`playlist_sub_${playlistId}`, "playlists_default"]
        }

        return ["drawer_audio"]
    }

    static connectGain(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source
        const key = outputId ? `${id}_${outputId}` : id || ""
        const nodeIds = (key && this.attachedInputIds.get(key)) || this.getInputNodeIds(id, outputId)

        const manager = AudioRoutingManager.getInstance()
        nodeIds.forEach((nodeId) => manager.registerInputNode(nodeId, node))
        manager.updateRoutingNodes()
    }

    static disconnectGain(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source
        const key = outputId ? `${id}_${outputId}` : id || ""
        const nodeIds = (key && this.attachedInputIds.get(key)) || this.getInputNodeIds(id, outputId)

        const manager = AudioRoutingManager.getInstance()
        nodeIds.forEach((nodeId) => manager.unregisterInputNode(nodeId, node))

        try {
            node.disconnect()
        } catch {}
    }

    private static destinationNodes: Map<string, GainNode> = new Map()
    static getOrCreateDestinationNode(targetId: string): GainNode {
        const ctx = (this.ac ??= AudioAnalyser.getAudioContext())
        let destNode = this.destinationNodes.get(targetId)
        if (!destNode || destNode.context !== ctx) {
            destNode = AudioMultichannel.createMultichannelGainNode(ctx, this.channels)
            this.destinationNodes.set(targetId, destNode)
            AudioRoutingManager.getInstance().setDestinationNode(targetId, destNode)
        }
        return destNode
    }

    // RECORDER & AUDIO SENDER DELEGATION
    static recorderActivate() {
        AudioSender.activate(this.getAudioContext(), (targetId) => this.getOrCreateDestinationNode(targetId))
    }

    static recorderDeactivate() {
        AudioSender.deactivate()
    }

    static async customOutput(sinkId: string) {
        try {
            await (this.ac as any).setSinkId(sinkId || "")
            return true
        } catch (err) {
            console.error("Could not set custom audio sink ID:", err)
            return false
        }
    }

    // CHANNEL

    static getChannelsVolume(): AudioChannel[] {
        const volumes: AudioChannel[] = new Array(this.channels)
        for (let channel = 0; channel < this.channels; channel++) {
            volumes[channel] = this.getChannelVolume(channel)
        }
        return volumes
    }

    private static getChannelVolume(channelIndex: number): AudioChannel {
        const analyser = this.analysers[channelIndex]
        if (!analyser) return { dB: { value: AudioAnalyserMerger.dBmin } }

        analyser.minDecibels = AudioAnalyserMerger.dBmin
        analyser.maxDecibels = AudioAnalyserMerger.dBmax

        const size = analyser.fftSize
        if (this.volumeBuffer.length !== size) {
            this.volumeBuffer = new Float32Array(size)
        }

        analyser.getFloatTimeDomainData(this.volumeBuffer)

        let sumSquare = 0
        const len = this.volumeBuffer.length
        for (let i = 0; i < len; i++) {
            const sample = this.volumeBuffer[i]
            sumSquare += sample * sample
        }

        const rms = Math.sqrt(len ? sumSquare / len : 0)
        const dB = rms > 0.000001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60

        return { dB: { value: dB } }
    }

    static getSource(id: string): AudioNode | null {
        return this.sources[id] || null
    }

    static getAnalysers(path?: string) {
        let nodeId = "speaker_default"

        // WIP per item capture for visualizer ?
        if (path) nodeId = path
        console.log(path)

        return AudioInputCapture.getInstance().getAnalysers(nodeId)
    }
}
