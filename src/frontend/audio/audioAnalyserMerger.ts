import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { OUTPUT } from "../../types/Channels"
import { clone } from "../components/helpers/array"
import { audioChannels, audioChannelsData, audioRouting, outputs, playingAudio } from "../stores"
import { isOutputWindow } from "../utils/common"
import { send } from "../utils/request"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioInputCapture } from "./routing/audioInputCapture"

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

    static getChannels() {
        return clone(this.channels)
    }

    static stop() {
        if (!this.timeout) return
        clearTimeout(this.timeout)
        this.timeout = null
        this.channels = {}
        audioChannels.set([])
        audioChannelsData.set({})
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

        // Store per-node volume data for visualizers & Audio drawer mixers
        const nodeVolumes: { [key: string]: { dB: number } } = {}
        const capture = AudioInputCapture.getInstance()

        // 1. Process standard analyzer channels (Main/Drawer)
        Object.entries(allChannels).forEach(([id, chs]) => {
            if (chs?.length) {
                const avg = chs.reduce((sum, c) => sum + (c.dB?.value ?? -80), 0) / chs.length
                if (avg > -80) nodeVolumes[id] = { dB: avg }
            }
        })
        if (allChannels.main?.length) {
            const avgDrawer = allChannels.main.reduce((sum, c) => sum + (c.dB?.value ?? -80), 0) / allChannels.main.length
            if (avgDrawer > -80) {
                nodeVolumes["drawer_audio"] = { dB: avgDrawer }
            }
        }

        // 2. Add real-time levels from AudioInputCapture for all nodes
        const config = get(audioRouting)
        const playing = AudioPlayer.getAllPlaying()
        const inputLevels: { [key: string]: number[] } = {}

        // Capture data for active playing sources
        playing.forEach((id) => {
            const audioPlaying = get(playingAudio)[id]
            if (!audioPlaying || audioPlaying.paused) return

            const isMic = audioPlaying.isMic === true || id.startsWith("mic_sub_")
            const nodeKey = isMic ? id : id === "metronome" ? "metronome" : "drawer_audio"

            // Prefer allChannels.main for drawer
            if (nodeKey === "drawer_audio" && nodeVolumes["drawer_audio"] !== undefined) return

            const data = capture.getVisualizerData(nodeKey)
            if (data && (data.db > -80 || isMic)) {
                ;(inputLevels[nodeKey] ??= []).push(data.db)
                if (isMic) (inputLevels["mic_default"] ??= []).push(data.db)
            }
        })

        // Combine captured input levels
        Object.entries(inputLevels).forEach(([key, dbs]) => {
            const linearSum = dbs.reduce((sum, db) => sum + Math.pow(10, db / 20), 0)
            nodeVolumes[key] = { dB: Math.round(20 * Math.log10(linearSum / dbs.length)) }
        })

        // Capture data for mergers and outputs directly
        if (config) {
            ;[...config.mergers.map((m) => m.id), "speaker_default", "network_default", "icecast"].forEach((id) => {
                const data = capture.getVisualizerData(id)
                if (data && data.db > -80) nodeVolumes[id] = { dB: Math.round(data.db) }
            })

            // Fallback: Calculate merger/output levels mapping based on graph if capture isn't available
            config.mergers.forEach((m) => {
                if (nodeVolumes[m.id] !== undefined) return
                const activeDbs = config.connections
                    .filter((c) => c.to === m.id && nodeVolumes[c.from] !== undefined)
                    .map((c) => nodeVolumes[c.from].dB)
                    .filter((db) => db > -80)

                if (activeDbs.length) {
                    const linear = activeDbs.reduce((s, db) => s + Math.pow(10, db / 20), 0) / activeDbs.length
                    nodeVolumes[m.id] = { dB: Math.round(20 * Math.log10(linear)) }
                }
            })
        }

        audioChannelsData.set(nodeVolumes as any)

        if (isOutputWindow()) {
            send(OUTPUT, ["AUDIO_MAIN"], { id: Object.keys(get(outputs))[0], channels: mergedChannels })
        }
    }

    private static mergeDB(array: number[], channelIndex: number) {
        if (!array.length) return this.dBmin

        // array = array.filter(Boolean)

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
        return this.getExponentiallySmoothedVolume(`main:${channelIndex}`, newDB)
    }

    private static smoothingFactor = 0.5 // 0 < factor <= 1, lower values smooth more
    private static smoothedVolumes: { [key: string]: number } = {}

    private static getExponentiallySmoothedVolume(channelId: string, value: number) {
        if (this.smoothedVolumes[channelId] === undefined) this.smoothedVolumes[channelId] = value

        // Exponential smoothing formula
        this.smoothedVolumes[channelId] = this.smoothingFactor * value + (1 - this.smoothingFactor) * this.smoothedVolumes[channelId]

        return this.smoothedVolumes[channelId]
    }
}
