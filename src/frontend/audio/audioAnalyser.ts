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
            const isShared = Object.entries(this.sources).some(([k, node]) => k !== key && node === oldSource)
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

        this.detectAndUpgradeChannels(id, audio)
    }

    static setSourceVolume(id: string, volume: number, outputId?: string) {
        if (this.ac.state === "suspended") this.ac.resume().catch(() => {})
        this.sourceVolumes[id] = volume
        if (outputId) this.sourceVolumes[`${id}_${outputId}`] = volume

        Object.keys(this.gainNodes).forEach((k) => {
            if (k === id || k.startsWith(`${id}_`)) {
                this.sourceVolumes[k] = volume
                this.gainNodes[k]?.gain.setValueAtTime(volume, this.ac.currentTime)
            }
        })
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

        const stillPlayingVideo = currentVideos.some((v) => v.path !== id)

        nodeIds.forEach((nodeId) => {
            if (nodeId === "drawer_audio" && stillPlayingDrawer) return
            if (nodeId === "playlists_default" && stillPlayingPlaylist) return
            if (nodeId === "output_window" && stillPlayingVideo) return
            AudioInputCapture.getInstance().removeInput(nodeId)
        })

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

        const isShared = Object.values(this.sources).includes(source)
        try {
            if (isShared) source.disconnect(this.gainNodes[key])
            else source.disconnect()
        } catch {}
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
        if (this.analysers.length) return AudioPlayer.initCheckLoop()

        if (!this.splitter) {
            this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)
        }

        this.analysers = Array.from({ length: this.channels }, (_, ch) => {
            const analyser = this.ac.createAnalyser()
            analyser.smoothingTimeConstant = 0.85
            analyser.fftSize = 256
            this.splitter!.connect(analyser, ch)
            return analyser
        })

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

        this.destinationNodes.forEach((dest) => AudioMultichannel.configureNodeForMultichannel(dest, this.channels))

        this.reconnectAllSources()
    }

    private static reconnectAllSources() {
        Object.keys(this.sources).forEach((id) => {
            const processor = this.processors[id]
            if (!processor || !this.splitter) return

            const isMic = get(playingAudio)[id]?.isMic || id.startsWith("mic_sub_")
            if (!isMic) processor.output.connect(this.splitter)
            this.connectGain(processor, id)
        })

        this.initAnalysers()
    }

    private static applyProcessorProperty(id: string, outputId: string | undefined, prop: "pitch" | "tempo", value: number) {
        const key = outputId ? `${id}_${outputId}` : id
        Object.keys(this.processors).forEach((k) => {
            if (k === key || k === id || k.startsWith(`${id}_`)) {
                this.processors[k][prop] = value
            }
        })
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

        const size = analysers[0].fftSize
        if (this.volumeBuffer.length !== size) this.volumeBuffer = new Float32Array(size)

        analysers[0].getFloatTimeDomainData(this.volumeBuffer)
        const sumSquare = this.volumeBuffer.reduce((sum, sample) => sum + sample * sample, 0)
        const rms = Math.sqrt(sumSquare / this.volumeBuffer.length)

        return rms > 0.000001 ? Math.max(MIN_DB, Math.min(0, 20 * Math.log10(rms))) : MIN_DB
    }

    static getAnalysers(path?: string) {
        let nodeId = "speaker_default"

        // WIP per item capture for visualizer ?
        if (path) nodeId = path
        console.log(path)

        return AudioInputCapture.getInstance().getAnalysers(nodeId)
    }
}
