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
    static dBmin: number = -100
    static dBmax: number = -30 // -10

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
    private static updateInterval = 1000 // 50
    private static timeoutNext() {
        if (this.timeout) return
        let timeSinceLast = Date.now() - this.previousMerge
        if (timeSinceLast > this.updateInterval + 100 && timeSinceLast < this.updateInterval + 200) {
            // wait if lagging behind
            setTimeout(() => {
                this.timeout = null
                this.timeoutNext()
            }, 200)
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

        let merged: any[] = []

        const channels = this.channels
        channels.main = AudioAnalyser.getChannelsVolume()

        console.log(channels)

        Object.values(channels).forEach((channels) => {
            channels.forEach((channel, channelIndex) => {
                if (!merged[channelIndex]) merged[channelIndex] = []

                merged[channelIndex].push(channel.dB.value)

                if (channel.dB.min < min) min = channel.dB.min
                if (channel.dB.max > max) max = channel.dB.max
            })
        })

        console.log(merged)

        let mergedDB = { left: min, right: min }
        mergedDB = { left: this.mergeDB(merged[0]), right: this.mergeDB(merged[1]) }

        console.log(mergedDB)

        const volume = { left: 1, right: 1 } // WIP
        audioChannels.set({ volume, dB: { value: mergedDB, min: this.dBmin, max: this.dBmax } })
    }

    private static mergeDB(array: number[]) {
        // https://stackoverflow.com/a/22613964
        let sum = array.reduce((value, number) => (value += Math.pow(10, number / 20)), 0)

        if (!get(special).preFaderVolumeMeter) {
            // add gain & volume
            sum *= AudioPlayer.getVolume() * AudioPlayer.getGain()
        }

        return (Math.log(sum) / Math.LN10) * 20
    }
}
