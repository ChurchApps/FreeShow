// const captureFrameRate = 24

import { get } from "svelte/store"
import { customActionActivation } from "../components/actions/actions"
import { encodeFilePath, getFileName, removeExtension } from "../components/helpers/media"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { gain, media, outLocked, playingAudio, special, volume } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { clearAudio, clearing, fadeInAudio, fadeOutAudio } from "./audioFading"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"

type AudioMetadata = {
    name: string
}
type AudioOptions = {
    pauseIfPlaying?: boolean
    stopIfPlaying?: boolean // effects
    clearTime?: number // effects
    playMultiple?: boolean
    startAt?: number
    crossfade?: number // playlist
    playlistCrossfade?: boolean // playlist
    volume?: number // playlist
}
export type AudioData = {
    name: string
    paused: boolean
    isMic: boolean
    audio: HTMLAudioElement
    stream?: MediaStream
}

export class AudioPlayer {
    static channelCount = 2
    static sampleRate = 48000 // Hz

    // static playing: { [key: string]: AudioData } = {}

    // INIT

    static async start(path: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked) || clearing.includes(path)) return

        // get type
        const duration = await this.getDuration(path)
        const type = this.getAudioType(path, duration)
        if (type === "effect") options = { ...options, playMultiple: true }

        if (this.audioExists(path)) {
            if (options.pauseIfPlaying === false) {
                updateAudioStore(path, "currentTime", 0)
                return
            }
            if (options.stopIfPlaying) {
                if (options.clearTime) clearAudio(path, { clearTime: options.clearTime })
                else AudioPlayer.stop(path)
                return
            }

            this.togglePausedState(path)
            return
        }

        const audioPlaying = Object.keys(get(playingAudio)).length
        if (options.crossfade) fadeOutAudio(options.crossfade)
        else if (!options.playMultiple) clearAudio("", { playlistCrossfade: options.playlistCrossfade })

        const audio = await this.createAudio(path)
        // another audio might have been started while awaiting (if played rapidly)
        if (!audio || this.audioExists(path)) return

        const volume = AudioPlayer.getVolume() * (options.volume || 1)
        audio.volume = volume
        if ((options.startAt || 0) > 0) audio.currentTime = options.startAt || 0

        playingAudio.update((a) => {
            a[path] = {
                name: removeExtension(metadata.name || getFileName(path)),
                paused: false,
                isMic: false,
                audio,
            }
            return a
        })

        let waitToPlay = 0
        if (audioPlaying && options.crossfade) {
            audio.volume = 0
            waitToPlay = options.crossfade * 0.6
            fadeInAudio(path, options.crossfade, !!waitToPlay, volume)
        }

        this.initAudio(path, waitToPlay)
    }

    static async playStream(id: string, stream: MediaStream, metadata: AudioMetadata) {
        if (this.audioExists(id)) {
            this.togglePausedState(id)
            return
        }

        const audio = await this.createAudioFromStream(id, stream)
        if (!audio) return

        playingAudio.update((a) => {
            a[id] = {
                name: metadata.name,
                paused: false,
                isMic: true,
                audio,
                stream,
            }
            return a
        })

        this.initAudio(id)
    }

    private static async createAudio(path: string): Promise<HTMLAudioElement | null> {
        const audio = new Audio(encodeFilePath(path))
        return await this.waitForAudio(path, audio)
    }

    private static async createAudioFromStream(id: string, stream: MediaStream): Promise<HTMLAudioElement | null> {
        const audio = new Audio()
        audio.srcObject = stream
        return await this.waitForAudio(id, audio)
    }

    private static waitForAudio(pathOrId: string, audio: HTMLAudioElement): Promise<HTMLAudioElement | null> {
        return new Promise((resolve) => {
            audio.addEventListener("canplay", loaded, { once: true })
            audio.addEventListener("error", error, { once: true })

            let resolved = false
            function loaded() {
                resolved = true
                resolve(audio)
            }
            function error(err: ErrorEvent) {
                if (resolved) return
                console.error("Could not get audio:", err)
                AudioPlayer.stop(pathOrId)
                resolve(null)
            }
        })
    }

    // private static init(id: string, audio: HTMLAudioElement, metadata: AudioMetadata) {
    // }

    private static initAudio(id: string, waitToPlay = 0) {
        setTimeout(() => {
            // audio might have been cleared
            const audio = this.getAudio(id)
            if (!audio) return

            this.play(id)
            customActionActivation("audio_start")

            // WIP get microphone input stream (audio will have to be muted in that case)
            // let stream = this.getPlaying(id)?.stream || audio
            AudioAnalyser.attach(id, audio)
        }, waitToPlay * 1000)
    }

    //

    static play(id: string) {
        if (!this.audioExists(id)) return

        updatePlayingStore(id, "paused", false)
        this.getAudio(id)?.play()

        AudioAnalyserMerger.init()
    }

    static pause(id: string) {
        if (!this.audioExists(id)) return

        updatePlayingStore(id, "paused", true)
        this.getAudio(id)?.pause()

        if (!AudioAnalyser.shouldAnalyse()) {
            AudioAnalyserMerger.stop()
        }
    }

    static stop(id: string) {
        if (!this.audioExists(id)) return

        this.pause(id)
        playingAudio.update((a) => {
            // reset
            a[id].audio.src = ""
            this.stopStream(a[id].stream)

            delete a[id]
            return a
        })

        AudioAnalyser.detach(id)
    }

    private static stopStream(stream: MediaStream | undefined) {
        if (!stream) return
        stream.getAudioTracks().forEach((track) => track.stop())
    }

    private static togglePausedState(id: string) {
        const isPaused: boolean = this.isPaused(id)
        if (isPaused) this.play(id)
        else this.pause(id)
    }

    static updateVolume(id: string | null = null) {
        const ids = id ? [id] : Object.keys(get(playingAudio))
        ids.forEach((id) => {
            let newVolume = this.getVolume(id)

            // check playlist volume
            if (AudioPlaylist.getPlayingPath() === id) {
                newVolume *= AudioPlaylist.getActivePlaylist()?.volume || 1
            }

            updateAudioStore(id, "volume", newVolume)
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

    static checkIfEnding(id: string) {
        const playing = this.getPlaying(id)
        if (!playing || playing.paused) return

        const audio = this.getAudio(id)
        if (!audio) return

        if (audio.currentTime < audio.duration) return

        // loop single audio
        if (get(media)[id]?.loop) {
            get(playingAudio)[id].audio.currentTime = 0
            get(playingAudio)[id].audio.play()
            return
        }

        if (AudioPlaylist.getPlayingPath() === id) {
            this.stop(id) // stop existing
            AudioPlaylist.next()
            return
        }

        if (get(special).clearMediaOnFinish === false) this.pause(id)
        else this.stop(id)

        const stillPlaying = this.getAllPlaying()
        if (!stillPlaying.length) checkNextAfterMedia(id, "audio")
    }

    // GET

    static getPlaying(id: string): AudioData | null {
        return get(playingAudio)[id] || null
    }

    static getAllPlaying() {
        return Object.keys(get(playingAudio)).filter((id) => {
            const audioData = get(playingAudio)[id]
            return audioData.audio && !audioData.paused
        })
    }

    static getAudio(id: string): HTMLAudioElement | null {
        return get(playingAudio)[id]?.audio || null
    }

    static getTime(id: string) {
        return this.getAudio(id)?.currentTime || 0
    }

    private static storedDurations: Map<string, number> = new Map()
    static async getDuration(id: string) {
        if (this.storedDurations.has(id)) return this.storedDurations.get(id)!

        const audio = this.getAudio(id) || (await loadAudioFile(id))
        let duration = audio?.duration || 0
        // audio streams does not end and have Infinite duration
        if (duration === Infinity) duration = 0

        this.storedDurations.set(id, duration)
        return duration
    }

    static getVolume(id: string | null = null, _updater = get(volume)) {
        if (!id) return _updater
        return _updater * (get(media)[id]?.volume || 1)
    }

    static getGain() {
        return get(special).allowGaining ? get(gain) || 1 : 1
    }

    static getAudioType(path: string, duration: number) {
        return get(media)[path]?.audioType || (duration < 30 ? "effect" : "music")
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

        audio.addEventListener("canplaythrough", loaded, { once: true })
        audio.addEventListener("error", error, { once: true })

        let resolved = false
        function loaded() {
            resolved = true
            resolve(audio)
        }
        function error(err: ErrorEvent) {
            if (resolved) return
            console.error("Could not get audio:", err)
            resolve(null)
        }
    })
}
