// plays the audio part of any given video element, and syncs the visible video to this

import { get } from "svelte/store"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { AudioAnalyserMerger } from "../../../audio/audioAnalyserMerger"
import { media, playingVideos, playingVideoState } from "../../../stores"
import { customActionActivation } from "../../actions/actions"
import { encodeFilePath, getExtension, getMediaType } from "../../helpers/media"
import { checkNextAfterMedia } from "../../helpers/showActions"

type VideoOptions = {
    paused?: boolean
    loop?: boolean
    muted?: boolean
    startAt?: number
}
export type VideoAudioData = {
    path: string
    audio: HTMLAudioElement
    linkedOutputIds: string[]
}

// WIP check that this also works for videos without audio tracks

// WIP fade in/out audio

export class VideoPlayer {
    static async start(path: string, options: VideoOptions = {}, linkedOutputIds?: string[]): Promise<boolean> {
        // stop fading out if playing again
        if (this.isFadingOut.includes(path)) this.isFadingOut.splice(this.isFadingOut.indexOf(path), 1)

        const isVideo = getMediaType(getExtension(path)) === "video"
        if (!isVideo) return false

        const audio = await this.createAudio(path)
        if (!audio) return false

        if (options.startAt) audio.currentTime = options.startAt

        // WIP check that it's not already playing
        playingVideos.update((a) => {
            a.push({ path, audio, linkedOutputIds: linkedOutputIds || [] })
            return a
        })

        await this.attachToAnalyser(path, audio, linkedOutputIds || [])
        this.updateProperties(path, options)

        if (!options.paused) this.play(path)

        this.initSyncClock()

        const type = options.muted && options.loop ? "background" : !options.muted && !options.loop ? "foreground" : null
        videoStarting(type)

        // AudioAnalyser.attach(path, audio)

        return true
    }

    static updateProperties(path: string, options: VideoOptions, outputId?: string) {
        const audio = this.getAudio(path, outputId)
        if (!audio) return

        const data = get(media)[path]

        if (audio.paused) this.pause(path)
        audio.loop = options.loop ?? data?.loop ?? false
        audio.muted = options.muted ?? false
    }

