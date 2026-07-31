import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { requestMain } from "../../IPC/main"
import { playingVideos, videosData, videosTime } from "../../stores"
import { send } from "../../utils/request"
import { videoExtensions } from "../../values/extensions"
import { encodeFilePath, getExtension } from "../helpers/media"

export interface VideoControllerOptions {
    startAt?: number
    loop?: boolean
    muted?: boolean
    speed?: number
}

/**
 * VideoController manages audio playback and timing for a single output's video.
 *
 * A hidden <audio> element is the single source of truth for audio and time.
 * All visible <video> elements (output window, preview) are always muted and sync
 * their currentTime from the `videosTime` store which this controller publishes to.
 *
 * One instance exists per outputId, managed via the static get/getOrCreate/destroy API.
 * Instances are created in output.ts (changeOutputBackground) and destroyed in clear.ts.
 */
export class VideoController {
    private static instances = new Map<string, VideoController>()

    static get(outputId: string): VideoController | undefined {
        return this.instances.get(outputId)
    }

    static getOrCreate(outputId: string): VideoController {
        if (!this.instances.has(outputId)) {
            this.instances.set(outputId, new VideoController(outputId))
        }
        return this.instances.get(outputId)!
    }

    static destroy(outputId: string) {
        this.instances.get(outputId)?.cleanup()
        this.instances.delete(outputId)
    }

    /** Resync all active controllers to the output window (e.g. after output restart). */
    static resyncAll() {
        this.instances.forEach((ctrl) => ctrl.resync())
    }

    // ─────────────────────────────────────────────────

    readonly outputId: string
    private _path = ""
    private _duration = 0
    private _loop = false

    private audioEl: HTMLAudioElement
    private rafId: number | null = null
    private driftSyncInterval: ReturnType<typeof setInterval> | null = null
    private fadeInterval: ReturnType<typeof setInterval> | null = null
    private _fadeVolume = 1
    private _computedVolume = 1
    private _isMuted = false

    constructor(outputId: string) {
        this.outputId = outputId

        this.audioEl = document.createElement("audio")
        this.audioEl.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px;"
        document.body.appendChild(this.audioEl)

        this.audioEl.addEventListener("loadedmetadata", () => {
            this._duration = this.audioEl.duration
            videosData.update((a) => ({
                ...a,
                [this.outputId]: { ...a[this.outputId], duration: this._duration }
            }))
        })

        this.audioEl.addEventListener("ended", () => {
            if (!this._loop) {
                videosData.update((a) => ({
                    ...a,
                    [this.outputId]: { ...a[this.outputId], paused: true }
                }))
            }
        })

        this.startRaf()
    }

    // ─── Public API ───────────────────────────────────

    get currentPath(): string {
        return this._path
    }

    /** Load a new video path and start playing. Called by output.ts on background change. */
    async load(path: string, opts: VideoControllerOptions = {}) {
        const isNewPath = path !== this._path

        // Detach old source from audio graph before loading new path
        if (isNewPath && this._path) {
            AudioAnalyser.detach(this._path, this.outputId)
        }

        this._path = path
        this._loop = opts.loop ?? false
        this._fadeVolume = 1

        this.audioEl.loop = this._loop
        this.audioEl.playbackRate = opts.speed ?? 1
        this.audioEl.src = encodeFilePath(path)

        if (opts.startAt) {
            this.audioEl.addEventListener(
                "canplay",
                () => {
                    if (Math.abs(this.audioEl.currentTime - (opts.startAt ?? 0)) > 0.1) {
                        this.audioEl.currentTime = opts.startAt!
                    }
                },
                { once: true }
            )
        }

        this.audioEl.play().catch(() => {})

        // Fetch and apply ReplayGain before audio starts at full volume
        this._computedVolume = 1
        this._isMuted = opts.muted ?? false
        this.audioEl.muted = this._isMuted
        this.applyVolume()

        const replayGain = await this.fetchReplayGain(path)
        if (replayGain !== 1) {
            this._computedVolume = Math.min(this._computedVolume * replayGain, 1)
            this.applyVolume()
        }

        this.attachToAnalyser(path)
        this.publishState()

        // Send initial DATA to output window after it has had time to mount its receiver
        setTimeout(() => {
            this.sendDataToOutput()
            if (opts.startAt) send(OUTPUT, ["TIME"], { [this.outputId]: opts.startAt })
        }, 600)
    }

    play() {
        this.audioEl.play().catch(() => {})
        this.publishState()
        this.sendDataToOutput()
    }

    pause() {
        this.audioEl.pause()
        this.publishState()
        this.sendDataToOutput()
    }

    seek(time: number) {
        this.audioEl.currentTime = time
        videosTime.update((a) => ({ ...a, [this.outputId]: time }))
        send(OUTPUT, ["TIME"], { [this.outputId]: time })
    }

