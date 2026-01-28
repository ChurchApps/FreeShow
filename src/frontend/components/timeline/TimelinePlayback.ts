import { get, Unsubscriber } from "svelte/store"
import type { TimelineAction } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeShow, isTimelinePlaying, outputs, playingAudio, showsCache } from "../../stores"
import { runAction } from "../actions/actions"
import { clone } from "../helpers/array"
import { getFirstActiveOutput } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import { ShowTimeline } from "./ShowTimeline"
import { TimelineType } from "./TimelineActions"
import { getProjectShowDurations } from "./timeline"

let activePlayback: TimelinePlayback | null = null
export function getActiveTimelinePlayback() {
    return activePlayback
}

const ONE_MINUTE = 60000
const MIN_DURATION = ONE_MINUTE * 5

export class TimelinePlayback {
    currentTime: number = 0 // ms
    isPlaying: boolean = false
    private type: TimelineType
    private ref: { id: string; layoutId?: string }

    getId() {
        return JSON.stringify(this.ref)
    }

    constructor(type: TimelineType) {
        this.type = type

        if (type === "show") {
            this.ref = { id: get(activeShow)?.id || "", layoutId: _show().get("settings.activeLayout") }
        } else if (type === "project") {
            this.ref = { id: get(activeShow)?.id || "" }
        }

        // restore playing
        if (activePlayback && activePlayback.getId() === JSON.stringify(this.ref)) {
            return activePlayback
        }
    }

    play() {
        this.setAsPlayer()
        isTimelinePlaying.set(true)

        this.isPlaying = true
        this.startLoop()
        this.startListeners()

        this.runCallbacks(this.onPlayCallbacks)
    }

    pause() {
        if (!this.isPlaying) return
        isTimelinePlaying.set(false)

        this.isPlaying = false
        this.stopLoop()
        this.stopListeners()

        this.runCallbacks(this.onPauseCallbacks)
    }

    stop() {
        if (activePlayback === this) {
            activePlayback = null
            isTimelinePlaying.set(false)
        }

        this.isPlaying = false
        this.setTime(0)
        this.stopLoop()
        this.stopListeners()

        this.runCallbacks(this.onStopCallbacks)
    }

    close() {
        if (this.isPlaying) return
        this.stop()
    }

    setTime(time: number) {
        this.currentTime = time
        if (this.onTimeCallback) this.onTimeCallback(this.currentTime)
    }

    reset() {
        this.updateDuration()
        this.setTime(0)
        this.stop()
    }

    // ACTIONS

    private actions: TimelineAction[] = []
    setActions(actions: TimelineAction[]) {
        this.actions = actions
        this.updateDuration()
    }

    private showDurations: Record<string, number> = {}
    private duration: number = MIN_DURATION // s
    updateDuration() {
        // at least 5 minutes or 1 minute after last action
        const lastActionTime = this.actions.length > 0 ? Math.max(...this.actions.map((a) => a.time + (a.duration || 0) * 1000)) : 0
        let duration = Math.max(MIN_DURATION, lastActionTime + ONE_MINUTE)

        // WIP set max duration to audio length if any (and no futher actions)

        // get show durations
        if (this.type === "project") {
            this.showDurations = getProjectShowDurations(this.actions)
            Object.entries(this.showDurations).some(([showId, d]) => {
                const actionTime = this.actions.find((a) => a.type === "show" && a.data?.id === showId)?.time || 0
                const dMs = actionTime + d * 1000 + ONE_MINUTE
                if (dMs > duration) {
                    duration = Math.max(MIN_DURATION, dMs)
                    return true
                }
                return false
            })
        }

        this.duration = duration
        for (const callback of this.onDurationCallbacks) callback(this.duration)
    }

    private setAsPlayer() {
        if (activePlayback && activePlayback === this) return

        activePlayback?.stop()
        activePlayback = this
    }

    // LOOP

    private animationFrameId: number | null = null
    private lastTime: number = 0
    private startLoop() {
        this.lastTime = performance.now()
        this.stopLoop()
        this.next()
    }

    private next() {
        this.animationFrameId = requestAnimationFrame(() => this.loop())
    }

