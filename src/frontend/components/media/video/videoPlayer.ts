// plays the audio part of any given video element, and syncs the visible video to this

import { get } from "svelte/store"
import { Main } from "../../../../types/IPC/Main"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio } from "../../../audio/audioFading"
import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
import { requestMain } from "../../../IPC/main"
import { media, outputs, playerVideos, playingVideos, playingVideoState, special, transitionData } from "../../../stores"
import { playFolder } from "../../../utils/shortcuts"
import { customActionActivation } from "../../actions/actions"
import { getVimeoData, getYouTubeData } from "../../drawer/player/playerHelper"
import { clone } from "../../helpers/array"
import { downloadOnlineMedia, encodeFilePath, getExtension, getMediaType, locateMediaFile } from "../../helpers/media"
import { getAllOutputs } from "../../helpers/output"
import { checkNextAfterMedia } from "../../helpers/showActions"
import { clearBackground } from "../../output/clear"
import { TimeInterpolator } from "./videoTime"

type VideoOptions = {
    isOnline?: boolean // youtube / vimeo
    paused?: boolean
    loop?: boolean
    muted?: boolean
    startAt?: number
    type?: "background" | "item"
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
    type?: "background" | "item"
    replayGainMultiplier?: number
    softLoop?: number
    loop?: boolean
    fromTime?: number
    toTime?: number
}

export type PlayingVideoState = {
    currentTime: number
    duration: number
    paused: boolean
    loop: boolean
    muted: boolean
    softLoop?: number
    softLoopOpacity?: number
    type?: "background" | "item"
    isFadingOut?: boolean
    // true when the authoritative clock is the wall-clock ticker (video has no real audio element):
    // nothing audible to lip-sync against, so followers may correct drift gently instead of hard-seeking
    virtualClock?: boolean
}

export class VideoPlayer {
    private static replayGainCache: Map<string, number> = new Map()

