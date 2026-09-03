// const captureFrameRate = 24

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { customActionActivation } from "../components/actions/actions"
import { encodeFilePath, getFileName, locateMediaFile, removeExtension } from "../components/helpers/media"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { requestMain, sendMain } from "../IPC/main"
import { activePlaylist, dictionary, media, outLocked, playingAudio, playingAudioPaths, special } from "../stores"
import { addToMediaFolder } from "../utils/cloudSync"
import { AudioAnalyser } from "./audioAnalyser"
import { AudioAnalyserMerger } from "./audioAnalyserMerger"
import { clearAudio, clearing, fadeInAudio, fadeOutAudio } from "./audioFading"
import { AudioMultichannel } from "./audioMultichannel"
import { AudioPlaylist } from "./audioPlaylist"
import { AudioRoutingManager } from "./routing/audioRoutingManager"

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
    startPaused?: boolean // playlist
    volume?: number // playlist
    playlistId?: string
}
export type AudioData = {
    name: string
    paused: boolean
    isMic: boolean
    audio: HTMLAudioElement
    stream?: MediaStream
    replayGainMultiplier?: number
    playlistId?: string
}

export class AudioPlayer {
    static channelCount = AudioMultichannel.DEFAULT_CHANNELS // default, will be updated dynamically
    static maxChannels = AudioMultichannel.MAX_CHANNELS // support up to 8 channels (7.1 surround)
    static sampleRate = 48000 // Hz
    static replayGainCache: Map<string, number> = new Map()

    // static playing: { [key: string]: AudioData } = {}

    // LOADING

    private static currentlyLoading = new Set<string>()
    private static isLoading(path: string) {
        return this.currentlyLoading.has(path)
    }
    private static setLoading(path: string) {
        this.currentlyLoading.add(path)
    }
    private static clearLoading(path: string) {
        this.currentlyLoading.delete(path)
    }

    // INIT

    // returns false when the audio file can't be found or loaded
    static async start(path: string, metadata: AudioMetadata, options: AudioOptions = {}): Promise<boolean> {
        if (get(outLocked) || clearing.includes(path) || this.isLoading(path)) return true
        const pathId = path
        this.setLoading(pathId)

        const isOnline = path.startsWith("http")

        const located = await locateMediaFile(path)
        if (!located) {
            this.clearLoading(pathId)
            return false
        }

        // update active playlist file if it's located to a new path
        if (located.path !== path && get(activePlaylist)?.active === path) {
            activePlaylist.update((a) => {
                if (a) a.activeKey = located.path
                return a
            })
        }

        path = located.path
        if (!located.hasChanged && !isOnline) addToMediaFolder(path)

        // get type
        const duration = await this.getDuration(path)
        const type = this.getAudioType(path, duration)
        if (type === "effect") options = { ...options, playMultiple: true }

        if (this.audioExists(path)) {
            if (options.pauseIfPlaying === false) {
                updateAudioStore(path, "currentTime", 0)
                this.clearLoading(pathId)
                return true
            }
            if (options.stopIfPlaying) {
                if (options.clearTime) clearAudio(path, { clearTime: options.clearTime })
                else AudioPlayer.stop(path)
                this.clearLoading(pathId)
                return true
            }

            this.togglePausedState(path)
            this.clearLoading(pathId)
            return true
        }

        const audioPlaying = Object.keys(get(playingAudio)).length
        if (options.crossfade) fadeOutAudio(options.crossfade)
        else if (!options.playMultiple) clearAudio("", { playlistCrossfade: options.playlistCrossfade, isPlayingNew: true, clearMicrophones: false })

        const audio = await this.createAudio(path)
        if (!audio) {
            this.clearLoading(pathId)
            return false
        }
        // another audio might have been started while awaiting (if played rapidly)
        if (this.audioExists(path)) {
            this.clearLoading(pathId)
            return true
        }

        const newVolume = AudioPlayer.getVolume(path) * (options.volume || 1)
        audio.volume = Math.min(1, Math.max(0, newVolume))

        options.startAt = AudioPlayer.getStartTime(path, options.startAt)
        if (options.startAt > 0) audio.currentTime = options.startAt

        playingAudio.update((a) => {
            a[path] = {
                name: removeExtension(metadata.name || getFileName(path)),
                paused: !!options.startPaused,
                isMic: false,
                audio,
                playlistId: options.playlistId
            }
            return a
        })

        this.getReplayGainMultiplier(path)
            .then((mult) => {
                const gain = mult || 1
                if (gain === 1) return

                playingAudio.update((a) => {
                    if (!a[path]) return a
                    a[path].replayGainMultiplier = gain
                    return a
                })

                try {
                    const updatedVolume = AudioPlayer.getVolume(path) * (options.volume || 1) * gain
                    audio.volume = Math.min(1, Math.max(0, updatedVolume))
                    AudioAnalyser.setSourceVolume(path, audio.volume)
                } catch (e) {}
            })
            .catch(() => {})

        let waitToPlay = 0
        if (audioPlaying && options.crossfade) {
            audio.volume = 0
            waitToPlay = options.crossfade * 0.6
            fadeInAudio(path, options.crossfade, !!waitToPlay, newVolume)
        }

        this.initAudio(path, waitToPlay, !!options.startPaused)

        const name = removeExtension(metadata.name || getFileName(path))
        this.nowPlaying(path, name)
        this.clearLoading(pathId)
        return true
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
        const onPlay = () => {
            updatePlayingStore(path, "paused", false)
            AudioAnalyserMerger.init()
        }
        const onPause = () => {
            updatePlayingStore(path, "paused", true)
            if (!AudioAnalyser.shouldAnalyse()) {
                AudioAnalyserMerger.stop()
            }
        }
        const onEnded = () => {
            AudioPlayer.checkIfEnding(path, true)
        }
        audio.addEventListener("play", onPlay)
        audio.addEventListener("pause", onPause)
        audio.addEventListener("ended", onEnded)
        ;(audio as any)._cleanupListeners = () => {
            audio.removeEventListener("play", onPlay)
            audio.removeEventListener("pause", onPause)
            audio.removeEventListener("ended", onEnded)
        }

        return await this.waitForAudio(path, audio)
    }