    private static async createAudio(path: string): Promise<HTMLAudioElement | null> {
        const audio = new Audio(encodeFilePath(path))
        audio.addEventListener("play", () => {
            updatePlayingStore(path, "paused", false)
            AudioAnalyserMerger.init()
        })
        audio.addEventListener("pause", () => {
            updatePlayingStore(path, "paused", true)
            if (!AudioAnalyser.shouldAnalyse()) AudioAnalyserMerger.stop()
        })
        audio.addEventListener("ended", () => {
            this.checkIfEnding(path, true)
        })
        return await this.waitForAudio(path, audio)
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
                VideoPlayer.stop(pathOrId)
                resolve(null)
            }
        })
    }

    static checkIfEnding(path: string, force = false) {
        const playing = this.getPlaying(path)
        if (!playing || (playing.audio.paused && !force)) return

        const audio = this.getAudio(path)
        if (!audio) return

        const endingTime = this.getEndTime(path, audio.duration)
        if (audio.currentTime < endingTime && !force) return

        // should loop
        if (get(media)[path]?.loop) return

        this.stop(path)

        checkNextAfterMedia(path)
    }

    //

    static play(path: string, outputId?: string) {
        if (!this.audioExists(path)) return

        updatePlayingStore(path, "paused", false)
        this.getAudio(path, outputId)?.play()

        AudioAnalyserMerger.init()
        this.initSyncClock()
    }

    static pause(path: string, outputId?: string) {
        if (!this.audioExists(path)) return

        updatePlayingStore(path, "paused", true)
        this.getAudio(path, outputId)?.pause()

        if (!AudioAnalyser.shouldAnalyse()) AudioAnalyserMerger.stop()
        this.initSyncClock()
    }

    static isFadingOut: string[] = []
    static stop(path: string, outputId?: string) {
        if (!this.audioExists(path) || this.isFadingOut.includes(path)) return

        this.isFadingOut.push(path)
        // WIP await fade out

        // might have been started again while fading out
        if (!this.isFadingOut.includes(path)) return

        this.pause(path, outputId)

        const linkedOutputIds = this.getPlaying(path)?.linkedOutputIds || []
        linkedOutputIds.forEach((outputId) => AudioAnalyser.detach(path, outputId))

        playingVideos.update((a) => {
            // reset
            const index = a.findIndex((v) => v.path === path && (!outputId || v.linkedOutputIds.includes(outputId)))
            if (index !== -1) {
                a[index].audio.src = ""
                a.splice(index, 1)
            }
            return a
        })

        videoEnding()
    }

    static stopByOutputIds(outputIds: string[]) {
        const videosToStop = get(playingVideos).filter((v) => v.linkedOutputIds?.some((id) => outputIds.includes(id)))
        videosToStop.forEach((v) => this.stop(v.path))
    }

    static seekTo(path: string, outputId: string, time: number) {
        const audio = this.getAudio(path, outputId)
        if (!audio) return

        audio.currentTime = time
        this.initSyncClock()
    }

    // GET

    static getPlaying(path: string): VideoAudioData | null {
        return get(playingVideos).find((v) => v.path === path) || null
    }

    static getAudio(path: string, outputId?: string): HTMLAudioElement | null {
        const video = get(playingVideos).find((v) => v.path === path && (!outputId || v.linkedOutputIds.includes(outputId)))
        return video?.audio || null
    }

    static getTime(path: string) {
        return this.getAudio(path)?.currentTime || 0
    }

    static getGlobalOptions(path: string) {
        return get(media)[path] || {}
    }

    static getStartTime(_path: string, startAt?: number | undefined) {
        return startAt || 0
    }
    static getEndTime(_path: string, duration: number) {
        return duration
    }

    // STATE

    static audioExists(path: string) {
        return !!this.getPlaying(path)
    }

    static isPaused(path: string) {
        return !!this.getPlaying(path)?.audio?.paused
    }

    // SYNC

    private static async attachToAnalyser(path: string, audio: HTMLAudioElement, outputIds: string[]) {
        if (!outputIds.length) return

        for (const outputId of outputIds) {
            if (AudioAnalyser.hasSource(path, outputId)) continue
            await AudioAnalyser.attach(path, audio, outputId)
            AudioAnalyser.setSourceVolume(path, audio.volume, outputId)
            AudioAnalyser.setTempo(path, 1, outputId)
            AudioAnalyser.recorderActivate()
        }
    }

    private static syncClockTimer: NodeJS.Timeout | null = null
    private static initSyncClock() {
        if (this.syncClockTimer) clearInterval(this.syncClockTimer)
        this.syncState() // update immediately
        this.syncClockTimer = setInterval(() => this.syncState(), 1000)
    }

    private static syncState() {
        let isPlaying = false

        playingVideoState.update((a) => {
            get(playingVideos).forEach((video) => {
                const audio = video.audio
                console.log(audio, audio?.currentTime, audio?.paused)
                if (!audio) return

                const outputIds = video.linkedOutputIds || []
                outputIds.forEach((outputId) => {
                    const id = `${video.path}_${outputId}`
                    a[id] = {
                        currentTime: audio.currentTime,
                        duration: audio.duration,
                        paused: audio.paused,
                        loop: audio.loop
                    }
                })

                if (!audio.paused) isPlaying = true
            })

            return a
        })

        if (!isPlaying) {
            if (this.syncClockTimer) {
                clearInterval(this.syncClockTimer)
                this.syncClockTimer = null
            }
        }
    }
}

function updatePlayingStore(id: string, key: string, value: any) {
    playingVideos.update((a) => {
        const index = a.findIndex((v) => v.path === id)
        if (index === -1) return a
        a[index][key] = value
        return a
    })
}

function videoEnding() {
    setTimeout(() => {
        customActionActivation("video_end")
    })
}
function videoStarting(type: "foreground" | "background" | null) {
    customActionActivation("video_start")

    if (type === "foreground") customActionActivation("video_start_foreground")
    else if (type === "background") customActionActivation("video_start_background")
}
