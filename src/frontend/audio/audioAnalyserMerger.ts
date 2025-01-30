import { get } from "svelte/store"
import { audioChannels, currentWindow, special } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioPlayer } from "./audioPlayer"

type Channel = {
    volume: number // WIP
    dB: {
        value: number
        min: number
        max: number
    }
}

export class AudioAnalyserMerger {
    static dBmin: number = -80
    static dBmax: number = 0

    private static channels: { [key: string]: Channel[] } = {}

    static init() {
        this.timeoutNext()
    }

    static setChannels(id: string, channels: Channel[]) {
        channels[id] = channels
        this.timeoutNext()
    }

    private static timeout: any = null
    private static previousMerge = 0
    private static updateInterval = 50
    private static timeoutNext() {
        if (this.timeout) return
        let timeSinceLast = Date.now() - this.previousMerge
        if (timeSinceLast > this.updateInterval + 100 && timeSinceLast < this.updateInterval + 200) {
            // wait if lagging behind
            setTimeout(() => {
                this.timeout = null
                this.timeoutNext()
            }, 100)
            return
        }

        this.mergeAnalysers()
        this.previousMerge = Date.now()

        this.timeout = setTimeout(() => {
            this.timeout = null
            this.timeoutNext()
        }, this.updateInterval)
    }

    private static mergeAnalysers() {
        if (get(currentWindow) !== null) return

        let min: number = this.dBmin
        let max: number = this.dBmax

        // const volumes: { left: number, right: number } = { left: 0, right: 0 };
        let merged: any[] = []

        const channels = this.channels
        channels.main = AudioAnalyser.getChannelsVolume()

        Object.values(channels).forEach((channels) => {
            channels.forEach((channel, channelIndex) => {
                if (!merged[channelIndex]) merged[channelIndex] = []

                merged[channelIndex].push(channel.dB.value)

                min = Math.min(min, channel.dB.min)
                max = Math.max(max, channel.dB.max)

                // if (channelIndex === 0) volumes.left = Math.max(volumes.left, channel.volume);
                // if (channelIndex === 1) volumes.right = Math.max(volumes.right, channel.volume);
            })
        })

        let mergedDB = {
            left: this.mergeDB(merged[0] || [], 0),
            right: this.mergeDB(merged[1] || [], 1),
        }

        const volume = { left: 1, right: 1 } // WIP
        audioChannels.set({ volume, dB: { value: mergedDB, min: this.dBmin, max: this.dBmax } })
    }

    private static mergeDB(array: number[], channelIndex: number) {
        if (!array.length) return this.dBmin

        // https://stackoverflow.com/a/22613964
        let sum = array.reduce((value, number) => (value += Math.pow(10, number / 20)), 0)

        if (!get(special).preFaderVolumeMeter) {
            // add gain & volume
            sum *= AudioPlayer.getVolume() * AudioPlayer.getGain()
        }

        // return (Math.log(sum) / Math.LN10) * 20
        return sum > 0 ? this.getExponentiallySmoothedVolume(channelIndex, Math.log10(sum) * 20) : this.dBmin
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