    private static async createAudioFromStream(id: string, stream: MediaStream): Promise<HTMLAudioElement | null> {
        const audio = new Audio()
        // The audio element should be muted for streams, as we are routing the stream directly
        // through AudioContext.createMediaStreamSource. If not muted, the element plays
        // directly to the system output, bypassing our routing graph.
        audio.muted = true
        audio.srcObject = stream
        const onPlay = () => {
            updatePlayingStore(id, "paused", false)
            AudioAnalyserMerger.init()
        }
        const onPause = () => {
            updatePlayingStore(id, "paused", true)
            if (!AudioAnalyser.shouldAnalyse()) {
                AudioAnalyserMerger.stop()
            }
        }
        audio.addEventListener("play", onPlay)
        audio.addEventListener("pause", onPause)
        ;(audio as any)._cleanupListeners = () => {
            audio.removeEventListener("play", onPlay)
            audio.removeEventListener("pause", onPause)
        }

        // For streams, we don't necessarily need to wait for 'canplay'
        // as the stream is already active, but we'll try to load it.
        try {
            await audio.play().catch(() => {})
        } catch {}

        return audio
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

    private static initAudio(id: string, waitToPlay = 0, startPaused = false) {
        const runInit = async () => {
            const playing = get(playingAudio)[id]
            if (!playing) return
            const audio = playing.audio

            if (!startPaused) this.play(id)
            customActionActivation("audio_start")

            await AudioAnalyser.attach(id, playing.stream || audio)
            AudioRoutingManager.getInstance().updateRoutingNodes()
            this.applyProcessing(id)
        }

        if (waitToPlay > 0) {
            setTimeout(runInit, waitToPlay * 1000)
        } else {
            runInit()
        }
    }

    static applyProcessing(id: string) {
        const mediaData = get(media)[id]
        if (!mediaData) return

        this.setPitch(id, mediaData.pitch ?? 0)
        this.setTempo(id, mediaData.tempo ?? 1)
    }

    //

    static play(id: string) {
        if (!this.audioExists(id)) return

        const audio = this.getAudio(id)

        // reset volume in case it's played again while "Mute when video plays" is active
        if (audio && audio.volume === 0) this.updateVolume(id)

        updatePlayingStore(id, "paused", false)
        audio?.play()

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
        AudioAnalyser.detach(id)

        playingAudio.update((a) => {
            const item = a[id]
            if (item?.audio) {
                try {
                    ;(item.audio as any)._cleanupListeners?.()
                    item.audio.pause()
                    item.audio.src = ""
                    item.audio.removeAttribute("src")
                    item.audio.load()
                } catch {}
            }
            this.stopStream(item?.stream)

            delete a[id]
            return a
        })

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
            if (AudioPlaylist.getPlayingKey() === id) {
                newVolume *= AudioPlaylist.getActivePlaylist()?.volume || 1
            }

            const gainMultiplier = get(playingAudio)[id]?.replayGainMultiplier || 1
            newVolume *= gainMultiplier

            updateAudioStore(id, "volume", newVolume)
        })
    }

    static setPitch(id: string, value: number) {
        AudioAnalyser.setPitch(id, value)
    }

    static setTempo(id: string, value: number) {
        const audio = this.getAudio(id)
        if (!audio) return

        audio.playbackRate = value
        if ("preservesPitch" in audio) audio.preservesPitch = true
        AudioAnalyser.setTempo(id, 1)
    }

    static setTime(id: string, time: number) {
        if (!this.getAudio(id)) return false
        updateAudioStore(id, "currentTime", time)
        return true
    }

    static checkIfEnding(id: string, force = false) {
        const playing = this.getPlaying(id)
        if (!playing || (playing.paused && !force)) return

        const audio = this.getAudio(id)
        if (!audio) return

        const endingTime = AudioPlayer.getEndTime(id, audio.duration)
        if (audio.currentTime < endingTime && !force) return

        // loop single audio
        if (get(media)[id]?.loop) {
            const startTime = AudioPlayer.getStartTime(id)
            const audioObj = get(playingAudio)[id]?.audio
            if (audioObj) {
                audioObj.currentTime = startTime
                if (audioObj.paused) audioObj.play().catch(() => {})
            }
            return
        }

        if (AudioPlaylist.getPlayingKey() === id) {
            this.stop(id) // stop existing
            AudioPlaylist.next(true)
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

        const activeAudio = this.getAudio(id)
        let audio = activeAudio || (await loadAudioFile(id))
        let duration = audio?.duration || 0
        // audio streams does not end and have Infinite duration
        if (duration === Infinity) duration = 0

        this.storedDurations.set(id, duration)

        // Clean up temporary audio element created solely for duration inspection
        if (!activeAudio && audio) {
            try {
                audio.pause()
                audio.src = ""
                audio.removeAttribute("src")
                audio.load()
            } catch {}
            audio = null
        }

        return duration
    }
    static getDurationSync(id: string) {
        return this.storedDurations.get(id) || 0
    }

    static getVolume(id: string) {
        return get(media)[id]?.volume || 1
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

    static getOutputs(): Promise<{ value: string; label: string; channels: number }[]> {
        return new Promise((resolve) => {
            navigator.mediaDevices
                .enumerateDevices()
                .then(async (devices) => {
                    const outputDevices = devices.filter((device) => device.kind === "audiooutput" && device.deviceId !== "default")

                    let defaultMaxChannels = 2
                    try {
                        const tempCtx = new AudioContext()
                        defaultMaxChannels = tempCtx.destination.maxChannelCount || 2
                        tempCtx.close()
                    } catch {}

                    const audioOutputs = outputDevices.map((a) => {
                        const cap = (a as any).getCapabilities ? (a as any).getCapabilities() : null
                        const channels = cap?.channelCount?.max || defaultMaxChannels || 2
                        return { value: a.deviceId, label: a.label || "Speaker Output", channels }
                    })
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

    static async getReplayGainMultiplier(path: string): Promise<number> {
        if (this.replayGainCache.has(path)) return this.replayGainCache.get(path) || 1
        try {
            const audioMetadata = await requestMain(Main.READ_AUDIO_METADATA, { filePath: path })
            const mult = audioMetadata?.replayGainMultiplier || 1
            this.replayGainCache.set(path, mult)
            return mult
        } catch (e) {
            console.error("Failed to read ReplayGain metadata", e)
            return 1
        }
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
        a[id].audio[key] = key === "volume" ? Math.min(1, Math.max(0, value)) : value
        if (key === "volume") AudioAnalyser.setSourceVolume(id, value)
        return a
    })
}

export async function loadAudioFile(path: string): Promise<HTMLAudioElement | null> {
    return new Promise((resolve) => {
        const audio = new Audio(encodeFilePath(path))

        audio.addEventListener("loadedmetadata", loaded, { once: true })
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
