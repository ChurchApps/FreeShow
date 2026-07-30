import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { AUDIO, OUTPUT } from "../../types/Channels"
import { audioEffects, audioRouting, disabledServers, media, outputs, playingAudio, playingVideos, serverData, special, videosData } from "../stores"
import { isOutputWindow } from "../utils/common"
import { send } from "../utils/request"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { AudioMultichannel, MultichannelInfo } from "./audioMultichannel"
import { AudioPlayer } from "./audioPlayer"
import { AudioProcessor, PitchShiftNode } from "./audioProcessor"
import { initializeCompressor } from "./effects/audioCompressor"
import { initializeDelay } from "./effects/audioDelay"
import { disconnectAudioSourceFromEqualizer, getGlobalEqualizer, getGlobalEqualizerNodes, initializeEqualizer, setAutoInitializeCallback } from "./effects/audioEqualizer"
import { initializeFilter } from "./effects/audioFilter"
import { initializeLimiter } from "./effects/audioLimiter"
import { initializeNoiseGate } from "./effects/audioNoiseGate"
import { initializeReverb } from "./effects/audioReverb"
import { initializeStereoShaper } from "./effects/audioStereoShaper"
import { AudioInputCapture } from "./routing/audioInputCapture"
import { AudioRoutingManager } from "./routing/audioRoutingManager"

export class AudioAnalyser {
    static sampleRate = 48000 // Hz
    static channels = AudioMultichannel.DEFAULT_CHANNELS // default left/right, will be updated dynamically
    static maxChannels = AudioMultichannel.MAX_CHANNELS // support up to 8 channels (7.1 surround)
    static recorderFrameRate = 24 // fps
    // WIP set recorder send time delay?