    private static isStarting = new Set<string>()
    static async start(id: string, options: VideoOptions = {}, linkedOutputIds?: string[]): Promise<boolean> {
        if (!id) return false

        const ref = `${id}_${linkedOutputIds?.join(",")}`
        if (this.isStarting.has(ref)) return true
        this.isStarting.add(ref)

        // stop fading out if playing again
        if (this.isFadingOut.includes(id)) {
            this.isFadingOut.splice(this.isFadingOut.indexOf(id), 1)
            this.updateVolume(id)
        }

        const isVideo = options.isOnline || getMediaType(getExtension(id)) === "video"
        if (!isVideo) {
            this.isStarting.delete(ref)
            return false
        }

        let audioPath = id
        if (!options.isOnline) {
            if (audioPath.startsWith("http")) {
                audioPath = (await downloadOnlineMedia(audioPath)) || audioPath
            } else {
                const located = await locateMediaFile(audioPath)
                if (!located) {
                    this.isStarting.delete(ref)
                    return false
                }

                audioPath = located.path
                id = located.path
            }
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

        const audio = await this.createAudio(audioPath, id, linkedOutputIds, options.isOnline)
        if (!audio) {
            this.isStarting.delete(ref)
            return false
        }

        const startTime = this.getStartTime(id, options.startAt)
        if (startTime) {
            audio.currentTime = startTime
            if ("timeTick" in audio) audio.timeTick.update(startTime)
        }

        const globalOpts = this.getGlobalOptions(id)
        const softLoop = globalOpts.softLoop || 0
        const loop = globalOpts.loop !== undefined ? globalOpts.loop : options.loop
        const fromTime = globalOpts.fromTime || 0
        const toTime = this.getEndTime(id, audio.duration)

        playingVideos.update((a) => {
            a.push({ path: id, audio, linkedOutputIds: linkedOutputIds || [], type: options.type || "background", softLoop, loop, fromTime, toTime })
            return a
        })

        if (!options.isOnline) {
            this.getReplayGainMultiplier(id)
                .then((mult) => {
                    const gain = mult || 1
                    if (gain === 1) return

                    playingVideos.update((a) => {
                        const item = a.find((v) => v.path === id)
                        if (item) item.replayGainMultiplier = gain
                        return a
                    })
                    this.updateVolume(id)
                })
                .catch(() => {})
        }

        const hasCustomBounds = fromTime > 0 || (toTime > 0 && toTime < audio.duration)
        audio.loop = (options.loop ?? false) && !hasCustomBounds
        audio.muted = options.muted ?? false

        this.updateVolume(id)

        const mediaTransition = get(transitionData)?.media
        const durationMs = mediaTransition?.duration ?? 800
        const delayMs = durationMs > 0 ? durationMs / 4 + 20 : 0

        const startPlayback = () => {
            if (!options.paused) this.play(id, linkedOutputIds?.[0])

            if (audio instanceof HTMLAudioElement) this.attachToAnalyser(id, audio, linkedOutputIds || [])

            if (!audio.muted && audio instanceof HTMLAudioElement && durationMs > 0) {
                this.fadeIn(id, audio, durationMs)
            }

            this.initSyncClock()
        }

        if (delayMs > 0) setTimeout(startPlayback, delayMs)
        else startPlayback()

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

        playingVideos.update((a) => {
            const item = a.find((v) => v.path === path)
            if (item) {
                item.softLoop = data.softLoop || 0
                if (data.loop !== undefined) item.loop = data.loop
                item.fromTime = data.fromTime || 0
                item.toTime = data.toTime || audio.duration
                const hasCustomBounds = item.fromTime > 0 || (item.toTime > 0 && item.toTime < audio.duration)
                audio.loop = !!item.loop && !hasCustomBounds
            }
            return a
        })

        if (data.volume !== undefined) {
            this.updateVolume(path)
            if (get(special).muteAudioWhenVideoPlays) {
                if (this.hasAudibleVideo()) fadeoutAllPlayingAudio()
                else fadeinAllPlayingAudio()
            }
        }
        if (data.speed && audio instanceof HTMLAudioElement) this.setTempo(path, parseFloat(data.speed))
        if (data.pitch !== undefined) this.setPitch(path, data.pitch)
    }

    static updateVolume(specificVideoPath: string | null = null) {
        const videos = specificVideoPath ? get(playingVideos).filter((v) => v.path === specificVideoPath) : get(playingVideos)
        videos.forEach((v) => {
            let newVolume = this.getVolume(v.path) * (v.replayGainMultiplier || 1)
            v.linkedOutputIds.forEach((outputId) => {
                const audio = this.getAudio(v.path, outputId)
                if (audio && "volume" in audio) {
                    audio.volume = Math.min(1, Math.max(0, newVolume))
                    AudioAnalyser.setSourceVolume(v.path, Math.max(0, newVolume), outputId)
                }
            })
        })
    }

    private static async createAudio(audioPath: string, originalId: string, outputIds?: string[], isOnline?: boolean): Promise<HTMLAudioElement | VirtualAudioElement | null> {
        if (isOnline) {
            const playerData = get(playerVideos)[originalId]
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

        const audio = new Audio(encodeFilePath(audioPath))

        // a real audio track has decoded bytes by canplay; none means this is a video-only file
        audio.addEventListener("canplay", () => {
            if (((audio as any).webkitAudioDecodedByteCount ?? 1) === 0) (audio as any).__noAudioTrack = true
        })
        audio.addEventListener("ended", () => {
            const playing = this.getPlaying(originalId, outputIds || [])
            if (playing?.loop || this.getGlobalOptions(originalId)?.loop) {
                const startTime = this.getStartTime(originalId)
                audio.currentTime = startTime
                if ("timeTick" in audio) (audio as any).timeTick.update(startTime)
                if (audio.paused) audio.play().catch(() => {})
                return
            }
            // absolute end
            this.checkIfEnding(originalId, outputIds, true)
        })
        const loaded = await this.waitForAudio(originalId, audio)
        if (!loaded) return null

        // Video-only files: an <audio> element has no audio track to pace against and (with webm)
        // free-runs at demux speed, "ending" a full video within a second — which the end check then
        // treats as media finished and clears the background right after it starts. Nothing is
        // audible either way, so clock silent videos with the wall-clock ticker instead (same as
        // online media); the probe element is discarded once it has yielded the duration.
        if ((loaded as any).__noAudioTrack === true) {
            const duration = loaded.duration
            try {
                loaded.removeAttribute("src")
                loaded.load()
            } catch {
                // probe element already unloaded
            }
            return { currentTime: 0, timeTick: new TimeInterpolator(), duration, paused: true, loop: false, muted: true }
        }

        return loaded
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
        if (playing.loop || this.getGlobalOptions(path)?.loop) {
            if (audio.currentTime >= endingTime || force) {
                const startTime = this.getStartTime(path)
                audio.currentTime = startTime
                if ("timeTick" in audio) (audio as any).timeTick.update(startTime)
                if (audio.paused && audio instanceof HTMLAudioElement) audio.play().catch(() => {})
            }
            return finish()
        }

        const background = get(outputs)[outputIds?.[0] || ""]?.out?.background
        // project media folder
        if (background?.folderPath) {
            playFolder(background.folderPath)
            return finish()
        }

        const localLoop = playing.loop

        // check and execute next after media regardless of loop
        if ((await checkNextAfterMedia(path, "media", outputIds)) || localLoop) return finish()

        if (get(special).clearMediaOnFinish === false) return finish()

        setTimeout(() => {
            const checkOutputIds = outputIds?.length ? outputIds : [outputIds?.[0] || ""]
            checkOutputIds.forEach((outputId) => {
                if (!outputId) return

                // double check that output is still the same
                const outputState = get(outputs)[outputId]?.out?.background
                const newVideoPath: string = outputState?.path || outputState?.id || ""
                if (newVideoPath === path) clearBackground(outputId)
            })

            finish()
        }, 200) // WAIT FOR NEXT AFTER MEDIA TO FINISH

        function finish() {
            VideoPlayer.isCheckingEnding.delete(path)
        }
    }

    //

    static play(path: string, outputId?: string) {
        if (this.isFadingOut.includes(path)) {
            const fadeIndex = this.isFadingOut.indexOf(path)
            if (fadeIndex !== -1) this.isFadingOut.splice(fadeIndex, 1)
            this.updateVolume(path)
        }

        if (!this.audioExists(path, outputId ? [outputId] : undefined)) return

        const audio = this.getAudio(path, outputId)
        if (!audio) return

        if (audio instanceof HTMLAudioElement) {
            audio.play().catch((err) => console.warn("[VideoPlayer] play failed:", err?.name))
        } else if ("timeTick" in audio) {
            audio.paused = false
            audio.timeTick.play()
        }

        if (get(special).muteAudioWhenVideoPlays && this.hasAudibleVideo()) {
            fadeoutAllPlayingAudio()
        }

        this.initSyncClock()
    }

    static pause(path: string, outputId?: string) {
        if (!this.audioExists(path, outputId ? [outputId] : undefined)) return

        const playing = this.getPlaying(path, outputId ? [outputId] : undefined)
        if (playing && (playing as any).crossfadeAudio) {
            ;(playing as any).crossfadeAudio.pause()
        }

        const audio = this.getAudio(path, outputId)
        if (!audio) return

        if (audio instanceof HTMLAudioElement) {
            audio.pause()
        } else if ("timeTick" in audio) {
            audio.paused = true
            audio.timeTick.pause()
        }

        if (get(special).muteAudioWhenVideoPlays && !this.hasAudibleVideo()) {
            fadeinAllPlayingAudio()
        }

        this.initSyncClock()
    }

    static isFadingOut: string[] = []
    static isStopping = new Set<string>()
    static async stop(path: string, outputId?: string, reachedEnd = false) {
        if (!this.audioExists(path, outputId ? [outputId] : undefined) || this.isFadingOut.includes(path)) return

        // multiple outputs at once
        if (this.isStopping.has(path)) return
        this.isStopping.add(path)
        setTimeout(() => this.isStopping.delete(path), 20)

        const audio = this.getAudio(path, outputId)
        const playing = get(playingVideos).find((v) => v.path === path)

        const nonActiveOutputs = getAllOutputs()
            .filter((a) => !a.enabled || !a.active)
            .map((a) => a.id)
        const linkedOutputIds = clone(playing?.linkedOutputIds || [])
        const stopInOutputIds = linkedOutputIds.filter((id) => !nonActiveOutputs.includes(id))
        const shouldStop = linkedOutputIds.length === stopInOutputIds.length

        if (shouldStop && audio instanceof HTMLAudioElement && !reachedEnd && audio && !audio.paused && audio.volume > 0) {
            const durationMs = get(transitionData)?.media?.duration ?? 800
            if (durationMs > 0) {
                const faded = await this.fadeOut(path, audio, durationMs)
                if (!faded) return
            }
        } else if (shouldStop && !reachedEnd && audio && "timeTick" in audio && !audio.paused) {
            // silent / video-only files use a virtual clock — no audio to fade, but we still
            // need to hold off pausing the video element until the visual transition finishes
            const durationMs = get(transitionData)?.media?.duration ?? 800
            if (durationMs > 0) {
                this.isFadingOut.push(path)
                await new Promise<void>((resolve) => setTimeout(resolve, durationMs))
                const fadeIndex = this.isFadingOut.indexOf(path)
                if (fadeIndex === -1) return

                this.isFadingOut.splice(fadeIndex, 1)
            }
        }

        if (shouldStop) this.pause(path, outputId)

        const detachOutputIds = Array.from(new Set(shouldStop ? [...stopInOutputIds, ...(outputId ? [outputId] : [])] : stopInOutputIds))
        detachOutputIds.forEach((outId) => AudioAnalyser.detach(path, outId))

        playingVideos.update((a) => {
            const index = a.findIndex((v) => v.path === path)
            if (index === -1) return a

            // reset
            if (shouldStop) {
                if (a[index].audio instanceof HTMLAudioElement) a[index].audio.src = ""
                a.splice(index, 1)
            } else {
                a[index].linkedOutputIds = linkedOutputIds.filter((id) => nonActiveOutputs.includes(id))
            }

            return a
        })

        playingVideoState.update((state) => {
            const targets = outputId && !shouldStop ? [outputId, ...stopInOutputIds] : stopInOutputIds
            targets.forEach((outId) => {
                delete state[`${path}_${outId}`]
            })

            if (shouldStop) {
                Object.keys(state).forEach((key) => {
                    if (key.startsWith(`${path}_`)) delete state[key]
                })
            }

            return state
        })

        videoEnding()

        if (!get(playingVideos).length) {
            AudioInputCapture.getInstance().clearMergedDbs()
        }
    }

    private static async fadeOut(path: string, audio: HTMLAudioElement, durationMs: number): Promise<boolean> {
        if (!audio || audio.volume <= 0) return true
        this.isFadingOut.push(path)

        // WIP account for transition offset
        // if (!clearOutput) duration /= 2.4 // a little less than half the time

        const startVolume = audio.volume
        const steps = 30
        const intervalMs = Math.max(10, durationMs / steps)
        const volumeStep = startVolume / steps
        let currentStep = 0

        const finished = await new Promise<boolean>((resolve) => {
            const timer = setInterval(() => {
                currentStep++

                if (!this.isFadingOut.includes(path)) {
                    clearInterval(timer)
                    resolve(false)
                    return
                }

                if (currentStep >= steps || audio.volume <= volumeStep) {
                    audio.volume = 0
                    AudioAnalyser.setSourceVolume(path, 0)
                    const fadeIndex = this.isFadingOut.indexOf(path)
                    if (fadeIndex !== -1) this.isFadingOut.splice(fadeIndex, 1)
                    clearInterval(timer)
                    resolve(true)
                    return
                }

                audio.volume = Math.max(0, audio.volume - volumeStep)
                AudioAnalyser.setSourceVolume(path, audio.volume)
            }, intervalMs)
        })

        return finished
    }

    static isFadingIn: string[] = []
    private static async fadeIn(path: string, audio: HTMLAudioElement, durationMs: number): Promise<void> {
        this.isFadingIn.push(path)
        const targetVolume = this.getVolume(path) * (this.getPlaying(path)?.replayGainMultiplier ?? 1)
        audio.volume = 0
        AudioAnalyser.setSourceVolume(path, 0)

        const steps = 30
        const intervalMs = Math.max(10, durationMs / steps)
        const volumeStep = targetVolume / steps
        let currentStep = 0

        await new Promise<void>((resolve) => {
            const timer = setInterval(() => {
                currentStep++

                if (this.isFadingOut.includes(path) || !this.isFadingIn.includes(path) || audio.paused || currentStep >= steps || audio.volume >= targetVolume - volumeStep) {
                    audio.volume = Math.min(1, Math.max(0, targetVolume))
                    AudioAnalyser.setSourceVolume(path, Math.max(0, targetVolume))
                    const fadeIndex = this.isFadingIn.indexOf(path)
                    if (fadeIndex !== -1) this.isFadingIn.splice(fadeIndex, 1)
                    clearInterval(timer)
                    resolve()
                    return
                }

                const nextVol = Math.min(targetVolume, audio.volume + volumeStep)
                audio.volume = Math.min(1, Math.max(0, nextVol))
                AudioAnalyser.setSourceVolume(path, Math.max(0, nextVol))
            }, intervalMs)
        })
    }

    static stopByOutputIds(outputIds: string[]) {
        const videosToStop = get(playingVideos).filter((v) => v.linkedOutputIds?.some((id) => outputIds.includes(id)))
        videosToStop.forEach((v) => this.stop(v.path))
    }

    static seekTo(path: string, outputId: string, time: number) {
        this.setAudioValue(path, outputId, "currentTime", time)
    }

    static toggleLoop(path: string, outputId: string) {
        const playing = this.getPlaying(path, outputId ? [outputId] : undefined)
        if (!playing) return

        const newLoop = !playing.loop
        playingVideos.update((a) => {
            const item = a.find((v) => v.path === path)
            if (item) {
                item.loop = newLoop
                const fromTime = item.fromTime || 0
                const toTime = item.toTime || item.audio.duration
                const hasCustomBounds = fromTime > 0 || (toTime > 0 && toTime < item.audio.duration)
                item.audio.loop = newLoop && !hasCustomBounds
            }
            return a
        })
        this.initSyncClock()
    }

    static toggleMute(path: string, outputId: string) {
        this.setAudioValue(path, outputId, "muted", !this.getAudio(path, outputId)?.muted)

        if (get(special).muteAudioWhenVideoPlays) {
            if (this.hasAudibleVideo()) fadeoutAllPlayingAudio()
            else fadeinAllPlayingAudio()
        }
    }

    static isAudible(video: VideoAudioData | null | undefined): boolean {
        if (!video || !video.audio) return false
        if (video.audio.paused || video.audio.muted) return false
        if (this.isFadingOut.includes(video.path) || this.isStopping.has(video.path)) return false
        if (this.getVolume(video.path) <= 0) return false
        return true
    }

    static hasAudibleVideo(): boolean {
        return get(playingVideos).some((v) => this.isAudible(v))
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
        return get(playingVideos).find((v) => v.path === path && (outputIds?.length ? outputIds.some((id) => v.linkedOutputIds.includes(id)) : true)) || null
    }

    static getAudio(path: string, outputId?: string) {
        const video = get(playingVideos).find((v) => v.path === path && (!outputId || v.linkedOutputIds.includes(outputId)))
        return video?.audio || null
    }

    static getGlobalOptions(path: string) {
        return get(media)[path] || {}
    }

    static getVolume(path: string) {
        return this.getGlobalOptions(path)?.volume ?? 1
    }

    static getStartTime(path: string, startAt?: number | undefined) {
        const data = this.getGlobalOptions(path)
        const startTime = Math.max(startAt || 0, data.fromTime || 0)
        return startTime
    }
    static getEndTime(path: string, duration: number) {
        const data = this.getGlobalOptions(path)
        const endTime = data.toTime || duration
        return endTime
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
        const playing = get(playingVideos).find((v) => v.path === path)
        if (!playing) return false

        if (!outputIds?.length) return true
        return outputIds.some((id) => playing.linkedOutputIds.includes(id))
    }

    // static isPaused(path: string) {
    //     return !!this.getPlaying(path)?.audio?.paused
    // }

    static setPitch(path: string, value: number, outputId?: string) {
        AudioAnalyser.setPitch(path, value, outputId)
    }

    // some videos don't like high playback speed (above 5.9)
    // https://issues.chromium.org/issues/40167938
    static setTempo(path: string, value: number, outputId?: string) {
        const audio = this.getAudio(path, outputId)
        if (!audio) return

        if (audio instanceof HTMLAudioElement) {
            audio.playbackRate = value
            if ("preservesPitch" in audio) audio.preservesPitch = true
        }
        AudioAnalyser.setTempo(path, 1, outputId)
    }

    static async getReplayGainMultiplier(path: string): Promise<number> {
        if (this.replayGainCache.has(path)) return this.replayGainCache.get(path) || 1
        try {
            const audioMetadata = await requestMain(Main.READ_AUDIO_METADATA, { filePath: path })
            const mult = audioMetadata?.replayGainMultiplier || 1
            this.replayGainCache.set(path, mult)
            return mult
        } catch (e) {
            console.error("Failed to read ReplayGain metadata for video", e)
            return 1
        }
    }

    // SYNC

    private static async attachToAnalyser(path: string, audio: HTMLAudioElement, outputIds: string[]) {
        if (!outputIds.length) return

        const data = this.getGlobalOptions(path)

        for (const outputId of outputIds) {
            if (AudioAnalyser.hasSource(path, outputId)) continue
            await AudioAnalyser.attach(path, audio, outputId)
            AudioAnalyser.setSourceVolume(path, audio.volume, outputId)
            AudioAnalyser.setTempo(path, 1, outputId)
            if (data.pitch !== undefined) AudioAnalyser.setPitch(path, data.pitch, outputId)
            AudioAnalyser.recorderActivate()
        }
    }

    private static syncClockTimer: NodeJS.Timeout | null = null
    private static initSyncClock() {
        if (this.syncClockTimer) clearInterval(this.syncClockTimer)
        this.syncState() // update immediately
        this.syncClockTimer = setInterval(() => this.syncState(), get(special).optimizedMode ? 500 : 100)
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
                    const softLoop = video.softLoop || 0
                    const softLoopOpacity = this.handleSoftLoop(video, video.audio, softLoop, video.loop || false)
                    const activeAudio = video.audio

                    a[id] = {
                        currentTime: Number.isFinite(activeAudio.currentTime) ? activeAudio.currentTime : 0,
                        duration: Number.isFinite(activeAudio.duration) && activeAudio.duration > 0 ? activeAudio.duration : 0,
                        paused: activeAudio.paused,
                        virtualClock: "timeTick" in activeAudio,
                        loop: video.loop || false,
                        muted: activeAudio.muted,
                        softLoop,
                        softLoopOpacity,
                        type: video.type || "background",
                        isFadingOut: this.isFadingOut.includes(video.path)
                    }
                })

                if (!video.audio.paused) isPlaying = true
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

    // SOFT LOOP

    private static handleSoftLoop(video: VideoAudioData, audio: HTMLAudioElement | VirtualAudioElement, softLoop: number, loop: boolean): number {
        if (!softLoop) return 0

        const crossfadeAudio = (video as any).crossfadeAudio as HTMLAudioElement | undefined

        if (softLoop <= 0 || !loop || audio.duration <= softLoop || audio.paused) {
            if (crossfadeAudio) {
                try {
                    crossfadeAudio.pause()
                    crossfadeAudio.src = ""
                } catch {}
                delete (video as any).crossfadeAudio
            }
            if (audio instanceof HTMLAudioElement && !this.isFadingOut.includes(video.path) && !this.isFadingIn.includes(video.path)) {
                const vol = this.getVolume(video.path) * (video.replayGainMultiplier ?? 1)
                audio.volume = Math.min(1, Math.max(0, vol))
                AudioAnalyser.setSourceVolume(video.path, Math.max(0, vol))
            }
            return 0
        }

        const fromTime = video.fromTime || 0
        const toTime = video.toTime || audio.duration
        const remaining = toTime - audio.currentTime

        if (remaining > softLoop) {
            if (crossfadeAudio) {
                try {
                    crossfadeAudio.pause()
                    crossfadeAudio.src = ""
                } catch {}
                delete (video as any).crossfadeAudio
            }
            if (audio instanceof HTMLAudioElement && !this.isFadingOut.includes(video.path) && !this.isFadingIn.includes(video.path)) {
                const vol = this.getVolume(video.path) * (video.replayGainMultiplier ?? 1)
                audio.volume = Math.min(1, Math.max(0, vol))
                AudioAnalyser.setSourceVolume(video.path, Math.max(0, vol))
            }
            return 0
        }

        if (audio instanceof HTMLAudioElement) {
            let nextAudio = crossfadeAudio
            if (!nextAudio) {
                nextAudio = new Audio(audio.src)
                nextAudio.currentTime = fromTime
                nextAudio.volume = 0
                const hasCustomBounds = fromTime > 0 || (toTime > 0 && toTime < audio.duration)
                nextAudio.loop = loop && !hasCustomBounds
                nextAudio.addEventListener("play", () => {})
                ;(video as any).crossfadeAudio = nextAudio
            }

            if (nextAudio.paused && !(nextAudio as any).isPlayPending) {
                ;(nextAudio as any).isPlayPending = true
                nextAudio
                    .play()
                    .catch(() => {})
                    .finally(() => {
                        delete (nextAudio as any).isPlayPending
                    })
            }

            const fadeProgress = (softLoop - remaining) / softLoop
            const baseVol = this.getVolume(video.path) * (video.replayGainMultiplier ?? 1)

            // Scale GainNode via AudioAnalyser to support volumes above 1.0 (e.g. 1.25 / 125%)
            const currentVol = Math.max(0, baseVol * (1 - fadeProgress))
            audio.volume = Math.min(1, Math.max(0, currentVol))
            AudioAnalyser.setSourceVolume(video.path, currentVol)

            const nextVol = Math.max(0, baseVol * fadeProgress)
            nextAudio.volume = Math.min(1, Math.max(0, nextVol))

            // Seamless swap when near loop boundary
            if (remaining <= 0.1 && !(video as any).isSwapping) {
                ;(video as any).isSwapping = true

                const oldAudio = audio
                video.audio = nextAudio
                nextAudio.volume = Math.min(1, Math.max(0, baseVol))
                if (nextAudio.paused) nextAudio.play().catch(() => {})
                ;(video as any).crossfadeAudio = oldAudio
                oldAudio.pause()
                oldAudio.currentTime = fromTime

                const linkedOutputIds = video.linkedOutputIds || []
                linkedOutputIds.forEach((outId) => {
                    AudioAnalyser.updateSource(video.path, nextAudio, outId)
                })
                AudioAnalyser.setSourceVolume(video.path, baseVol)

                setTimeout(() => delete (video as any).isSwapping, 300)
                return 0
            }
        }

        return Math.max(0, Math.min(1, (softLoop - remaining) / softLoop))
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
