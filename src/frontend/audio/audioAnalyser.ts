import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { AUDIO, OUTPUT } from "../../types/Channels"
import { currentWindow, disabledServers, outputs, playingAudio, playingVideos, serverData, special } from "../stores"
import { send } from "../utils/request"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { connectAudioSourceToEqualizer, disconnectAudioSourceFromEqualizer, getConnectedSourceOutput, initializeEqualizer, setAutoInitializeCallback } from "./audioEqualizer"
import { AudioMultichannel, MultichannelInfo } from "./audioMultichannel"
import { AudioPlayer } from "./audioPlayer"

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

    // Expose the AudioContext for other audio systems to use the same context
    static getAudioContext(): AudioContext {
        return this.ac
    }

    // Set up auto-initialization for equalizer when first audio source connects
    static {
        setAutoInitializeCallback(async () => {
            await initializeEqualizer(this.getAudioContext(), async () => {
                await this.refreshEqualizerConnections()
            })
        })
    }

    static async attach(id: string, audio: HTMLMediaElement | MediaStream) {
        if (this.sources[id]) return

        let source: AudioNode
        try {
            if (audio instanceof MediaStream) source = this.ac.createMediaStreamSource(audio)
            else source = this.ac.createMediaElementSource(audio)

            // detect number of channels in audio source
            const detectedChannels = AudioMultichannel.detectChannelCount(source, audio, this.maxChannels)
            if (detectedChannels > this.channels) this.updateChannelCount(detectedChannels)

            this.sources[id] = source
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        this.initAnalysers()
        this.initRecorder()
        this.customOutput(get(special).audioOutput)

        // Connect through equalizer first, then to analysis chain
        const eqOutputNode = await connectAudioSourceToEqualizer(id, source)

        // Connect the equalizer output (or original source if EQ bypassed) to analysis chain
        if (eqOutputNode && this.splitter) {
            eqOutputNode.connect(this.splitter)
            this.connectGain(eqOutputNode)
            this.connectDestination(eqOutputNode)
            console.log(`Audio source "${id}" connected to equalizer and analysis chain`)

            // Perform runtime channel detection after connection and audio stabilization
            // timeout to give more time for audio to stabilize
            setTimeout(async () => {
                try {
                    const runtimeChannels = await this.detectActiveChannelCount(id)
                    if (runtimeChannels > this.channels) {
                        console.log(`Runtime detection found ${runtimeChannels} channels, updating from ${this.channels}`)
                        this.updateChannelCount(runtimeChannels)
                    }
                } catch (err) {
                    console.warn(`Runtime channel detection failed for ${id}:`, err)
                }
            }, 1500)
        } else {
            console.warn(`Failed to connect audio source "${id}" to equalizer`)
        }
    }

    static detach(id: string) {
        const source = this.sources[id]
        if (!source) return

        this.recorderDeactivate()
        this.disconnectGain(source)
        this.disconnectDestination(source)

        // Disconnect from equalizer
        disconnectAudioSourceFromEqualizer(id)

        delete this.sources[id]

        if (get(currentWindow) !== "output") return

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
        return !!Object.values(get(playingVideos)).filter((a) => !a.paused && !a.muted).length
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

    static async detectActiveChannelCount(sourceId: string): Promise<number> {
        const source = this.sources[sourceId]
        return AudioMultichannel.detectActiveChannelCount(this.ac, source, sourceId, this.maxChannels)
    }

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
        if (!AudioMultichannel.shouldUpdateChannelCount(this.channels, validatedChannelCount)) {
            console.log(`Channel count update skipped: current=${this.channels}, requested=${newChannelCount}, validated=${validatedChannelCount}`)
            return
        }

        console.log(`🔄 Updating channel count from ${this.channels} to ${validatedChannelCount}`)

        // Log debug info before update
        AudioMultichannel.debugChannelInfo(this.ac, this.channels, this.maxChannels)

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

        console.log(`✅ Channel count updated to ${this.channels}`)
    }

    private static reconnectAllSources() {
        Object.keys(this.sources).forEach((id) => {
            try {
                const source = this.sources[id]
                if (!source) return

                const eqOutputNode = getConnectedSourceOutput(id)
                if (!eqOutputNode || !this.splitter) return

                eqOutputNode.connect(this.splitter)
                this.connectGain(eqOutputNode)
                this.connectDestination(eqOutputNode)
            } catch (err) {
                console.error(`Failed to reconnect source ${id}:`, err)
            }
        })

        this.initAnalysers()
    }

    private static gainNode: GainNode | null = null
    private static initGain() {
        if (this.gainNode) return

        this.gainNode = AudioMultichannel.createMultichannelGainNode(this.ac, this.channels)
        this.gainNode.connect(this.ac.destination)
        this.gainNode.gain.value = AudioPlayer.getGain()
    }

    static setGain(value: number) {
        if (!this.gainNode) this.initGain()
        this.gainNode!.gain.value = Math.max(1, value)
    }

    private static connectGain(source: AudioNode) {
        this.initGain()
        source.connect(this.gainNode!)
    }

    private static disconnectGain(source: AudioNode) {
        if (!this.gainNode) return

        try {
            source.disconnect(this.gainNode)
        } catch (err) {
            // Node was already disconnected, ignore the error
        }
    }

    private static destNode: MediaStreamAudioDestinationNode | null = null
    private static initDestination() {
        if (this.destNode) return

        this.destNode = AudioMultichannel.createMultichannelDestination(this.ac, this.channels)
    }

    private static connectDestination(source: AudioNode) {
        this.initDestination()

        AudioMultichannel.configureNodeForMultichannel(source, this.channels)

        source.connect(this.destNode!)
    }

    private static disconnectDestination(source: AudioNode) {
        if (!this.destNode) return

        try {
            source.disconnect(this.destNode)
        } catch (err) {
            // Node was already disconnected, ignore the error
        }
    }

    // RECORDER
    private static recorder: MediaRecorder | null = null
    private static initRecorder() {
        if (this.recorder || !this.recorderActive) return
        this.initDestination()

        const id = get(currentWindow) === "output" ? Object.keys(get(outputs))[0] : "main"
        // might only work in "main" for OutputShow

        this.recorder = new MediaRecorder(this.destNode!.stream, {
            mimeType: 'audio/webm; codecs="opus"',
        })
        this.recorder.addEventListener("dataavailable", async (ev) => {
            const arrayBuffer = await ev.data.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            // , audioDelay: 0, channels: this.channels, frameRate: this.recorderFrameRate
            send(AUDIO, ["CAPTURE"], { id, buffer: uint8Array })
        })

        if (this.recorder.state === "paused") this.recorder.play()
        else if (this.recorder.state !== "recording") {
            this.recorder.start(Math.round(1000 / this.recorderFrameRate))
        }
    }

    private static recorderActive = false
    static recorderActivate() {
        if (!this.shouldBeActive()) return

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
        if (get(currentWindow) === "output") outputList = [Object.values(get(outputs))[0]]

        // any outputs with ndi audio enabled
        if (outputList.find((a) => a.enabled && a.ndi && a.ndiData?.audio)) return true
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
        return [...Array(this.channels)].map((_, channel) => this.getChannelVolume(channel))
    }

    private static getChannelVolume(channelIndex: number): AudioChannel {
        const analyser = this.analysers[channelIndex]
        if (!analyser) return { dB: { value: AudioAnalyserMerger.dBmin } }

        analyser.minDecibels = AudioAnalyserMerger.dBmin
        analyser.maxDecibels = AudioAnalyserMerger.dBmax

        const size = analyser.fftSize // 256
        const array = new Uint8Array(size)

        // analyze amplitude values in time domain
        analyser.getByteTimeDomainData(array)

        // calculate RMS value to represent perceived volume
        const sumOfSquares = array.reduce((sum, value) => {
            const normalizedValue = (value - 128) / 128 // Normalize between -1 and 1
            return sum + normalizedValue * normalizedValue
        }, 0)

        const rms = Math.sqrt(sumOfSquares / array.length)

        // map RMS to dB scale & protect against log(0)
        const dB = 20 * Math.log10(rms || 0.0001)

        // const volume = rms
        return { dB: { value: dB } }
    }

    static getSource(id: string): AudioNode | null {
        return this.sources[id] || null
    }

    static getAnalysers() {
        return this.analysers
    }

    // Refresh all audio connections through equalizer (called when equalizer is re-initialized)
    static async refreshEqualizerConnections() {
        console.log("Refreshing all audio connections through new equalizer instance")

        // Get all current source IDs
        const sourceIds = Object.keys(this.sources)

        if (sourceIds.length === 0) {
            console.log("No audio sources to refresh")
            return
        }

        // For each source, seamlessly switch to new equalizer without audio interruption
        for (const id of sourceIds) {
            const source = this.sources[id]
            if (source) {
                try {
                    // Get the old equalizer output node before disconnecting
                    const oldConnection = getConnectedSourceOutput(id)

                    // Disconnect from old equalizer (but keep analysis connections alive)
                    disconnectAudioSourceFromEqualizer(id)

                    // Immediately connect to new equalizer to minimize audio gap
                    const newEqOutputNode = await connectAudioSourceToEqualizer(id, source)

                    if (newEqOutputNode) {
                        // Disconnect old analysis connections if they exist
                        if (oldConnection && this.splitter) {
                            try {
                                oldConnection.disconnect(this.splitter)
                                this.disconnectGain(oldConnection)
                                this.disconnectDestination(oldConnection)
                            } catch (err) {
                                // Old connections might not exist, that's fine
                            }
                        }

                        // Connect new equalizer output to analysis chain
                        if (this.splitter) {
                            newEqOutputNode.connect(this.splitter)
                            this.connectGain(newEqOutputNode)
                            this.connectDestination(newEqOutputNode)
                        }

                        console.log(`Seamlessly switched equalizer connection for audio source: ${id}`)
                    }
                } catch (err) {
                    console.error(`Failed to refresh equalizer connection for ${id}:`, err)
                }
            }
        }
    }
}