    private stopLoop() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
    }

    private loop() {
        if (!this.isPlaying) {
            this.stopLoop()
            return
        }

        this.tick()
        this.next()
    }

    // TICK

    private tick() {
        const now = performance.now()
        const delta = now - this.lastTime
        this.lastTime = now

        const previousTime = this.currentTime
        this.currentTime += delta

        this.hasPlayed = []

        // run actions
        this.checkActions(this.actions, previousTime, this.ref)

        // check end
        if (this.currentTime >= this.duration) {
            this.currentTime = this.duration
            this.pause()
        }

        if (this.onTimeCallback) this.onTimeCallback(this.currentTime)
    }

    private checkActions(actions: TimelineAction[], previousTime: number, ref: typeof this.ref) {
        for (const action of actions) {
            if (action.type === "audio") {
                this.checkAudio(action)
                continue
            }

            if (action.type === "show") {
                this.checkShow(action, previousTime)
                continue
            }

            if (action.time >= previousTime && action.time < this.currentTime) {
                this.playAction(action, ref)
            }
        }
    }

    private previousSlide: { id?: string; index?: number } = {}
    private playAction(action: TimelineAction, ref: typeof this.ref) {
        if (action.type === "action") {
            runAction({ id: action.id, ...action.data })
        } else if (action.type === "slide") {
            this.previousSlide = action.data
            ShowTimeline.playSlide(action.data, ref)
        } else {
            console.log("Unknown Timeline Action:", action)
        }
    }

    private hasPlayed: string[] = []
    private checkAudio(action: TimelineAction) {
        const path = action.data?.path
        if (!path || this.hasPlayed.includes(path)) return
        this.hasPlayed.push(path)

        const audioStart = action.time
        const audioEnd = action.time + (action.duration || 0) * 1000
        const shouldPlay = this.currentTime >= audioStart && this.currentTime < audioEnd
        let playing = get(playingAudio)[path]

        if (!shouldPlay) {
            if (playing) AudioPlayer.stop(path)
            return
        }

        if (!playing) {
            AudioPlayer.start(path, { name: "" }, { pauseIfPlaying: false, playMultiple: true })
            playing = get(playingAudio)[path]
        } else if (playing.paused) {
            AudioPlayer.play(path)
        }

        if (!playing?.audio) return

        // seek to correct position (with tolerance)
        const tolerance = 20 // ms
        const seekPos = (this.currentTime - audioStart) / 1000
        const currentAudioTime = playing.audio.currentTime || 0
        const diff = Math.abs(currentAudioTime - seekPos) * 1000
        if (diff > tolerance) AudioPlayer.setTime(path, seekPos)
    }

    private isLoaded: string[] = []
    private checkShow(action: TimelineAction, previousTime: number) {
        const showId = action.data?.id
        if (!showId) return
        const show = get(showsCache)[showId]
        if (!show) {
            if (this.isLoaded.includes(showId)) return
            this.isLoaded.push(showId)
            loadShows([showId])
            return
        }

        const layoutId = action.data?.layoutId || show.settings?.activeLayout || ""
        const layout = show.layouts?.[layoutId]
        if (!layout) return

        const timeline = layout.timeline

        // if show does not have any timeline actions, just start the first slide instead
        if (!timeline?.actions?.length) {
            const shouldPlay = action.time >= previousTime && action.time < this.currentTime
            if (!shouldPlay) return

            // start first slide
            const firstSlideId = layout.slides?.[0]?.id
            if (!firstSlideId) return

            ShowTimeline.playSlide({ id: firstSlideId, index: 0 }, { id: showId, layoutId })
            return
        }

        const showStart = action.time
        const duration = this.showDurations[showId] || 0
        const showEnd = action.time + duration * 1000
        const shouldPlay = this.currentTime >= showStart && this.currentTime < showEnd

        if (!shouldPlay) return

        let showTimelineActions = clone(timeline.actions)

        // update times to match new timeline position
        showTimelineActions = showTimelineActions.map((a) => ({ ...a, time: a.time + showStart }))

        const ref = { id: showId, layoutId }
        this.checkActions(showTimelineActions, previousTime, ref)
    }

    // LISTEN

    private outputsUnsubscriber: Unsubscriber | null = null
    private startListeners() {
        if (this.type === "show") {
            let firstOutputId = getFirstActiveOutput()?.id || ""
            if (!firstOutputId) return

            let skippedFirst = false
            this.outputsUnsubscriber = outputs.subscribe((a) => {
                if (!skippedFirst) {
                    skippedFirst = true
                    return
                }
                if (ShowTimeline.isRecording()) return

                let outSlide = a[firstOutputId]?.out?.slide
                if (!outSlide || outSlide.id !== this.ref?.id || outSlide.layout !== this.ref?.layoutId || outSlide.index === undefined) return

                const layoutRef = _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []
                let layoutSlide = layoutRef[outSlide.index]
                if (!layoutSlide) return
                if (this.previousSlide.id === layoutSlide.id && this.previousSlide.index === outSlide.index) return

                const slideActions = this.actions.filter((a) => a.type === "slide")

                // find next matching
                if (
                    slideActions.some((action) => {
                        if (action.time >= this.currentTime && action.data.id === layoutSlide.id && action.data.index === outSlide.index) {
                            this.setTime(action.time)
                            return true
                        }
                        return false
                    })
                )
                    return

                // find any matching
                slideActions.some((action) => {
                    if (action.data.id === layoutSlide.id && action.data.index === outSlide.index) {
                        this.setTime(action.time)
                        return true
                    }
                    return false
                })
            })
        }
    }
    private stopListeners() {
        if (this.outputsUnsubscriber) {
            this.outputsUnsubscriber()
            this.outputsUnsubscriber = null
        }
    }

    // EVENTS

    private runCallbacks(callbacks: (() => void)[]) {
        for (const callback of callbacks) callback()
    }

    private onPlayCallbacks: (() => void)[] = []
    onPlay(callback: () => void) {
        this.onPlayCallbacks.push(callback)
    }

    private onPauseCallbacks: (() => void)[] = []
    onPause(callback: () => void) {
        this.onPauseCallbacks.push(callback)
    }

    private onStopCallbacks: (() => void)[] = []
    onStop(callback: () => void) {
        this.onStopCallbacks.push(callback)
    }

    private onDurationCallbacks: ((duration: number) => void)[] = []
    onDuration(callback: (duration: number) => void) {
        this.onDurationCallbacks.push(callback)
    }

    private onTimeCallback: ((time: number) => void) | null = null
    onTime(callback: (time: number) => void) {
        if (this.onTimeCallback) console.error("Only one time callback allowed!")
        this.onTimeCallback = callback
    }
}