    setLoop(loop: boolean) {
        this._loop = loop
        this.audioEl.loop = loop
        this.publishState()
        this.sendDataToOutput()
    }

    /**
     * Set the computed volume. Called by BackgroundMedia whenever the effective
     * volume changes (accounts for channel mute, bus volume, media volume, ReplayGain).
     */
    setComputedVolume(volume: number, isMuted: boolean) {
        this._computedVolume = volume
        this._isMuted = isMuted
        this.applyVolume()
        if (this._path) AudioAnalyser.setSourceVolume(this._path, this.audioEl.volume, this.outputId)
    }

    setPitch(pitch: number) {
        if (this._path) AudioAnalyser.setPitch(this._path, pitch, this.outputId)
    }

    setSpeed(speed: number) {
        this.audioEl.playbackRate = speed
    }

    /**
     * Fade audio volume out over the given transition duration (ms).
     * Used when the visual output transition begins.
     */
    fadeOut(transitionDurationMs: number) {
        if (!transitionDurationMs || this._isMuted || this.fadeInterval) return
        const steps = 40
        const stepMs = transitionDurationMs / steps
        const stepSize = 1 / steps

        this.fadeInterval = setInterval(() => {
            this._fadeVolume = Math.max(0, this._fadeVolume - stepSize)
            this.applyVolume()
            if (this._fadeVolume <= 0) {
                clearInterval(this.fadeInterval!)
                this.fadeInterval = null
            }
        }, stepMs)
    }

    /** Re-send current state to the output window — used after output window restart. */
    resync() {
        this.sendDataToOutput()
        if (!this.audioEl.paused && this.audioEl.src) {
            send(OUTPUT, ["TIME"], { [this.outputId]: this.audioEl.currentTime })
        }
    }

    // ─── Private ─────────────────────────────────────

    private applyVolume() {
        const effective = this._isMuted ? 0 : Math.min(1, Math.max(0, this._computedVolume * this._fadeVolume))
        this.audioEl.volume = effective
        this.audioEl.muted = this._isMuted
    }

    private attachToAnalyser(path: string) {
        if (AudioAnalyser.hasSource(path, this.outputId)) return

        playingVideos.update((list) => {
            const idx = list.findIndex((item) => item.outputId === this.outputId)
            const entry = { id: path, outputId: this.outputId, video: this.audioEl as any }
            if (idx > -1) list[idx] = entry
            else list.push(entry)
            return list
        })

        AudioAnalyser.attach(path, this.audioEl, this.outputId)
        AudioAnalyser.recorderActivate()
        AudioAnalyser.setTempo(path, 1, this.outputId)
    }

    private startRaf() {
        const loop = () => {
            if (!this.audioEl.paused && this.audioEl.src) {
                videosTime.update((a) => ({ ...a, [this.outputId]: this.audioEl.currentTime }))
            }
            this.rafId = requestAnimationFrame(loop)
        }
        this.rafId = requestAnimationFrame(loop)

        // Periodic drift correction so the output window visual video stays in sync (every 5 s)
        this.driftSyncInterval = setInterval(() => {
            if (!this.audioEl.paused && this.audioEl.src) {
                send(OUTPUT, ["TIME"], { [this.outputId]: this.audioEl.currentTime })
            }
        }, 5000)
    }

    private publishState() {
        videosData.update((a) => ({
            ...a,
            [this.outputId]: {
                ...a[this.outputId],
                duration: this._duration || a[this.outputId]?.duration || 0,
                paused: this.audioEl.paused,
                muted: this._isMuted,
                loop: this._loop
            }
        }))
    }

    private sendDataToOutput() {
        send(OUTPUT, ["DATA"], {
            [this.outputId]: {
                duration: this._duration,
                paused: this.audioEl.paused,
                muted: this._isMuted,
                loop: this._loop
            }
        })
    }

    private async fetchReplayGain(filePath: string): Promise<number> {
        if (!filePath || /^https?:\/\//i.test(filePath)) return 1
        if (!videoExtensions.includes(getExtension(filePath))) return 1
        try {
            const metadata = await requestMain(Main.READ_AUDIO_METADATA, { filePath })
            return metadata?.replayGainMultiplier ?? 1
        } catch {
            return 1
        }
    }

    cleanup() {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId)
        if (this.driftSyncInterval !== null) clearInterval(this.driftSyncInterval)
        if (this.fadeInterval !== null) clearInterval(this.fadeInterval)

        if (this._path) {
            AudioAnalyser.detach(this._path, this.outputId)
        }

        playingVideos.update((list) => {
            const idx = list.findIndex((item) => item.outputId === this.outputId)
            if (idx > -1) list.splice(idx, 1)
            return list
        })

        try {
            this.audioEl.pause()
            this.audioEl.src = ""
            this.audioEl.load()
            if (this.audioEl.parentNode) document.body.removeChild(this.audioEl)
        } catch {}
    }
}
