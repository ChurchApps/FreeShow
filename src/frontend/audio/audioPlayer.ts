// const captureFrameRate = 24

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { analyseAudio, clearAudio } from "../components/helpers/audio"
import { encodeFilePath, removeExtension } from "../components/helpers/media"
import { gain, media, volume } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { fadeInAudio, fadeOutAudio } from "./audioFading"

type AudioMetadata = {
    name: string
    isMic?: boolean
}
type AudioOptions = {
    pauseIfPlaying?: boolean
    playMultiple?: boolean
    startAt?: number
    crossfade?: number
    playlistCrossfade?: boolean
}
type AudioData = {
    name: string
    paused: boolean
    audio: HTMLAudioElement
    isMic: boolean
}

export class AudioPlayer {
    static channelCount = 2
    static sampleRate = 48000 // Hz

    static playing: { [key: string]: AudioData } = {}

    // INIT

    // static playMicrophone(id: string, streamOrAudio: Buffer | HTMLAudioElement, metadata: AudioMetadata) {

    // }

    static async start(path: string, metadata: AudioMetadata, options: AudioOptions) {
        if (this.audioExists(path)) {
            if (options.pauseIfPlaying === false) {
                this.playing[path].audio.currentTime = 0
                return
            }

            this.togglePausedState(path)
            return
        }

        let audioPlaying = Object.keys(this.playing).length
        if (options.crossfade) fadeOutAudio(options.crossfade)
        else if (!options.playMultiple) clearAudio("", false, options.playlistCrossfade)

        const audio = await this.createAudio(path)
        if (!audio) return

        AudioAnalyser.append(path, audio)

        // // another audio might have been started while awaiting (if played rapidly)
        // if (this.audioExists(path)) return

        if ((options.startAt || 0) > 0) audio.currentTime = options.startAt || 0

        this.playing[path] = {
            name: removeExtension(metadata.name),
            paused: false,
            isMic: !!metadata.isMic,
            audio,
        }

        // if (analyser?.gainNode) {
        //     analyser.gainNode.gain.value = this.getVolume(path) * this.getGain()
        //     if (get(special).preFaderVolumeMeter) audio.volume = 1
        //     else audio.volume = this.getVolume(path)
        // } else audio.volume = this.getVolume(path)

        let waitToPlay = 0
        if (audioPlaying && options.crossfade) {
            audio.volume = 0
            waitToPlay = options.crossfade * 0.6
            fadeInAudio(path, options.crossfade, !!waitToPlay)
            return // WIP
        }

        this.initAudio(path, waitToPlay)
    }

    private static async createAudio(path: string): Promise<HTMLAudioElement | null> {
        let encodedPath = encodeFilePath(path)
        const audio = new Audio(encodedPath)

        return new Promise((resolve) => {
            audio.addEventListener("canplay", () => resolve(audio))
            audio.addEventListener("error", (err) => {
                console.error("Could not get audio:", err)
                this.stop(path)
                resolve(null)
            })
        })
    }

    // private static init(id: string, audio: HTMLAudioElement, metadata: AudioMetadata) {
    // }

    private static initAudio(id: string, waitToPlay: number = 0) {
        setTimeout(() => {
            // audio might have been cleared
            if (!this.audioExists(id)) return

            this.play(id)
            customActionActivation("audio_start")
            analyseAudio()
        }, waitToPlay * 1000)
    }

    //

    static play(id: string) {
        if (!this.audioExists(id)) return

        this.playing[id].paused = false
        this.playing[id].audio.play()
        // WIP analyseAudio()
    }

    static pause(id: string) {
        if (!this.audioExists(id)) return

        this.playing[id].paused = true
        this.playing[id].audio.pause()
    }

    static stop(id: string) {
        if (!this.audioExists(id)) return

        this.pause(id)
        // WIP stop analyser!!
        delete this.playing[id]
    }

    private static togglePausedState(id: string) {
        let isPaused: boolean = this.isPaused(id)
        if (isPaused) this.play(id)
        else this.pause(id)
    }

    static updateVolume(id: string | null = null) {
        const ids = id ? [id] : Object.keys(this.playing)
        ids.forEach((id) => {
            this.playing[id].audio.volume = this.getVolume(id)
        })
    }

    static setGain(value: number) {
        AudioAnalyser.setGain(value)
    }

    // GET

    static getPlaying(id: string): AudioData | null {
        return this.playing[id] || null
    }

    static getVolume(id: string | null = null) {
        if (!id) return get(volume)
        return get(volume) * (get(media)[id]?.volume || 1)
    }

    static getGain() {
        return get(gain) || 1
    }

    // STATE

    static audioExists(id: string) {
        return !!this.getPlaying(id)
    }

    static isPaused(id: string) {
        return !!this.getPlaying(id)?.paused
    }
}
