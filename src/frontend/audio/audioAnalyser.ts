import { get } from "svelte/store"
import { getFirstOutput } from "../components/helpers/output"
import { disabledServers, media, playingAudio, playingVideos, serverData } from "../stores"
import { AudioMultichannel, MultichannelInfo } from "./audioMultichannel"
import { AudioPlayer } from "./audioPlayer"
import { AudioProcessor, PitchShiftNode } from "./audioProcessor"
import { AudioSender } from "./audioSender"
import { MIN_DB } from "./dBUtils"
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
    private static sources: Record<string, AudioNode> = {}
    private static processors: Record<string, PitchShiftNode> = {}
    private static gainNodes: Record<string, GainNode> = {}
    private static sourceVolumes: Record<string, number> = {}
    private static destinationNodes = new Map<string, GainNode>()
    private static elementSources = new WeakMap<HTMLMediaElement, AudioNode>()
    private static attachedInputIds = new Map<string, string[]>()

    private static volumeBuffer = new Float32Array(256)
    private static isContextSynced = false

    static getAudioContext(): AudioContext {
        if (this.ac.state === "suspended") this.ac.resume().catch(() => {})

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
        let source = this.elementSources.get(audio)
        if (!source) {
            source = this.ac.createMediaElementSource(audio)
            this.elementSources.set(audio, source)
        }
        return source
    }

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
        if (oldSource) {
            let isShared = false
            for (const [k, node] of Object.entries(this.sources)) {
                if (k !== key && node === oldSource) {
                    isShared = true
                    break
                }
            }
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

        if (this.ac.state === "suspended") await this.ac.resume().catch(() => {})

        try {
            this.sources[key] = this.createSourceNode(audio)
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        AudioRoutingManager.getInstance().setAudioContext(this.getAudioContext())
        this.initAnalysers()
        this.recorderActivate()

        const processor = AudioProcessor.createNode(this.ac)
        this.processors[key] = processor

        const sourceGain = this.ac.createGain()
        this.gainNodes[key] = sourceGain
        const initialVolume = this.sourceVolumes[key] ?? this.sourceVolumes[id] ?? (audio instanceof HTMLMediaElement ? audio.volume : 1.0)
        sourceGain.gain.setValueAtTime(initialVolume, this.ac.currentTime)

        this.sources[key].connect(sourceGain)
        sourceGain.connect(processor.input)

        const nodeIds = this.getInputNodeIds(id, outputId)
        this.attachedInputIds.set(key, nodeIds)
        this.connectGain(processor, id, outputId)

        setTimeout(() => AudioRoutingManager.getInstance().updateRoutingNodes(), 100)

        const path = AudioPlayer.getPath(id)
        const mediaData = get(media)[path] || get(media)[id]
        if (mediaData) {
            const pitch = mediaData.pitch ?? 0
            const tempo = mediaData.tempo ?? 1
            if ((pitch !== 0 || tempo !== 1) && !AudioProcessor.isRegistered(this.ac)) {
                AudioProcessor.register(this.ac).catch(() => {})
            }
            processor.pitch = pitch
            processor.tempo = tempo
        }

        this.detectAndUpgradeChannels(id, audio)
    }

    static setSourceVolume(id: string, volume: number, outputId?: string) {
        if (this.ac.state === "suspended") this.ac.resume().catch(() => {})
        this.sourceVolumes[id] = volume
        if (outputId) this.sourceVolumes[`${id}_${outputId}`] = volume

        const keys = Object.keys(this.gainNodes)
        const prefix = `${id}_`
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === id || k.startsWith(prefix)) {
                this.sourceVolumes[k] = volume
                this.gainNodes[k]?.gain.setValueAtTime(volume, this.ac.currentTime)
            }
        }
    }

    static rampSourceVolume(id: string, targetVolume: number, durationMs: number, outputId?: string) {
        if (this.ac.state === "suspended") this.ac.resume().catch(() => {})
        this.sourceVolumes[id] = targetVolume
        if (outputId) this.sourceVolumes[`${id}_${outputId}`] = targetVolume

        const keys = Object.keys(this.gainNodes)
        const prefix = `${id}_`
        const rampDuration = Math.max(0.01, durationMs / 1000)
        const endTime = this.ac.currentTime + rampDuration

        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === id || k.startsWith(prefix)) {
                const node = this.gainNodes[k]
                if (node) {
                    try {
                        node.gain.cancelScheduledValues(this.ac.currentTime)
                        node.gain.setValueAtTime(node.gain.value, this.ac.currentTime)
                        node.gain.linearRampToValueAtTime(targetVolume, endTime)
                    } catch {
                        node.gain.setValueAtTime(targetVolume, this.ac.currentTime)
                    }
                }
            }
        }
    }

    private static detectAndUpgradeChannels(id: string, audio: HTMLMediaElement | MediaStream) {
        if (audio instanceof HTMLMediaElement && audio.src) {
            AudioMultichannel.detectFileChannelCount(audio.src, this.maxChannels)
                .then((channels) => {
                    if (channels > this.channels) this.updateChannelCount(channels)
                })
                .catch((err) => console.debug(`Channel detection skipped for "${id}":`, err))
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

        let stillPlayingVideo = false
        for (let i = 0; i < currentVideos.length; i++) {
            if (currentVideos[i].path !== id) {
                stillPlayingVideo = true
                break
            }
        }

        for (let i = 0; i < nodeIds.length; i++) {
            const nodeId = nodeIds[i]
            if (nodeId === "drawer_audio" && stillPlayingDrawer) continue
            if (nodeId === "playlists_default" && stillPlayingPlaylist) continue
            if (nodeId === "output_window" && stillPlayingVideo) continue

            AudioInputCapture.getInstance().removeInput(nodeId)
        }

        this.recorderDeactivate()

        try {
            processor?.dispose()
        } catch {}
        try {
            this.gainNodes[key]?.disconnect()
        } catch {}

        delete this.processors[key]
        delete this.gainNodes[key]
        delete this.sourceVolumes[key]
        delete this.sourceVolumes[id]
        delete this.sources[key]

        let isShared = false
        for (const s of Object.values(this.sources)) {
            if (s === source) {
                isShared = true
                break
            }
        }

        try {
            if (isShared) source.disconnect(this.gainNodes[key])
            else source.disconnect()
        } catch {}
    }

    static shouldAnalyse() {
        return this.getActiveAudio() || this.getActiveVideos() || this.sendOutputShowAudio()
    }

    private static getActiveAudio() {
        const playing = get(playingAudio)
        for (const key in playing) {
            if (!playing[key].paused) return true
        }
        return false
    }

    private static getActiveVideos() {
        const videos = get(playingVideos)
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
        if (this.analysers.length) return AudioPlayer.initCheckLoop()

        if (!this.splitter) {
            this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)
        }

        this.analysers = new Array(this.channels)
        for (let ch = 0; ch < this.channels; ch++) {
            const analyser = this.ac.createAnalyser()
            analyser.smoothingTimeConstant = 0.85
            analyser.fftSize = 256
            this.splitter.connect(analyser, ch)
            this.analysers[ch] = analyser
        }

        AudioPlayer.initCheckLoop()
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
        const validated = AudioMultichannel.validateChannelCount(newChannelCount)
        if (!AudioMultichannel.shouldUpdateChannelCount(this.channels, validated)) return

        try {
            this.splitter?.disconnect()
        } catch {}

        this.analysers = []
        this.channels = validated
        this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)

        for (const dest of this.destinationNodes.values()) {
            AudioMultichannel.configureNodeForMultichannel(dest, this.channels)
        }

        this.reconnectAllSources()
    }

    private static reconnectAllSources() {
        for (const id of Object.keys(this.sources)) {
            const processor = this.processors[id]
            if (!processor || !this.splitter) continue

            const isMic = get(playingAudio)[id]?.isMic || id.startsWith("mic_sub_")
            if (!isMic) processor.output.connect(this.splitter)
            this.connectGain(processor, id)
        }

        this.initAnalysers()
    }

    private static applyProcessorProperty(id: string, outputId: string | undefined, prop: "pitch" | "tempo", value: number) {
        const key = outputId ? `${id}_${outputId}` : id
        const keys = Object.keys(this.processors)
        const prefix = `${id}_`

        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            if (k === key || k === id || k.startsWith(prefix)) {
                this.processors[k][prop] = value
            }
        }
    }

    static setPitch(id: string, value: number, outputId?: string) {
        this.applyProcessorProperty(id, outputId, "pitch", value)
    }
    static setTempo(id: string, value: number, outputId?: string) {
        this.applyProcessorProperty(id, outputId, "tempo", value)
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
            return outputId ? ["output_window", `output_win_sub_${outputId}`] : ["output_window"]
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
        for (let i = 0; i < nodeIds.length; i++) {
            manager.registerInputNode(nodeIds[i], node)
        }
        manager.updateRoutingNodes()
    }

    static disconnectGain(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source
        const key = outputId ? `${id}_${outputId}` : id || ""
        const nodeIds = (key && this.attachedInputIds.get(key)) || this.getInputNodeIds(id, outputId)

        const manager = AudioRoutingManager.getInstance()
        for (let i = 0; i < nodeIds.length; i++) {
            manager.unregisterInputNode(nodeIds[i], node)
        }

        try {
            node.disconnect()
        } catch {}
    }

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

    // CHANNEL

    static getChannelLiveVolume(channelId: string): number {
        const analysers = this.getAnalysers(channelId)
        if (!analysers?.length) return MIN_DB

        const analyser = analysers[0]
        const size = analyser.fftSize
        if (this.volumeBuffer.length !== size) this.volumeBuffer = new Float32Array(size)

        analyser.getFloatTimeDomainData(this.volumeBuffer)

        let sumSquare = 0
        const len = this.volumeBuffer.length
        for (let i = 0; i < len; i++) {
            const sample = this.volumeBuffer[i]
            sumSquare += sample * sample
        }

        const rms = Math.sqrt(sumSquare / len)
        return rms > 0.000001 ? Math.max(MIN_DB, Math.min(0, 20 * Math.log10(rms))) : MIN_DB
    }

    static getAnalysers(path?: string) {
        let nodeId = "speaker_default"

        // WIP per item capture for visualizer (audio file playback preview) ?
        if (path) nodeId = path

        return AudioInputCapture.getInstance().getAnalysers(nodeId)
    }
}
