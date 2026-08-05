// plays the audio part of any given video element, and syncs the visible video to this

import { get } from "svelte/store"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { AudioAnalyserMerger } from "../../../audio/audioAnalyserMerger"
import { media, outputs, playerVideos, playingVideos, playingVideoState, special, transitionData } from "../../../stores"
import { customActionActivation } from "../../actions/actions"
import { getVimeoData, getYouTubeData } from "../../drawer/player/playerHelper"
import { encodeFilePath, getExtension, getMediaType, locateMediaFile } from "../../helpers/media"
import { checkNextAfterMedia } from "../../helpers/showActions"
import { TimeInterpolator } from "./videoTime"
import { playFolder } from "../../../utils/shortcuts"
import { clearBackground } from "../../output/clear"

type VideoOptions = {
    isOnline?: boolean // youtube / vimeo
    paused?: boolean
    loop?: boolean
    muted?: boolean
    startAt?: number
}
// online videos
type VirtualAudioElement = {
    currentTime: number
    timeTick: TimeInterpolator
    duration: number
    paused: boolean
    loop: boolean
    muted: boolean
}
export type VideoAudioData = {
    path: string
    audio: HTMLAudioElement | VirtualAudioElement
    linkedOutputIds: string[]
}

export class VideoPlayer {
    private static isStarting = new Set<string>()
    static async start(id: string, options: VideoOptions = {}, linkedOutputIds?: string[]): Promise<boolean> {
        const ref = `${id}_${linkedOutputIds?.join(",")}`
        if (this.isStarting.has(ref)) return true
        this.isStarting.add(ref)

        // stop fading out if playing again
        if (this.isFadingOut.includes(id)) this.isFadingOut.splice(this.isFadingOut.indexOf(id), 1)

        const isVideo = options.isOnline || getMediaType(getExtension(id)) === "video"
        if (!isVideo) {
            this.isStarting.delete(ref)
            return false
        }

        if (!options.isOnline) {
            const located = await locateMediaFile(id)
            if (!located) {
                this.isStarting.delete(ref)
                return false
            }

            id = located.path
        }

        // check if already playing
        const existingPlaying = this.getPlaying(id, linkedOutputIds || [])
        if (existingPlaying) {
            const newOutputIds = (linkedOutputIds || []).filter((outId) => !existingPlaying.linkedOutputIds.includes(outId))
            if (newOutputIds.length) {
                linkedOutputIds = newOutputIds
            } else {
                // toggle play/pause if already playing
                if (options.paused) this.pause(id, linkedOutputIds?.[0])
                else this.play(id, linkedOutputIds?.[0])

                this.isStarting.delete(ref)
                return true
            }
        }

        const audio = await this.createAudio(id, linkedOutputIds, options.isOnline)
        if (!audio) {
            this.isStarting.delete(ref)
            return false
        }

        if (options.startAt) {
            audio.currentTime = options.startAt
            if ("timeTick" in audio) audio.timeTick.update(options.startAt)
        }

        playingVideos.update((a) => {
            a.push({ path: id, audio, linkedOutputIds: linkedOutputIds || [] })
            return a
        })

        audio.loop = options.loop ?? false
        audio.muted = options.muted ?? false

        if (!options.paused) this.play(id, linkedOutputIds?.[0])

        if (audio instanceof HTMLAudioElement) this.attachToAnalyser(id, audio, linkedOutputIds || [])

        if (options.startAt && options.startAt > 0 && !audio.muted && audio instanceof HTMLAudioElement) {
            const mediaTransition = get(transitionData)?.media
            const durationMs = mediaTransition?.duration ?? 800
            if (durationMs > 0) {
                this.fadeIn(id, audio, durationMs)
            }
        }

        this.initSyncClock()

        const type = options.muted && options.loop ? "background" : !options.muted && !options.loop ? "foreground" : null
        videoStarting(type)

        // AudioAnalyser.attach(path, audio)

        this.isStarting.delete(ref)
        return true
    }

    static updateProperties(path: string) {
        const audio = this.getAudio(path)
        if (!audio) return

        const data = this.getGlobalOptions(path)

        if (data.speed && audio instanceof HTMLAudioElement) audio.playbackRate = parseFloat(data.speed)
    }