    private static ac = new AudioContext({ latencyHint: "interactive", sampleRate: this.sampleRate })
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
        return this.ac
    }

    // Set up auto-initialization for equalizer when first audio source connects
    static {
        setAutoInitializeCallback(async () => {
            await initializeEqualizer(this.getAudioContext(), async () => {
                this.rebuildEffectChain()
            })
        })

        playingAudio.subscribe(() => this.updateScales())
        playingVideos.subscribe(() => this.updateScales())
        videosData.subscribe(() => this.updateScales())
        audioRouting.subscribe(() => {
            // Re-route everything through the routing manager
        })
    }

    static async attach(id: string, audio: HTMLMediaElement | MediaStream) {
        if (this.sources[id]) return

        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }

        let source: AudioNode
        try {
            console.log(`[AudioAnalyser] Attaching ${id}`, audio)
            if (audio instanceof MediaStream) {
                source = this.ac.createMediaStreamSource(audio)
            } else {
                // For HTMLMediaElement, we use the element as source
                source = this.ac.createMediaElementSource(audio)
            }

            const audioChannel = get(special).audioChannel || ""
            if (audioChannel === "mono_left" || audioChannel === "mono_right") {
                const merger = this.ac.createChannelMerger(2)
                const channel = audioChannel === "mono_left" ? 0 : 1
                source.connect(merger, 0, channel)
                this.sources[id] = merger
            } else {
                this.sources[id] = source
            }
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        // Start the pipeline immediately with the current channel count (no blocking)
        AudioRoutingManager.getInstance().setAudioContext(this.getAudioContext())
        this.initAnalysers()
        this.initDestination()
        this.initRecorder()
        this.customOutput(get(special).audioOutput)

        // Equalizer is now applied globally in the master effect chain to prevent cross-source leakage
        if (this.sources[id]) {
            if (!this.splitter) return

            const processor = AudioProcessor.createNode(this.ac)
            this.processors[id] = processor

            // Create individual gain node to control this source's volume in Web Audio
            const sourceGain = this.ac.createGain()
            this.gainNodes[id] = sourceGain
            const initialVolume = audio instanceof HTMLMediaElement ? audio.volume : 1.0
            sourceGain.gain.setValueAtTime(initialVolume, this.ac.currentTime)

            this.sources[id].connect(sourceGain)
            sourceGain.connect(processor.input)

            const audioPlaying = get(playingAudio)[id]

            // Capture for settings audio routing visualizer
            // A more reliable check: actual media streams are hardware inputs (mics),
            // while HTMLMediaElements are files from the drawer.
            const isMic = audio instanceof MediaStream || (audioPlaying && audioPlaying.isMic === true)
            const nodeKey = isMic ? id : id === "metronome" ? "metronome" : "drawer_audio"
            console.log(`[AudioAnalyser] Registering input node for "${id}" with key "${nodeKey}"`)

            AudioInputCapture.getInstance().captureInput(nodeKey, sourceGain)
            AudioRoutingManager.getInstance().registerInputNode(nodeKey, processor.output)

            // For microphones, also register to the parent mic group
            if (isMic) {
                AudioRoutingManager.getInstance().registerInputNode("mic_default", processor.output)
                // We don't need a separate captureInput for mic_default as it's aggregated in the visualizer logic
            }



            // Route audio to configured mergers
            this.connectToSinks(processor, id)

            if (isMic) {
                // Microphones should not be scaled by activeCount (they are independent)
                const micVol = audioPlaying?.audio?.volume ?? 1.0
                sourceGain.gain.setValueAtTime(micVol, this.ac.currentTime)

                // Ensure context is running - vital for MediaStream sources (microphones)
                if (this.ac.state === "suspended") {
                    console.log("[AudioAnalyser] Resuming suspended context for mic")
                    this.ac.resume().catch((err) => console.error("Could not resume AudioContext for mic:", err))
                }

                // Force a routing update for the mic to ensure connections are established
                console.log("[AudioAnalyser] Scheduling routing update for mic")
                setTimeout(() => {
                    AudioRoutingManager.getInstance().updateRoutingNodes()
                }, 100)
            } else {
                this.updateScales()
            }

            const mediaData = get(media)[id]
            if (mediaData) {
                processor.pitch = mediaData.pitch ?? 0
                processor.tempo = mediaData.tempo ?? 1
            }
        } else {
            console.warn(`Failed to connect audio source "${id}" to equalizer`)
        }

        // Detect true channel count in the background — upgrades the graph if the file
        // has more channels than the current default. Does not delay playback startup.
        this.detectAndUpgradeChannels(id, audio)
    }

    static setSourceVolume(id: string, volume: number) {
        if (this.ac.state === "suspended") {
            this.ac.resume().catch(() => {})
        }
        const gainNode = this.gainNodes[id]
        if (gainNode) {
            gainNode.gain.setValueAtTime(volume, this.ac.currentTime)
        }
    }

    private static updateScales() {
        Object.keys(this.gainNodes).forEach((id) => {
            const gainNode = this.gainNodes[id]
            if (gainNode) {
                let baseVolume: number | null = null
                const audioPlaying = get(playingAudio)[id]
                if (audioPlaying) {
                    if (audioPlaying.isMic || id.startsWith("mic_sub_")) {
                        const micVolume = audioPlaying.audio?.volume ?? 1.0
                        gainNode.gain.setValueAtTime(micVolume, this.ac.currentTime)
                        return
                    }
                    baseVolume = audioPlaying.audio?.volume ?? 1.0
                } else if (id === "metronome") {
                    baseVolume = 1.0
                } else {
                    const videoPlaying = get(playingVideos).find((v) => v.id === id)
                    if (videoPlaying) baseVolume = videoPlaying.video?.volume ?? 1.0
                }
                if (baseVolume !== null) gainNode.gain.setValueAtTime(baseVolume, this.ac.currentTime)
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

    static detach(id: string) {
        const source = this.sources[id]
        if (!source) return

        const processor = this.processors[id]

        const audioPlaying = get(playingAudio)[id]
        const isMic = audioPlaying?.isMic === true || id.startsWith("mic_sub_")
        const nodeKey = isMic ? id : id === "metronome" ? "metronome" : "drawer_audio"

        // Use disconnectGain to handle all unregistrations consistently
        this.disconnectGain(processor || source, id)

        // Only remove capture visualizer for drawer_audio if no more drawer audio files are playing
        if (nodeKey === "drawer_audio") {
            const stillPlayingDrawer = Object.keys(get(playingAudio)).some((k) => k !== id && get(playingAudio)[k]?.isMic !== true)
            if (!stillPlayingDrawer) {
                AudioInputCapture.getInstance().removeInput(nodeKey)
            }
        } else {
            AudioInputCapture.getInstance().removeInput(nodeKey)
        }
        this.recorderDeactivate()

        // Disconnect and remove processor
        if (processor) {
            delete this.processors[id]
        }

        const sourceGain = this.gainNodes[id]
        if (sourceGain) {
            try {
                sourceGain.disconnect()
            } catch (e) {}
            delete this.gainNodes[id]
        }

        // Disconnect from equalizer
        disconnectAudioSourceFromEqualizer(id)

        delete this.sources[id]

        if (!isOutputWindow()) return

        // wait for audio to clear before checking
        setTimeout(() => {
            if (!this.shouldAnalyse()) {
                AudioAnalyserMerger.stop()
                send(OUTPUT, ["AUDIO_MAIN"], { id: Object.keys(get(outputs))[0], stop: true })
            }
        })
    }

    static shouldAnalyse() {
        return this.getActiveAudio() || this.getActiveVideos() || this.sendOutputShowAudio()
    }
    private static getActiveAudio() {
        return !!Object.values(get(playingAudio)).filter((a) => !a.paused).length
    }
    private static getActiveVideos() {
        return !!Object.values(get(playingVideos)).filter((a) => !a.video?.paused && !a.video?.muted).length
    }
    private static sendOutputShowAudio() {
        return get(disabledServers).output_stream === false && get(serverData)?.output_stream?.sendAudio
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

        const MERGER = AudioMultichannel.createChannelMerger(this.ac, this.channels)

        // analyse left/right channels individually
        ;[...Array(this.channels)].forEach((_, channel) => {
            const analyser = (this.analysers[channel] = this.ac.createAnalyser())
            analyser.smoothingTimeConstant = 0.85
            analyser.fftSize = 256
            this.splitter!.connect(analyser, channel)
            this.splitter!.connect(MERGER, channel, channel)
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

        if (this.destNode) AudioMultichannel.configureNodeForMultichannel(this.destNode, this.channels)
        if (this.gainNode) AudioMultichannel.configureNodeForMultichannel(this.gainNode, this.channels)

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

    private static gainNode: GainNode | null = null
    private static effectNodes: { [K: string]: { input: GainNode; output: GainNode } } = {}

    private static initGain() {
        if (this.gainNode) return

        this.gainNode = AudioMultichannel.createMultichannelGainNode(this.ac, this.channels)
        this.gainNode.gain.value = AudioPlayer.getGain()

        // Pass master gain node to routing manager so mergers connect to it
        AudioRoutingManager.getInstance().setMasterNode(this.gainNode)

        // Ensure Equalizer is initialized if needed
        const currentEq = getGlobalEqualizer()
        if (!currentEq) {
            initializeEqualizer(this.getAudioContext()).then(() => {
                this.rebuildEffectChain()
            })
        }

        this.rebuildEffectChain()

        // Rebuild chain when any effect is toggled (not on param changes)
        let prevEnabled = ""
        audioEffects.subscribe(() => {
            const m = get(audioEffects).main
            const enabled = [m?.equalizer, m?.filter, m?.noiseGate, m?.compressor, m?.reverb, m?.delay, m?.limiter, m?.stereoShaper].map((e) => (e?.enabled ? 1 : 0)).join("")
            if (enabled !== prevEnabled) {
                prevEnabled = enabled
                this.rebuildEffectChain()
            }
        })
    }

    private static rebuildEffectChain() {
        if (!this.gainNode) return

        try {
            this.gainNode.disconnect()
        } catch {
            /* not yet connected */
        }
        for (const node of Object.values(this.effectNodes)) {
            try {
                node.output.disconnect()
            } catch {}
        }

        // We don't need to disconnect destination itself as it's a sink,
        // but we'll ensure we disconnect the nodes connected to it.
        try {
            // No direct way to find what's connected to destination without external tracking,
            // but our gainNode/effect chain will be disconnected in the loop above.
        } catch {}

        const main = get(audioEffects).main
        const chain: { input: GainNode; output: GainNode }[] = []

        if (main?.equalizer?.enabled) {
            const eqNodes = getGlobalEqualizerNodes()
            if (eqNodes) chain.push(eqNodes)
        }
        if (main?.filter?.enabled) chain.push((this.effectNodes.filter ??= initializeFilter(this.ac)))
        if (main?.noiseGate?.enabled) chain.push((this.effectNodes.noiseGate ??= initializeNoiseGate(this.ac)))
        if (main?.compressor?.enabled) chain.push((this.effectNodes.compressor ??= initializeCompressor(this.ac)))
        if (main?.reverb?.enabled) chain.push((this.effectNodes.reverb ??= initializeReverb(this.ac)))
        if (main?.delay?.enabled) chain.push((this.effectNodes.delay ??= initializeDelay(this.ac)))
        if (main?.limiter?.enabled) chain.push((this.effectNodes.limiter ??= initializeLimiter(this.ac)))
        if (main?.stereoShaper?.enabled) chain.push((this.effectNodes.stereoShaper ??= initializeStereoShaper(this.ac)))

        let prev: AudioNode = this.gainNode
        for (const seg of chain) {
            prev.connect(seg.input)
            prev = seg.output
        }

        // Master gain node is managed by AudioRoutingManager
        try {
            AudioInputCapture.getInstance().captureInput("speaker_default", prev)
        } catch (e) {}
    }

    static setGain(value: number) {
        if (!this.gainNode) this.initGain()
        this.gainNode!.gain.setValueAtTime(Math.max(0, value), this.ac.currentTime)
    }

    static setPitch(id: string, value: number) {
        const processor = this.processors[id]
        if (processor) {
            processor.pitch = value
        }
    }

    static setTempo(id: string, value: number) {
        const processor = this.processors[id]
        if (processor) {
            processor.tempo = value
        }
    }

    static connectToSinks(source: AudioNode | PitchShiftNode, id?: string) {
        if (!this.splitter) return
        this.connectGain(source, id)
    }

    static disconnectFromSinks(source: AudioNode | PitchShiftNode, id?: string) {
        this.disconnectGain(source, id)
    }

    static connectGain(source: AudioNode | PitchShiftNode, id?: string) {
        this.initGain()
        const node = source instanceof PitchShiftNode ? source.output : source

        // Route input to configured mergers
        const audioPlaying = id ? get(playingAudio)[id] : null
        const isMic = audioPlaying?.isMic === true || (id && id.startsWith("mic_sub_"))
        const nodeKey = id ? (isMic ? id : id === "metronome" ? "metronome" : "drawer_audio") : "drawer_audio"

        const manager = AudioRoutingManager.getInstance()
        manager.registerInputNode(nodeKey, node)

        // Also route generic group if applicable (e.g. mic_default)
        if (isMic) {
            manager.registerInputNode("mic_default", node)
        }

        manager.updateRoutingNodes()
    }

    static disconnectGain(source: AudioNode | PitchShiftNode, id?: string) {
        const node = source instanceof PitchShiftNode ? source.output : source
        const audioPlaying = id ? get(playingAudio)[id] : null
        const isMic = audioPlaying?.isMic === true || (id && id.startsWith("mic_sub_"))
        const nodeKey = id ? (isMic ? id : id === "metronome" ? "metronome" : "drawer_audio") : "drawer_audio"
        AudioRoutingManager.getInstance().unregisterInputNode(nodeKey, node)

        // Also unregister from generic microphone if applicable
        if (isMic) {
            AudioRoutingManager.getInstance().unregisterInputNode("mic_default", node)
        }

        try {
            node.disconnect()
        } catch (err) {
            // Node was already disconnected, ignore the error
        }
    }

    private static destNode: MediaStreamAudioDestinationNode | null = null
    private static initDestination() {
        if (this.destNode) return

        this.destNode = AudioMultichannel.createMultichannelDestination(this.ac, this.channels)
        AudioRoutingManager.getInstance().setDestinationNode(this.destNode)
    }

    // RECORDER
    private static recorder: MediaRecorder | null = null
    private static initRecorder() {
        if (this.recorder || !this.recorderActive) return
        this.initDestination()

        const id = isOutputWindow() ? Object.keys(get(outputs))[0] : "main"
        // might only work in "main" for OutputShow

        try {
            this.recorder = new MediaRecorder(this.destNode!.stream, {
                mimeType: 'audio/webm; codecs="opus"'
            })
            this.recorder.addEventListener("dataavailable", async (ev) => {
                const arrayBuffer = await ev.data.arrayBuffer()
                const uint8Array = new Uint8Array(arrayBuffer)
                // , audioDelay: 0, channels: this.channels, frameRate: this.recorderFrameRate
                const icecast = { enabled: !!get(special).icecastEnabled, host: get(special).icecastHost, port: get(special).icecastPort, mount: get(special).icecastMount, password: get(special).icecastPassword }

                send(AUDIO, ["CAPTURE"], { id, buffer: uint8Array, icecast })
            })

            if (this.recorder.state === "paused") this.recorder.play()
            else if (this.recorder.state !== "recording") {
                this.recorder.start(Math.round(1000 / this.recorderFrameRate))
            }
        } catch (err) {
            console.error(`[AudioAnalyser] Failed to start MediaRecorder:`, err)
        }
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
        if (this.shouldBeActive() || !this.recorder) return

        this.recorderActive = false
        this.recorder.stop()
        this.recorder = null
    }

    private static shouldBeActive() {
        let outputList = Object.values(get(outputs))
        if (isOutputWindow()) outputList = [Object.values(get(outputs))[0]]

        if (outputList.find((a) => a && a.enabled && (a.webrtc || a.rtmp || a.ndi || a.blackmagic))) return true
        if (get(special).icecastEnabled) return true

        const routing = get(audioRouting)
        if (routing?.connections.some((c) => c.to === "network_default" || c.to === "icecast" || c.to.startsWith("network_sub_"))) {
            return true
        }

        return false
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

    static getAnalysers() {
        return this.analysers
    }
}
