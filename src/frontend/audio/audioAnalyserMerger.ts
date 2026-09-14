import type { AudioChannel } from "../../types/Audio"
import { clone } from "../components/helpers/array"
import { AudioPlayer } from "./audioPlayer"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioInputCapture } from "./routing/audioInputCapture"

export class AudioAnalyserMerger {
    static dBmin = -60
    static dBmax = 0

    private static channels: { [key: string]: AudioChannel[] } = {}
    private static interval: NodeJS.Timeout | null = null

    static init() {
        if (this.interval) return

        this.checkAudioTime()
        this.interval = setInterval(() => {
            this.checkAudioTime()
        }, 1000)
    }

    static addChannels(id: string, channels: AudioChannel[]) {
        this.channels[id] = channels
        AudioAnalyserMerger.init()
    }

    static getChannels() {
        return clone(this.channels)
    }

    static stop() {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }
        this.channels = {}

        AudioInputCapture.getInstance().clearMergedDbs()
    }

    private static checkAudioTime() {
        AudioPlaylist.checkCrossfade()

        const playing = AudioPlayer.getAllPlaying()
        playing.forEach((id) => {
            AudioPlayer.checkIfEnding(id)
        })
    }
}
