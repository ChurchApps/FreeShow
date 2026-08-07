import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { AUDIO } from "../../types/Channels"
import { keysToID } from "../components/helpers/array"
import { getFirstOutput } from "../components/helpers/output"
import { audioRouting, disabledServers, media, outputs, playingAudio, playingVideos, serverData, special } from "../stores"
import { send } from "../utils/request"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { AudioMultichannel, MultichannelInfo } from "./audioMultichannel"
import { AudioProcessor, PitchShiftNode } from "./audioProcessor"
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
    private static timeDomainArray = new Uint8Array(256)

    // Expose the AudioContext for other audio systems to use the same context
    static getAudioContext(): AudioContext {
        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }

        // Sync context to routing manager
        AudioRoutingManager.getInstance().setAudioContext(this.ac)

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

    static hasSource(id: string, outputId?: string) {
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

        this.sources[key]?.disconnect()
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
            console.log(`[AudioAnalyser] Attaching ${id} for output ${outputId || "main"}`)
            source = this.createSourceNode(audio)
            this.sources[key] = source
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        // Start the pipeline immediately with the current channel count (no blocking)
        AudioRoutingManager.getInstance().setAudioContext(this.getAudioContext())
        this.initAnalysers()
        this.initRecorder()

        // Equalizer is now applied globally in the master effect chain to prevent cross-source leakage
        if (this.sources[key]) {
            if (!this.splitter) return

            const processor = AudioProcessor.createNode(this.ac)
            this.processors[key] = processor

            // Create individual gain node to control this source's volume in Web Audio
            const sourceGain = this.ac.createGain()
            this.gainNodes[key] = sourceGain
            const storedVol = this.sourceVolumes[key] ?? this.sourceVolumes[id]
            const initialVolume = storedVol !== undefined ? storedVol : audio instanceof HTMLMediaElement ? audio.volume : 1.0
            sourceGain.gain.setValueAtTime(initialVolume, this.ac.currentTime)

            this.sources[key].connect(sourceGain)
            sourceGain.connect(processor.input)

            const audioPlaying = get(playingAudio)[id]
            const videoPlaying = get(playingVideos).some((v) => v.path === id)
            const isMic = audio instanceof MediaStream || (audioPlaying && audioPlaying.isMic === true)
            const isVideo = audio instanceof HTMLVideoElement || videoPlaying

            // Route audio to configured mergers
            this.connectToSinks(processor, id, outputId)

            if (isMic || isVideo) {
                if (this.ac.state === "suspended") {
                    console.log("[AudioAnalyser] Resuming suspended context for media")
                    this.ac.resume().catch((err) => console.error("Could not resume AudioContext:", err))
                }

                setTimeout(() => {
                    AudioRoutingManager.getInstance().updateRoutingNodes()
                }, 100)
            }

            const mediaData = get(media)[id]
            if (mediaData) {
                const pitch = mediaData.pitch ?? 0
                const tempo = mediaData.tempo ?? 1
                // Pre-register the SoundTouch worklet if pitch/tempo are already non-default,
                // so the values apply synchronously rather than after an async module load.
                if ((pitch !== 0 || tempo !== 1) && !AudioProcessor.isRegistered(this.ac)) {
                    AudioProcessor.register(this.ac).catch(() => {})
                }
                processor.pitch = pitch
                processor.tempo = tempo
            }
        } else {
            console.warn(`Failed to connect audio source "${id}" to equalizer`)
        }

        // Detect true channel count in the background — upgrades the graph if the file
        // has more channels than the current default. Does not delay playback startup.
        this.detectAndUpgradeChannels(id, audio)
    }

    private static sourceVolumes: { [key: string]: number } = {}
    static setSourceVolume(id: string, volume: number, outputId?: string) {
        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }
        this.sourceVolumes[id] = volume
        if (outputId) this.sourceVolumes[`${id}_${outputId}`] = volume

        Object.keys(this.gainNodes).forEach((k) => {
            if (k === id || k.startsWith(`${id}_`)) {
                this.sourceVolumes[k] = volume
                const gainNode = this.gainNodes[k]
                if (gainNode) {
                    gainNode.gain.setValueAtTime(volume, this.ac.currentTime)
                }
            }
        })
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

        const audioPlaying = get(playingAudio)[id]
        const isMic = audioPlaying?.isMic === true || id.startsWith("mic_sub_")
        const nodeKey = isMic ? id : id === "metronome" ? "metronome" : "drawer_audio"
        const specificInputId = outputId ? `output_win_sub_${outputId}` : null

        // Use disconnectGain to handle all unregistrations consistently
        this.disconnectGain(processor || source, id, outputId)

        // Only remove capture visualizer for drawer_audio if no more drawer audio files are playing
        if (nodeKey === "drawer_audio") {
            const stillPlayingDrawer = Object.keys(get(playingAudio)).some((k) => k !== id && get(playingAudio)[k]?.isMic !== true)
            if (!stillPlayingDrawer) {
                AudioInputCapture.getInstance().removeInput(nodeKey)
            }
        } else {
            AudioInputCapture.getInstance().removeInput(nodeKey)
        }

        if (specificInputId) {
            AudioInputCapture.getInstance().removeInput(specificInputId)
        }
        this.recorderDeactivate()

        // Disconnect and remove processor
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

        try {
            source.disconnect()
        } catch {}
        delete this.sourceVolumes[key]
        delete this.sourceVolumes[id]
        delete this.sources[key]
    }

    static shouldAnalyse() {
        return this.getActiveAudio() || this.getActiveVideos() || this.sendOutputShowAudio()
    }
    private static getActiveAudio() {
        return !!Object.values(get(playingAudio)).filter((a) => !a.paused).length
    }
    private static getActiveVideos() {
        return !!Object.values(get(playingVideos)).filter((a) => !a.audio?.paused && !a.audio?.muted).length
    }
    private static getOutputShowId(): string | null {
        return get(serverData)?.output_stream?.outputId || getFirstOutput()?.id || null
    }
    private static sendOutputShowAudio() {
        return get(disabledServers).output_stream === false && !!get(serverData)?.output_stream?.sendAudio && !!this.getOutputShowId()
    }

    // https://stackoverflow.com/questions/48930799/connecting-nodes-with-each-other-with-the-web-audio-api
    private static initAnalysers() {
        if (this.analysers.length) {
            AudioAnalyserMerger.init()
            return
        }

        if (!this.splitter) {
            this.splitter = AudioMultichannel.createChannelSplitter(this.ac, this.channels)
        }

        // analyse left/right channels individually
        ;[...Array(this.channels)].forEach((_, channel) => {
            const analyser = (this.analysers[channel] = this.ac.createAnalyser())
            analyser.smoothingTimeConstant = 0.85
            analyser.fftSize = 256
            this.splitter!.connect(analyser, channel)
        })

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

    // update channel count and reinitialize audio nodes
    static updateChannelCount(newChannelCount: number) {
        const validatedChannelCount = AudioMultichannel.validateChannelCount(newChannelCount)
        if (!AudioMultichannel.shouldUpdateChannelCount(this.channels, validatedChannelCount)) return

        // disconnect existing connections
        if (this.splitter) {
            try {
                this.splitter.disconnect()
            } catch (err) {
                // already disconnected
            }
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
        Object.keys(this.sources).forEach((id) => {
            try {
                const source = this.sources[id]
                if (!source) return

                const processor = this.processors[id]
                if (!processor || !this.splitter) return

                const audioPlaying = get(playingAudio)[id]
                const isMic = audioPlaying?.isMic === true || id.startsWith("mic_sub_")
                if (!isMic) {
                    processor.output.connect(this.splitter)
                }
                this.connectGain(processor, id)
            } catch (err) {
                console.error(`Failed to reconnect source ${id}:`, err)
            }
        })

        this.initAnalysers()
    }

    static setPitch(id: string, value: number, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        Object.keys(this.processors).forEach((k) => {
            if (k === key || k === id || k.startsWith(`${id}_`)) {
                this.processors[k].pitch = value
            }
        })
    }

    static setTempo(id: string, value: number, outputId?: string) {
        const key = outputId ? `${id}_${outputId}` : id
        Object.keys(this.processors).forEach((k) => {
            if (k === key || k === id || k.startsWith(`${id}_`)) {
                this.processors[k].tempo = value
            }
        })
    }

    static connectToSinks(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        this.connectGain(source, id, outputId)
    }

    static disconnectFromSinks(source: AudioNode | PitchShiftNode, id?: string) {
        this.disconnectGain(source, id)
    }

    static connectGain(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source

        // Route input to configured mergers
        const audioPlaying = id ? get(playingAudio)[id] : null
        const videoPlaying = id ? get(playingVideos).some((v) => v.path === id) : false
        const isMic = audioPlaying?.isMic === true || (id && id.startsWith("mic_sub_"))
        const isVideo = videoPlaying || (id && id.startsWith("output_win_sub_")) || !!outputId

        const playlistId = audioPlaying?.playlistId
        const isPlaylist = !!playlistId
        const playlistSubId = playlistId ? `playlist_sub_${playlistId}` : null

        const nodeKey = id ? (isMic ? id : id === "metronome" ? "metronome" : isVideo ? "output_window" : isPlaylist ? playlistSubId! : "drawer_audio") : "drawer_audio"

        const manager = AudioRoutingManager.getInstance()
        manager.registerInputNode(nodeKey, node)

        // per item capture for visualizer
        // if (id) AudioInputCapture.getInstance().captureInput(id, node)

        if (isMic) {
            manager.registerInputNode("mic_default", node)
        } else if (isVideo) {
            manager.registerInputNode("output_window", node)
            if (outputId) {
                manager.registerInputNode(`output_win_sub_${outputId}`, node)
            }
        } else if (isPlaylist) {
            manager.registerInputNode("playlists_default", node)
        }

        manager.updateRoutingNodes()
    }

    static disconnectGain(source: AudioNode | PitchShiftNode, id?: string, outputId?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source

        const audioPlaying = id ? get(playingAudio)[id] : null
        const videoPlaying = id ? get(playingVideos).some((v) => v.path === id) : false
        const isMic = audioPlaying?.isMic === true || (id && id.startsWith("mic_sub_"))
        const isVideo = videoPlaying || (id && id.startsWith("output_win_sub_")) || !!outputId

        const playlistId = audioPlaying?.playlistId
        const isPlaylist = !!playlistId
        const playlistSubId = playlistId ? `playlist_sub_${playlistId}` : null

        const nodeKey = id ? (isMic ? id : id === "metronome" ? "metronome" : isVideo ? "output_window" : isPlaylist ? playlistSubId! : "drawer_audio") : "drawer_audio"
        AudioRoutingManager.getInstance().unregisterInputNode(nodeKey, node)

        // per item capture for visualizer
        // if (id) AudioInputCapture.getInstance().removeInput(id)

        if (isMic) {
            AudioRoutingManager.getInstance().unregisterInputNode("mic_default", node)
        } else if (isVideo) {
            AudioRoutingManager.getInstance().unregisterInputNode("output_window", node)
            if (outputId) {
                AudioRoutingManager.getInstance().unregisterInputNode(`output_win_sub_${outputId}`, node)
            }
        } else if (isPlaylist) {
            AudioRoutingManager.getInstance().unregisterInputNode("playlists_default", node)
        }

        try {
            node.disconnect()
        } catch (err) {
            // Node was already disconnected, ignore the error
        }
    }

    private static destinationNodes: Map<string, MediaStreamAudioDestinationNode> = new Map()
    private static getOrCreateDestinationNode(targetId: string): MediaStreamAudioDestinationNode {
        if (!this.destinationNodes.has(targetId)) {
            const destNode = AudioMultichannel.createMultichannelDestination(this.ac, this.channels)
            this.destinationNodes.set(targetId, destNode)
            AudioRoutingManager.getInstance().setDestinationNode(targetId, destNode)
        }
        return this.destinationNodes.get(targetId)!
    }

    // RECORDER
    private static recorders: Map<string, MediaRecorder> = new Map()
    private static initRecorder() {
        if (!this.recorderActive) return

        const activeTargets: string[] = []

        const connections = get(audioRouting)?.connections || []
        const isIcecastConnected = connections.some((c) => c.to === "icecast")
        if (isIcecastConnected) activeTargets.push("icecast")

        const activeStreamingOutputs = keysToID(get(outputs)).filter((out) => out && out.enabled && (out.ndi || out.blackmagic || out.webrtcData?.streaming || out.rtmpData?.streaming) && this.isOutputConnected(out.id, connections))
        activeStreamingOutputs.forEach((out) => {
            if (!activeTargets.includes(out.id)) activeTargets.push(out.id)
        })

        // OutputShow - this likely does not work
        if (this.sendOutputShowAudio()) {
            const outputId = this.getOutputShowId()
            if (outputId && !activeTargets.includes(outputId)) {
                activeTargets.push(outputId)
            }
        }

        // Clean up recorders for targets that are no longer active
        this.recorders.forEach((rec, targetId) => {
            if (!activeTargets.includes(targetId)) {
                try {
                    rec.stop()
                } catch {}
                this.recorders.delete(targetId)
            }
        })

        // Initialize recorders for active targets
        activeTargets.forEach((targetId) => {
            const existingRec = this.recorders.get(targetId)
            if (existingRec) {
                if (existingRec.state === "inactive") this.recorders.delete(targetId)
                else return
            }

            const destNode = this.getOrCreateDestinationNode(targetId)
            try {
                send(AUDIO, ["RESET_DECODER"], { id: targetId })
                const rec = new MediaRecorder(destNode.stream, {
                    mimeType: 'audio/webm; codecs="opus"'
                })
                rec.onerror = () => {
                    this.recorders.delete(targetId)
                }
                rec.onstop = () => {
                    this.recorders.delete(targetId)
                }
                rec.addEventListener("dataavailable", (ev) => {
                    if (!ev.data || ev.data.size === 0) return
                    ev.data.arrayBuffer().then((arrayBuffer) => {
                        const uint8Array = new Uint8Array(arrayBuffer)
                        if (targetId === "icecast") {
                            const icecast = { enabled: true, host: get(special).icecastHost, port: get(special).icecastPort, mount: get(special).icecastMount, password: get(special).icecastPassword ?? "hackme" }
                            send(AUDIO, ["CAPTURE"], { id: "icecast", buffer: uint8Array, icecast })
                        } else {
                            send(AUDIO, ["CAPTURE"], { id: targetId, buffer: uint8Array })
                        }
                    })
                })

                if (rec.state === "paused") rec.resume()
                else if (rec.state !== "recording") {
                    rec.start(Math.round(1000 / this.recorderFrameRate))
                }
                this.recorders.set(targetId, rec)
            } catch (err) {
                console.error(`[AudioAnalyser] Failed to start MediaRecorder for ${targetId}:`, err)
            }
        })
    }

    private static recorderActive = false
    static recorderActivate() {
        if (!this.shouldBeActive()) return

        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }

        this.recorderActive = true
        this.initRecorder()
    }
    static recorderDeactivate() {
        if (this.shouldBeActive()) return

        this.recorderActive = false
        this.recorders.forEach((rec) => {
            try {
                rec.stop()
            } catch {}
        })
        this.recorders.clear()
    }

    private static shouldBeActive() {
        if (this.sendOutputShowAudio()) return true

        const connections = get(audioRouting)?.connections || []
        if (this.isOutputConnected("icecast", connections)) return true

        const outputList = keysToID(get(outputs) || {}).filter(Boolean)
        const hasConnectedOutput = outputList.some((a) => a && a.enabled && (a.ndi || a.blackmagic || a.webrtcData?.streaming || a.rtmpData?.streaming) && this.isOutputConnected(a.id, connections))
        if (hasConnectedOutput) return true

        return false
    }

    private static isOutputConnected(id: string | undefined, connections: { from: string; to: string }[]): boolean {
        if (!id) return false
        return connections.some((c) => c.to.includes(id))
    }

    // custom audio output (supported in Chrome 110+)
    // https://developer.chrome.com/blog/audiocontext-setsinkid/
    // this applies to both audio & video
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

    static getChannelsVolume() {
        const volumes: AudioChannel[] = []
        for (let channel = 0; channel < this.channels; channel++) {
            volumes.push(this.getChannelVolume(channel))
        }
        return volumes
    }

    private static getChannelVolume(channelIndex: number): AudioChannel {
        const analyser = this.analysers[channelIndex]
        if (!analyser) return { dB: { value: AudioAnalyserMerger.dBmin } }

        analyser.minDecibels = AudioAnalyserMerger.dBmin
        analyser.maxDecibels = AudioAnalyserMerger.dBmax

        const size = analyser.fftSize // 256
        if (this.timeDomainArray.length !== size) {
            this.timeDomainArray = new Uint8Array(size)
        }
        const floatArray = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(floatArray)

        let sumSquare = 0
        const len = floatArray.length
        for (let i = 0; i < len; i++) {
            const sample = floatArray[i]
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
        // if (path) nodeId = path
        console.log(path)

        const captured = AudioInputCapture.getInstance().getAnalysers(nodeId)
        return captured // this.analysers
    }
}
