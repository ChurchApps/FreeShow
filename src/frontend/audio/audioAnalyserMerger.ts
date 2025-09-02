import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { OUTPUT } from "../../types/Channels"
import { audioChannels, currentWindow, outputs } from "../stores"
import { send } from "../utils/request"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"

export class AudioAnalyserMerger {
    static dBmin = -80
    static dBmax = 0

    private static channels: { [key: string]: AudioChannel[] } = {}

    static init() {
        this.timeoutNext()
    }

    static addChannels(id: string, channels: AudioChannel[]) {
        this.channels[id] = channels
        AudioAnalyserMerger.init()
    }

    static stop() {
        if (!this.timeout) return
        clearTimeout(this.timeout)
        this.timeout = null
        this.channels = {}
        this.smoothedVolumes = {} // Clean up smoothed volumes cache
        audioChannels.set([])
    }

    private static timeout: NodeJS.Timeout | null = null
    private static previousMerge = 0
    private static updateInterval = 80
    private static timeoutNext() {
        if (this.timeout) return
        const timeSinceLast = Date.now() - this.previousMerge
        if (timeSinceLast > this.updateInterval + 100 && timeSinceLast < this.updateInterval + 200) {
            // wait if lagging behind
            this.timeout = setTimeout(() => {
                this.timeout = null
                this.timeoutNext()
            }, 150)
            return
        }

        this.checkAudioTime()
        this.mergeAnalysers()
        this.previousMerge = Date.now()

        this.timeout = setTimeout(() => {
            this.timeout = null
            this.timeoutNext()
        }, this.updateInterval)
    }

    private static checkAudio = 50
    private static checkAudioTime() {
        this.checkAudio++
        if (this.checkAudio < 10) return
        this.checkAudio = 0

        AudioPlaylist.checkCrossfade()

        const playing = AudioPlayer.getAllPlaying()
        playing.forEach((id) => {
            AudioPlayer.checkIfEnding(id)
        })
    }

    private static mergeAnalysers() {
        const merged: number[][] = []

        const allChannels = this.channels
        allChannels.main = AudioAnalyser.getChannelsVolume()

        Object.values(allChannels).forEach((channels) => {
            channels.forEach((channel, channelIndex) => {
                if (!merged[channelIndex]) merged[channelIndex] = []

                merged[channelIndex].push(channel.dB.value)

                // min = Math.min(min, channel.dB.min || this.dBmin)
                // max = Math.max(max, channel.dB.max || this.dBmax)
            })
        })

        const mergedChannels = merged.map((a, i) => ({ dB: { value: this.mergeDB(a, i) } }))
        audioChannels.set(mergedChannels)

        if (get(currentWindow) === "output") {
            send(OUTPUT, ["AUDIO_MAIN"], { id: Object.keys(get(outputs))[0], channels: mergedChannels })
        }
    }

    private static mergeDB(array: number[], channelIndex: number) {
        if (!array.length) return this.dBmin

        // https://stackoverflow.com/a/22613964
        const avgLinear = array.reduce((sum, dB) => (sum += Math.pow(10, dB / 20)), 0) / array.length

        // convert back to dB
        let newDB = Math.log10(avgLinear) * 20

        // ensure we don't get an artificial boost for very low values
        newDB = Math.max(newDB, Math.min(...array))

        // if (!get(special).preFaderVolumeMeter) {
        // add gain & volume
        // newDB *= AudioPlayer.getVolume() * AudioPlayer.getGain()
        // }

        // add any gain value
        // newDB *= AudioPlayer.getGain()

        // return (Math.log(newDB) / Math.LN10) * 20
        // return newDB > 0 ? this.getExponentiallySmoothedVolume(channelIndex, Math.log10(newDB) * 20) : this.dBmin
        return this.getExponentiallySmoothedVolume(channelIndex, newDB)
    }

    private static smoothingFactor = 0.5 // 0 < factor <= 1, lower values smooth more
    private static smoothedVolumes: { [key: number]: number } = {}

    private static getExponentiallySmoothedVolume(channelIndex: number, value: number) {
        if (this.smoothedVolumes[channelIndex] === undefined) this.smoothedVolumes[channelIndex] = value

        // Exponential smoothing formula
        this.smoothedVolumes[channelIndex] = this.smoothingFactor * value + (1 - this.smoothingFactor) * this.smoothedVolumes[channelIndex]

        return this.smoothedVolumes[channelIndex]
    }
}
