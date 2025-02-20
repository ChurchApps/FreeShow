// const captureFrameRate = 24

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { encodeFilePath, getFileName, removeExtension } from "../components/helpers/media"
import { gain, media, playingAudio, special, volume } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { clearAudio, fadeInAudio, fadeOutAudio } from "./audioFading"

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
export type AudioData = {
    name: string
    paused: boolean
    audio: HTMLAudioElement
    isMic: boolean
}

export class AudioPlayer {
    static channelCount = 2
    static sampleRate = 48000 // Hz

    // static playing: { [key: string]: AudioData } = {}

    // INIT

    static async start(path: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (this.audioExists(path)) {
            if (options.pauseIfPlaying === false) {
                updateAudioStore(path, "currentTime", 0)
                return
            }

            this.togglePausedState(path)
            return
        }

        let audioPlaying = Object.keys(get(playingAudio)).length
        if (options.crossfade) fadeOutAudio(options.crossfade)
        else if (!options.playMultiple) clearAudio("", false, options.playlistCrossfade)

        const audio = await this.createAudio(path)
        if (!audio) return

        // AudioAnalyser.attach(path, audio)

        // // another audio might have been started while awaiting (if played rapidly)
        // if (this.audioExists(path)) return

        if ((options.startAt || 0) > 0) audio.currentTime = options.startAt || 0

        playingAudio.update((a) => {
            a[path] = {
                name: removeExtension(metadata.name || getFileName(path)),
                paused: false,
                isMic: !!metadata.isMic,
                audio,
            }
            return a
        })

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
            // return // WIP
        }

        this.initAudio(path, waitToPlay)
    }

    static playMicrophone(id: string, streamOrAudio: Buffer | HTMLAudioElement, metadata: AudioMetadata) {
        // playAudio({ path: id, name: metadata.name, stream: streamOrAudio }, false)
        if (this.audioExists(id)) {
            this.togglePausedState(id)
            return
        }

        // WIP analyze

        metadata.isMic = true
        console.log(streamOrAudio)
    }

    private static async createAudio(path: string): Promise<HTMLAudioElement | null> {
        const audio = new Audio(encodeFilePath(path))
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
            const audio = this.getAudio(id)
            if (!audio) return

            this.play(id)
            customActionActivation("audio_start")
            AudioAnalyser.attach(id, audio)
        }, waitToPlay * 1000)
    }

    //

    static play(id: string) {
        if (!this.audioExists(id)) return

        updatePlayingStore(id, "paused", false)
        this.getAudio(id)?.play()
    }

    static pause(id: string) {
        if (!this.audioExists(id)) return

        updatePlayingStore(id, "paused", true)
        this.getAudio(id)?.pause()
    }

    static stop(id: string) {
        if (!this.audioExists(id)) return

        this.pause(id)
        playingAudio.update((a) => {
            delete a[id]
            return a
        })
        // WIP stop analyser!!??
        // if (!get(playingAudio).length)
    }

    private static togglePausedState(id: string) {
        let isPaused: boolean = this.isPaused(id)
        if (isPaused) this.play(id)
        else this.pause(id)
    }

    static updateVolume(id: string | null = null) {
        const ids = id ? [id] : Object.keys(get(playingAudio))
        ids.forEach((id) => {
            updateAudioStore(id, "volume", this.getVolume(id))
        })

        AudioAnalyser.setGain(this.getGain())
    }

    static setGain(value: number) {
        AudioAnalyser.setGain(value)
    }

    static setTime(id: string, time: number) {
        if (!this.getAudio(id)) return false
        updateAudioStore(id, "currentTime", time)
        return true
    }

    // GET

    static getPlaying(id: string): AudioData | null {
        return get(playingAudio)[id] || null
    }

    static getAudio(id: string): HTMLAudioElement | null {
        return get(playingAudio)[id]?.audio || null
    }

    static getTime(id: string) {
        return this.getAudio(id)?.currentTime || 0
    }

    static async getDuration(id: string) {
        const audio = this.getAudio(id) || (await loadAudioFile(id))
        const duration = audio?.duration || 0
        // audio streams does not end and have Infinite duration
        return duration === Infinity ? 0 : duration
    }

    static getVolume(id: string | null = null) {
        if (!id) return get(volume)
        return get(volume) * (get(media)[id]?.volume || 1)
    }

    static getGain() {
        return get(special).allowGaining ? get(gain) || 1 : 1
    }

    // STATE

    static audioExists(id: string) {
        return !!this.getPlaying(id)
    }

    static isPaused(id: string) {
        return !!this.getPlaying(id)?.paused
    }
}

function updatePlayingStore(id: string, key: string, value: any) {
    playingAudio.update((a) => {
        if (!a[id]) return a
        a[id][key] = value
        return a
    })
}

function updateAudioStore(id: string, key: string, value: any) {
    playingAudio.update((a) => {
        if (!a[id]?.audio) return a
        a[id].audio[key] = value
        return a
    })
}

export async function loadAudioFile(path: string): Promise<HTMLAudioElement | null> {
    return new Promise((resolve) => {
        const audio = new Audio(encodeFilePath(path))
        audio.addEventListener("canplaythrough", () => resolve(audio))
        audio.addEventListener("error", (err) => {
            console.error("Could not get audio:", err)
            resolve(null)
        })
    })
}
