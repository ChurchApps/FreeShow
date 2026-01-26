// const captureFrameRate = 24

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { customActionActivation } from "../components/actions/actions"
import { encodeFilePath, getFileName, removeExtension } from "../components/helpers/media"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { sendMain } from "../IPC/main"
import { audioChannelsData, dictionary, media, outLocked, playingAudio, playingAudioPaths, special, volume } from "../stores"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { clearAudio, clearing, fadeInAudio, fadeOutAudio } from "./audioFading"
import { AudioMultichannel } from "./audioMultichannel"
import { AudioPlaylist } from "./audioPlaylist"

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
    static channelCount = AudioMultichannel.DEFAULT_CHANNELS // default, will be updated dynamically
    static maxChannels = AudioMultichannel.MAX_CHANNELS // support up to 8 channels (7.1 surround)
    static sampleRate = 48000 // Hz

    // static playing: { [key: string]: AudioData } = {}

    // LOADING

    private static currentlyLoading: string[] = []
    private static isLoading(path: string) {
        return this.currentlyLoading.includes(path)
    }
    private static setLoading(path: string) {
        if (!this.isLoading(path)) this.currentlyLoading.push(path)
    }
    private static clearLoading(path: string) {
        const index = AudioPlayer.currentlyLoading.indexOf(path)
        if (index !== -1) AudioPlayer.currentlyLoading.splice(index, 1)
    }

    // INIT

    static async start(path: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked) || clearing.includes(path) || this.isLoading(path)) return
        this.setLoading(path)

        // get type
        const duration = await this.getDuration(path)
        const type = this.getAudioType(path, duration)
        if (type === "effect") options = { ...options, playMultiple: true }

        if (this.audioExists(path)) {
            if (options.pauseIfPlaying === false) {
                updateAudioStore(path, "currentTime", 0)
                this.clearLoading(path)
                return
            }
            if (options.stopIfPlaying) {
                if (options.clearTime) clearAudio(path, { clearTime: options.clearTime })
                else AudioPlayer.stop(path)
                this.clearLoading(path)
                return
            }

            this.togglePausedState(path)
            this.clearLoading(path)
            return
        }

        const audioPlaying = Object.keys(get(playingAudio)).length
        if (options.crossfade) fadeOutAudio(options.crossfade)
        else if (!options.playMultiple) clearAudio("", { playlistCrossfade: options.playlistCrossfade, isPlayingNew: true })

        const audio = await this.createAudio(path)
        // another audio might have been started while awaiting (if played rapidly)
        if (!audio || this.audioExists(path)) {
            this.clearLoading(path)
            return
        }

        const newVolume = AudioPlayer.getVolume() * (options.volume || 1)
        audio.volume = newVolume

        options.startAt = AudioPlayer.getStartTime(path, options.startAt)
        if (options.startAt > 0) audio.currentTime = options.startAt

        playingAudio.update((a) => {
            a[path] = {
                name: removeExtension(metadata.name || getFileName(path)),
                paused: false,
                isMic: false,
                audio
            }
            return a
        })

        let waitToPlay = 0
        if (audioPlaying && options.crossfade) {
            audio.volume = 0
            waitToPlay = options.crossfade * 0.6
            fadeInAudio(path, options.crossfade, !!waitToPlay, newVolume)
        }

        this.initAudio(path, waitToPlay)

        const name = removeExtension(metadata.name || getFileName(path))
        this.nowPlaying(path, name)
        this.clearLoading(path)
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
                stream
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
        if (!AudioPlayer.getAllPlaying().length) sendMain(Main.NOW_PLAYING_UNSET)
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

    static updateVolume(specificAudioPath: string | null = null) {
        const ids = specificAudioPath ? [specificAudioPath] : Object.keys(get(playingAudio))
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

        const endingTime = AudioPlayer.getEndTime(id, audio.duration)
        if (audio.currentTime < endingTime) return

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

        // if (get(special).clearAudioOnFinish === false && AudioPlayer.getAudioType(id, audio.duration) === "music") this.pause(id) else
        this.stop(id)

        const stillPlaying = this.getAllPlaying()
        if (!stillPlaying.length) checkNextAfterMedia(id, "audio")
    }

    // NowPlaying.txt
    static nowPlaying(filePath: string, name: string) {
        const audioLang = get(dictionary).audio || {}
        const unknownLang = [audioLang.unknown_artist || "", audioLang.unknown_title || "", audioLang.unknown_album || ""]
        const format: string = get(special).nowPlayingFormat || ""
        const duration = this.getDurationSync(filePath)
        sendMain(Main.NOW_PLAYING, { filePath, name, unknownLang, format, duration })
    }

    // GET

    static getPlaying(id: string): AudioData | null {
        return get(playingAudio)[id] || null
    }

    static getAllPlaying(removePaused = true) {
        return get(playingAudioPaths).length
            ? get(playingAudioPaths)
            : Object.keys(get(playingAudio)).filter((id) => {
                  const audioData = get(playingAudio)[id]
                  return audioData.audio && (!removePaused || !audioData.paused)
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
    static getDurationSync(id: string) {
        return this.storedDurations.get(id) || 0
    }

    static getVolume(id: string | null = null, _updater = get(volume)) {
        const mainVolume = get(audioChannelsData).main?.isMuted ? 0 : _updater
        if (!id) return mainVolume
        return mainVolume * (get(media)[id]?.volume || 1)
    }

    static getGain() {
        return 1
        // return get(special).allowGaining ? get(gain) || 1 : 1
    }

    static getGlobalOptions(path: string) {
        return get(media)[path] || {}
    }

    static getAudioType(path: string, duration: number) {
        return AudioPlayer.getGlobalOptions(path).audioType || (duration < 30 ? "effect" : "music")
    }

    static getStartTime(path: string, startAt?: number | undefined) {
        const globalStart = AudioPlayer.getGlobalOptions(path).fromTime || 0
        return Math.max(startAt || 0, globalStart)
    }
    static getEndTime(path: string, duration: number) {
        const globalEnd = AudioPlayer.getGlobalOptions(path).toTime || 0
        // if (!duration) duration = this.storedDurations.get(path) || 0
        // if (!duration && globalEnd) return globalEnd
        return globalEnd > 0 ? Math.min(duration, globalEnd) : duration
    }

    static getOutputs(): Promise<{ value: string; label: string }[]> {
        return new Promise((resolve) => {
            navigator.mediaDevices
                .enumerateDevices()
                .then((devices) => {
                    // only get audio outputs & not "default" becuase that does not work
                    const outputDevices = devices.filter((device) => device.kind === "audiooutput" && device.deviceId !== "default")
                    const audioOutputs = outputDevices.map((a) => ({ value: a.deviceId, label: a.label }))
                    resolve(audioOutputs)
                })
                .catch((err) => {
                    console.log(`${err.name}: ${err.message}`)
                    resolve([])
                })
        })
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
