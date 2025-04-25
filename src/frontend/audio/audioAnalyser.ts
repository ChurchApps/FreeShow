import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { AUDIO, OUTPUT } from "../../types/Channels"
import { currentWindow, disabledServers, outputs, playingAudio, playingVideos, serverData, special } from "../stores"
import { send } from "../utils/request"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { AudioPlayer } from "./audioPlayer"

export class AudioAnalyser {
    static sampleRate = 48000 // Hz
    static channels = 2 // left/right
    static recorderFrameRate = 24 // fps
    // WIP set recorder send time delay?

    private static ac = new AudioContext({ latencyHint: "interactive", sampleRate: this.sampleRate })
    private static splitter = this.ac.createChannelSplitter(this.channels)
    private static analysers: AnalyserNode[] = []
    private static sources: { [key: string]: MediaElementAudioSourceNode | MediaStreamAudioSourceNode } = {}

    static attach(id: string, audio: HTMLMediaElement | MediaStream) {
        if (this.sources[id]) return

        let source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode
        try {
            if (audio instanceof MediaStream) source = this.ac.createMediaStreamSource(audio)
            else source = this.ac.createMediaElementSource(audio)
            this.sources[id] = source
        } catch (err) {
            console.error("Could not create media source:", err)
            return
        }

        this.initAnalysers()
        this.initRecorder()
        this.customOutput(get(special).audioOutput)

        source.connect(this.splitter)
        this.connectGain(source)
        this.connectDestination(source)
    }

    static detach(id: string) {
        const source = this.sources[id]
        if (!source) return

        this.recorderDeactivate()
        this.disconnectGain(source)
        this.disconnectDestination(source)
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

    private static connectGain(source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode) {
        this.initGain()
        source.connect(this.gainNode!)
    }
    private static disconnectGain(source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode) {
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

    private static connectDestination(source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode) {
        this.initDestination()
        source.connect(this.destNode!)
    }
    private static disconnectDestination(source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode) {
        if (!this.destNode) return
        source.disconnect(this.destNode)
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

    static getSource(id: string): MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null {
        return this.sources[id] || null
    }

    static getAnalysers() {
        return this.analysers
    }
}
