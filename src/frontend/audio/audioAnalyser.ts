import { get } from "svelte/store"
import { special } from "../stores"
import { send } from "../utils/request"
import { AUDIO } from "../../types/Channels"
import { AudioPlayer } from "./audioPlayer"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"

export class AudioAnalyser {
    static sampleRate = 48000 // Hz
    static channels = 2
    // static recorderFramerate = 24
    static recorderFrameRate = 0.5 // DEBUG

    private static ac = new AudioContext({ latencyHint: "interactive", sampleRate: this.sampleRate })
    private static splitter = this.ac.createChannelSplitter(this.channels)
    private static analysers: AnalyserNode[] = []
    private static sources: { [key: string]: MediaElementAudioSourceNode } = {}

    static attach(id: string, audio: HTMLAudioElement) {
        if (this.sources[id]) return

        let source: MediaElementAudioSourceNode
        try {
            source = this.ac.createMediaElementSource(audio)
            this.sources[id] = source
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        this.initAnalysers()
        this.initRecorder()
        if (get(special).audioOutput) this.customOutput(get(special).audioOutput)

        source.connect(this.splitter)
        this.connectGain(source)
        this.connectDestination(source)
    }

    static detach(id: string) {
        const source = this.sources[id]
        if (!source) return

        this.disconnectGain(source)
        this.disconnectDestination(source)
        delete this.sources[id]
    }

    // https://stackoverflow.com/questions/48930799/connecting-nodes-with-each-other-with-the-web-audio-api
    private static initAnalysers() {
        if (this.analysers.length) return

        const MERGER = this.ac.createChannelMerger(this.channels)

        // analyse left/right channels individually
        ;[...Array(this.channels)].forEach((_, channel) => {
            const analyser = (this.analysers[channel] = this.ac.createAnalyser())
            analyser.smoothingTimeConstant = 0.9
            analyser.fftSize = 256
            this.splitter.connect(analyser, channel)
            this.splitter.connect(MERGER, channel, channel)
        })

        AudioAnalyserMerger.init()
    }

    private static gainNode: GainNode | null = null
    private static initGain() {
        if (this.gainNode) return

        this.gainNode = this.ac.createGain()
        this.gainNode.connect(this.ac.destination)
        this.gainNode.gain.value = AudioPlayer.getGain()
    }

    static setGain(value: number) {
        if (!this.gainNode) this.initGain()
        this.gainNode!.gain.value = Math.max(1, value)
    }

    private static connectGain(source: MediaElementAudioSourceNode) {
        this.initGain()
        source.connect(this.gainNode!)
    }
    private static disconnectGain(source: MediaElementAudioSourceNode) {
        if (!this.gainNode) return
        source.disconnect(this.gainNode)
    }

    private static destNode: MediaStreamAudioDestinationNode | null = null
    private static initDestination() {
        if (this.destNode) return

        this.destNode = this.ac.createMediaStreamDestination()
        this.destNode.channelCount = this.channels
        this.destNode.channelCountMode = "explicit"
        this.destNode.channelInterpretation = "speakers"
    }

    private static connectDestination(source: MediaElementAudioSourceNode) {
        this.initDestination()
        source.connect(this.destNode!)
    }
    private static disconnectDestination(source: MediaElementAudioSourceNode) {
        if (!this.destNode) return
        source.connect(this.destNode)
    }

    // RECORDER
    private static recorder: MediaRecorder | null = null
    private static initRecorder() {
        if (this.recorder || !this.recorderActive) return
        if (!this.destNode) this.initDestination()

        this.recorder = new MediaRecorder(this.destNode!.stream, {
            mimeType: 'audio/webm; codecs="opus"',
            // mimeType: 'audio/webm; codecs="pcm"',
        })
        this.recorder.addEventListener("dataavailable", async (ev) => {
            const ab = await ev.data.arrayBuffer()
            const u8 = new Uint8Array(ab, 0, ab.byteLength)
            send(AUDIO, ["CAPTURE"], u8)
        })

        if (this.recorder.state === "paused") this.recorder.play()
        else if (this.recorder.state !== "recording") {
            this.recorder.start(Math.round(1000 / this.recorderFrameRate))
        }
    }

    private static recorderActive: boolean = false
    static recorderActivate() {
        this.recorderActive = true
        this.initRecorder()
    }
    static recorderDeactivate() {
        if (!this.recorder) return

        this.recorderActive = false
        this.recorder.stop()
        this.recorder = null
    }

    // custom audio output (supported in Chrome 110+)
    // https://developer.chrome.com/blog/audiocontext-setsinkid/
    // this applies to both audio & video
    static async customOutput(sinkId: string) {
        this.initAnalysers()

        try {
            await (this.analysers as any).setSinkId(sinkId)
            return true
        } catch (err) {
            console.error("Could not set custom audio sink ID:", err)
            return false
        }
    }

    // CHANNEL

    static getChannelsVolume() {
        this.initAnalysers()
        return [...Array(this.channels)].map((_, channel) => this.getChannelVolume(channel))
    }

    // private static getChannelVolume(channelIndex: number) {
    //     const analyser = this.analysers[channelIndex]

    //     const size = analyser.fftSize
    //     var array = new Uint8Array(size)

    //     // decibels

    //     analyser.getByteFrequencyData(array)
    //     console.log(analyser)
    //     console.log(array)
    //     analyser.maxDecibels = -10
    //     // analyser.maxDecibels = 0
    //     let value = array[0]
    //     let percent = value / (array.length - 1)
    //     let dB = analyser.minDecibels + (analyser.maxDecibels - analyser.minDecibels) * percent

    //     return { volume: 1, dB: { value: dB, min: analyser.minDecibels, max: analyser.maxDecibels } }
    // }

    private static getChannelVolume(channelIndex: number) {
        const analyser = this.analysers[channelIndex]

        const size = analyser.fftSize // 256
        const array = new Uint8Array(size)

        // Analyze amplitude values in time domain
        analyser.getByteTimeDomainData(array)

        // Calculate RMS value to represent perceived volume
        const sumOfSquares = array.reduce((sum, value) => {
            const normalizedValue = (value - 128) / 128 // Normalize between -1 and 1
            return sum + normalizedValue * normalizedValue
        }, 0)

        const rms = Math.sqrt(sumOfSquares / array.length)

        // Map RMS to dB scale
        const dB = 20 * Math.log10(rms || 0.0001) // Protect against log(0)

        return {
            volume: rms,
            dB: { value: dB, min: analyser.minDecibels, max: analyser.maxDecibels },
        }
    }

    static getSource(id: string): MediaElementAudioSourceNode | null {
        return this.sources[id] || null
    }

    static getAnalysers() {
        return this.analysers
    }
}
