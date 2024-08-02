import macadam, { PlaybackChannel } from "macadam"
import { BlackmagicManager } from "./BlackmagicManager"

// const FPS = 30
export class BlackmagicSender {
    static playbackData: { [key: string]: { playback: PlaybackChannel; scheduledFrames: number } } = {}

    // set audioChannels to 0 to disable audio
    static async initialize(outputId: string, deviceIndex: number, displayModeName: string, pixelFormats: string[], enableKeying: boolean, audioChannels: number = 2) {
        if (this.playbackData[outputId]) return

        let displayMode = BlackmagicManager.getDisplayMode(displayModeName)
        // WIP choose if multiple is available
        let pixelFormat = BlackmagicManager.getPixelFormat(pixelFormats[0])

        this.playbackData[outputId] = {
            playback: await macadam.playback({
                deviceIndex,
                displayMode,
                pixelFormat,
                enableKeying,
                channels: audioChannels ? 0 : 0, // WIP send audio!
                sampleRate: macadam.bmdAudioSampleRate48kHz,
                sampleType: macadam.bmdAudioSampleType16bitInteger,
                startTimecode: "01:00:00:00",
            }),
            scheduledFrames: 0,
        }
    }

    static scheduleFrame(outputId: string, videoFrame: Buffer, _audioFrame: Buffer | null, framerate: number = 1000) {
        if (!this.playbackData[outputId]) return

        this.playbackData[outputId].playback.schedule({
            video: videoFrame, // Video frame data. Decklink SDK docs have byte packing
            // audio: audioFrame, // Frames-worth of interleaved audio data
            sampleFrameCount: 1920, // Optional - otherwise based on buffer length
            time: this.playbackData[outputId].scheduledFrames * framerate, // Relative to timescale in playback object
            // Hint: Use 1001 for fractional framerates like 59.94
        })

        this.playbackData[outputId].scheduledFrames++
        this.sendFrame(outputId)
    }

    static async sendFrame(outputId: string) {
        if (!this.playbackData[outputId]) return

        if (this.playbackData[outputId].scheduledFrames === 3)
            // Need to queue up a few frames - number depends on hardware
            this.playbackData[outputId].playback.start({ startTime: 0 })
        if (this.playbackData[outputId].scheduledFrames > 2) {
            // Regulate playback based on played time - latency depends on hw.
            await this.playbackData[outputId].playback.played(this.playbackData[outputId].scheduledFrames * 1000 - 3000)
            // Don't allow the data be garbage collected until after playback
        }
    }

    static stop(outputId: string) {
        if (!this.playbackData[outputId]) return

        this.playbackData[outputId].playback.stop()
        delete this.playbackData[outputId]
    }

    static stopAll() {
        Object.keys(this.playbackData).forEach(stop)
    }
}
