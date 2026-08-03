import { get } from "svelte/store"
import type { AudioChannel } from "../../types/Audio"
import { clone } from "../components/helpers/array"
import { audioChannels, audioChannelsData, audioRouting, outputs, playingAudio } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioInputCapture } from "./routing/audioInputCapture"

export class AudioAnalyserMerger {
    static dBmin = -60
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
        const nodeVolumes: { [key: string]: { dB: number } } = {}
        const capture = AudioInputCapture.getInstance()

        // 1. Process standard analyzer channels
        Object.entries(this.channels).forEach(([id, chs]) => {
            if (chs?.length) {
                const avg = chs.reduce((sum, c) => sum + (c.dB?.value ?? -60), 0) / chs.length
                if (avg > -60) nodeVolumes[id] = { dB: avg }
            }
        })

        // 2. Add real-time levels from AudioInputCapture for all nodes
        const config = get(audioRouting)
        const playing = AudioPlayer.getAllPlaying()
        // const playingVids = get(playingVideos)
        const inputLevels: { [key: string]: number[] } = {}

        // Capture data for active playing sources (audio player)
        playing.forEach((id) => {
            const audioPlaying = get(playingAudio)[id]
            if (!audioPlaying || audioPlaying.paused) return

            const isMic = audioPlaying.isMic === true || id.startsWith("mic_sub_")
            const nodeKey = isMic ? id : id === "metronome" ? "metronome" : "drawer_audio"

            // Prefer allChannels.main for drawer
            if (nodeKey === "drawer_audio" && nodeVolumes["drawer_audio"] !== undefined) return

            const data = capture.getVisualizerData(nodeKey)
            if (data && (data.db > -60 || isMic)) {
                ;(inputLevels[nodeKey] ??= []).push(data.db)
                if (isMic) (inputLevels["mic_default"] ??= []).push(data.db)
            }
        })

        // Capture data for active playing videos
        // playingVids.forEach((v) => {
        //     if (!v.video || v.video.paused) return

        //     const data = capture.getVisualizerData("output_window")
        //     if (data && data.db > -60) {
        //         ;(inputLevels["output_window"] ??= []).push(data.db)
        //     }
        // })

        // Capture output_window level if active
        const outData = capture.getVisualizerData("output_window")
        if (outData && outData.db > -60) {
            nodeVolumes["output_window"] = { dB: Math.round(outData.db) }
        }

        // Combine captured input levels
        Object.entries(inputLevels).forEach(([key, dbs]) => {
            const linearSum = dbs.reduce((sum, db) => sum + Math.pow(10, db / 20), 0)
            nodeVolumes[key] = { dB: Math.round(20 * Math.log10(linearSum / dbs.length)) }
        })

        // Capture data for mergers, outputs, and sub output windows directly
        const allOutputWinIds = Object.keys(get(outputs)).map((id) => "output_win_sub_" + id)
        allOutputWinIds.forEach((subId) => {
            const subData = capture.getVisualizerData(subId)
            if (subData && subData.db > -60) nodeVolumes[subId] = { dB: Math.round(subData.db) }
        })

        if (config) {
            const subOutputIds = config.connections.map((c) => c.to).filter((to) => to.startsWith("speaker_sub_") || to.startsWith("network_sub_"))
            ;[...config.mergers.map((m) => m.id), "speaker_default", "network_default", "icecast", ...subOutputIds].forEach((id) => {
                const data = capture.getVisualizerData(id)
                if (data && data.db > -60) nodeVolumes[id] = { dB: Math.round(data.db) }
            })

            // Fallback: Calculate merger/output levels mapping based on graph if capture isn't available
            config.mergers.forEach((m) => {
                if (nodeVolumes[m.id] !== undefined) return
                const activeDbs = config.connections
                    .filter((c) => c.to === m.id && nodeVolumes[c.from] !== undefined)
                    .map((c) => nodeVolumes[c.from].dB)
                    .filter((db) => db > -60)

                if (activeDbs.length) {
                    const linear = activeDbs.reduce((s, db) => s + Math.pow(10, db / 20), 0) / activeDbs.length
                    nodeVolumes[m.id] = { dB: Math.round(20 * Math.log10(linear)) }
                }
            })
        }

        audioChannelsData.update((prev) => {
            const copy = { ...prev }
            Object.entries(nodeVolumes).forEach(([id, vol]) => {
                copy[id] = { ...copy[id], ...vol }
            })
            return copy
        })
    }
}