    private static async createAudio(id: string, outputIds?: string[], isOnline?: boolean): Promise<HTMLAudioElement | VirtualAudioElement | null> {
        if (isOnline) {
            const playerData = get(playerVideos)[id]
            const path = playerData?.id || ""
            const data = await (playerData?.type === "youtube" ? getYouTubeData(path) : playerData?.type === "vimeo" ? getVimeoData(path) : null)

            return {
                currentTime: 0,
                timeTick: new TimeInterpolator(),
                duration: data?.duration || 0,
                paused: true,
                loop: false,
                muted: false
            }
        }

        const audio = new Audio(encodeFilePath(id))
        audio.addEventListener("play", () => {
            AudioAnalyserMerger.init()
        })
        audio.addEventListener("pause", () => {
            if (!AudioAnalyser.shouldAnalyse()) AudioAnalyserMerger.stop()
        })
        audio.addEventListener("ended", () => {
            // absolute end
            this.checkIfEnding(id, outputIds, true)
        })
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
                VideoPlayer.stop(pathOrId)
                resolve(null)
            }
        })
    }

    private static isCheckingEnding = new Set<string>()
    static async checkIfEnding(path: string, outputIds?: string[], force = false) {
        if (this.isCheckingEnding.has(path)) return
        this.isCheckingEnding.add(path)

        const playing = this.getPlaying(path, outputIds || [])
        if (!playing || (playing.audio.paused && !force)) return finish()

        const audio = this.getAudio(path, outputIds ? outputIds[0] : undefined)
        if (!audio) return finish()

        const endingTime = this.getEndTime(path, audio.duration)
        const offset = ((get(transitionData)?.media?.duration ?? 800) / 1000) * 0.5
        if (audio.currentTime < endingTime - offset && !force) return finish()

        // should loop
        if (this.getGlobalOptions(path)?.loop) return finish()

        const outputId = outputIds?.[0] || ""
        const background = get(outputs)[outputIds?.[0] || ""]?.out?.background
        // project media folder
        if (background?.folderPath) {
            playFolder(background.folderPath)
            return finish()
        }

        const localLoop = this.getAudio(path, outputId)?.loop

        // check and execute next after media regardless of loop
        if ((await checkNextAfterMedia(path, "media", outputId)) || localLoop) return finish()

        if (get(special).clearMediaOnFinish === false) return finish()

        setTimeout(() => {
            // double check that output is still the same
            const outputState = get(outputs)[outputId]?.out?.background
            const newVideoPath: string = outputState?.path || outputState?.id || ""
            if (newVideoPath !== path) return finish()

            clearBackground(outputId)
            // this.stop(path, outputIds ? outputIds[0] : undefined, true)

            finish()
        }, 200) // WAIT FOR NEXT AFTER MEDIA TO FINISH

        function finish() {
            VideoPlayer.isCheckingEnding.delete(path)
        }
    }

    //

    static play(path: string, outputId?: string) {
        if (!this.audioExists(path, outputId ? [outputId] : undefined)) return

        const audio = this.getAudio(path, outputId)
        if (!audio) return

        if (audio instanceof HTMLAudioElement) {
            audio.play()
            AudioAnalyserMerger.init()
        } else if ("timeTick" in audio) {
            audio.paused = false
            audio.timeTick.play()
        }

        this.initSyncClock()
    }

    static pause(path: string, outputId?: string) {
        if (!this.audioExists(path, outputId ? [outputId] : undefined)) return

        const audio = this.getAudio(path, outputId)
        if (!audio) return

        if (audio instanceof HTMLAudioElement) {
            audio.pause()
            if (!AudioAnalyser.shouldAnalyse()) AudioAnalyserMerger.stop()
        } else if ("timeTick" in audio) {
            audio.paused = true
            audio.timeTick.pause()
        }

        this.initSyncClock()
    }

    static isFadingOut: string[] = []
    static async stop(path: string, outputId?: string, reachedEnd = false) {
        if (!this.audioExists(path, outputId ? [outputId] : undefined) || this.isFadingOut.includes(path)) return

        const audio = this.getAudio(path, outputId)

        if (audio instanceof HTMLAudioElement && !reachedEnd && audio && !audio.paused && audio.volume > 0) {
            const durationMs = get(transitionData)?.media?.duration ?? 800
            if (durationMs > 0) {
                const faded = await this.fadeOut(path, audio, durationMs)
                if (!faded) return

                const fadeIndex = this.isFadingOut.indexOf(path)
                if (fadeIndex !== -1) this.isFadingOut.splice(fadeIndex, 1)
            }
        }

        this.pause(path, outputId)

        const linkedOutputIds = this.getPlaying(path, outputId ? [outputId] : [])?.linkedOutputIds || []
        linkedOutputIds.forEach((outputId) => AudioAnalyser.detach(path, outputId))

        playingVideos.update((a) => {
            // reset
            const index = a.findIndex((v) => v.path === path && (!outputId || v.linkedOutputIds.includes(outputId)))
            if (index !== -1) {
                if (a[index].audio instanceof HTMLAudioElement) a[index].audio.src = ""
                a.splice(index, 1)
            }
            return a
        })

        videoEnding()
    }

    private static async fadeOut(path: string, audio: HTMLAudioElement, durationMs: number): Promise<boolean> {
        this.isFadingOut.push(path)

        // WIP account for transition offset
        // if (!clearOutput) duration /= 2.4 // a little less than half the time

        const startVolume = audio.volume
        const steps = 30
        const intervalMs = durationMs / steps
        const volumeStep = startVolume / steps

        await new Promise<void>((resolve) => {
            const timer = setInterval(() => {
                if (!this.isFadingOut.includes(path)) {
                    clearInterval(timer)
                    resolve()
                    return
                }
                if (audio.volume > volumeStep) {
                    audio.volume = Math.max(0, audio.volume - volumeStep)
                    AudioAnalyser.setSourceVolume(path, audio.volume)
                } else {
                    audio.volume = 0
                    AudioAnalyser.setSourceVolume(path, 0)
                    clearInterval(timer)
                    resolve()
                }
            }, intervalMs)
        })

        return this.isFadingOut.includes(path)
    }

    private static async fadeIn(path: string, audio: HTMLAudioElement, durationMs: number): Promise<void> {
        const targetVolume = audio.volume || 1
        audio.volume = 0
        AudioAnalyser.setSourceVolume(path, 0)

        const steps = 30
        const intervalMs = durationMs / steps
        const volumeStep = targetVolume / steps

        await new Promise<void>((resolve) => {
            const timer = setInterval(() => {
                if (this.isFadingOut.includes(path) || audio.paused) {
                    clearInterval(timer)
                    resolve()
                    return
                }
                if (audio.volume < targetVolume - volumeStep) {
                    audio.volume = Math.min(targetVolume, audio.volume + volumeStep)
                    AudioAnalyser.setSourceVolume(path, audio.volume)
                } else {
                    audio.volume = targetVolume
                    AudioAnalyser.setSourceVolume(path, targetVolume)
                    clearInterval(timer)
                    resolve()
                }
            }, intervalMs)
        })
    }

    static stopByOutputIds(outputIds: string[]) {
        const videosToStop = get(playingVideos).filter((v) => v.linkedOutputIds?.some((id) => outputIds.includes(id)))
        videosToStop.forEach((v) => this.stop(v.path, outputIds?.[0]))
    }

    static seekTo(path: string, outputId: string, time: number) {
        this.setAudioValue(path, outputId, "currentTime", time)
    }

    static toggleLoop(path: string, outputId: string) {
        this.setAudioValue(path, outputId, "loop", !this.getAudio(path, outputId)?.loop)
    }

    static toggleMute(path: string, outputId: string) {
        this.setAudioValue(path, outputId, "muted", !this.getAudio(path, outputId)?.muted)
    }

    private static setAudioValue(path: string, outputId: string, key: string, value: any) {
        const audio = this.getAudio(path, outputId)
        if (!audio) return

        audio[key] = value

        if (key === "currentTime" && "timeTick" in audio) audio.timeTick.update(value)

        this.initSyncClock()
    }

    // GET

    static getPlaying(path: string, outputIds?: string[]): VideoAudioData | null {
        return get(playingVideos).find((v) => v.path === path && (outputIds ? v.linkedOutputIds.join(",") === outputIds.join(",") : true)) || null
    }

    static getAudio(path: string, outputId?: string) {
        const video = get(playingVideos).find((v) => v.path === path && (!outputId || v.linkedOutputIds.includes(outputId)))
        return video?.audio || null
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

    static async getDuration(path: string): Promise<number> {
        const audio = this.getAudio(path)
        if (audio) return audio.duration

        return new Promise((resolve) => {
            let video = document.createElement("audio")
            video.setAttribute("src", encodeFilePath(path))
            video.addEventListener("loadedmetadata", () => {
                resolve(video.duration)
                video.remove()
            })
        })
    }

    // STATE

    static audioExists(path: string, outputIds?: string[]) {
        const playing = this.getPlaying(path, outputIds || [])
        if (!playing) return false

        if (!outputIds?.length) return !!playing
        return outputIds.some((id) => playing.linkedOutputIds.includes(id))
    }

    // static isPaused(path: string) {
    //     return !!this.getPlaying(path)?.audio?.paused
    // }

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
        this.syncClockTimer = setInterval(() => this.syncState(), get(special).optimizedMode ? 1000 : 100)
    }

    private static syncState() {
        let isPlaying = false

        playingVideoState.update((a) => {
            get(playingVideos).forEach((video) => {
                const audio = video.audio
                if (!audio) return

                if ("timeTick" in audio) audio.currentTime = audio.timeTick.value

                const outputIds = video.linkedOutputIds || []

                // check if ended before it actually ends, so we can fade out while next starts
                // this also accounts for clearing player videos
                this.checkIfEnding(video.path, outputIds)

                outputIds.forEach((outputId) => {
                    const id = `${video.path}_${outputId}`
                    a[id] = {
                        currentTime: audio.currentTime,
                        duration: audio.duration,
                        paused: audio.paused,
                        loop: audio.loop,
                        muted: audio.muted
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
