import { get, Unsubscriber } from "svelte/store"
import type { TimelineAction } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeShow, outputs, playingAudio } from "../../stores"
import { runAction } from "../actions/actions"
import { getFirstActiveOutput } from "../helpers/output"
import { _show } from "../helpers/shows"
import { ShowTimeline } from "./ShowTimeline"
import { TimelineType } from "./TimelineActions"

let activePlayback: TimelinePlayback | null = null

const ONE_MINUTE = 60000
const MIN_DURATION = ONE_MINUTE * 5

export class TimelinePlayback {
    currentTime: number = 0 // ms
    private type: TimelineType
    private isPlaying: boolean = false
    private ref: { id: string; layoutId?: string }

    constructor(type: TimelineType) {
        this.type = type

        if (type === "show") this.ref = { id: get(activeShow)?.id || "", layoutId: _show().get("settings.activeLayout") }
    }

    play() {
        this.setAsPlayer()

        this.isPlaying = true
        this.startLoop()
        this.startListeners()

        this.runCallbacks(this.onPlayCallbacks)
    }

    pause() {
        if (!this.isPlaying) return

        this.isPlaying = false
        this.stopLoop()
        this.stopListeners()

        this.runCallbacks(this.onPauseCallbacks)
    }

    stop() {
        this.isPlaying = false
        this.setTime(0)
        this.stopLoop()
        activePlayback = null
        this.stopListeners()

        this.runCallbacks(this.onStopCallbacks)
    }

    setTime(time: number) {
        this.currentTime = time
        if (this.onTimeCallback) this.onTimeCallback(this.currentTime)
    }

    // ACTIONS

    private actions: TimelineAction[] = []
    setActions(actions: TimelineAction[]) {
        this.actions = actions
        this.updateDuration()
    }

    private duration: number = MIN_DURATION // s
    updateDuration() {
        // at least 5 minutes or 1 minute after last action
        const lastActionTime = this.actions.length > 0 ? Math.max(...this.actions.map((a) => a.time + (a.duration || 0) * 1000)) : 0
        const duration = Math.max(MIN_DURATION, lastActionTime + ONE_MINUTE)

        // WIP set max duration to audio length if any (and no futher actions)

        this.duration = duration
        for (const callback of this.onDurationCallbacks) callback(this.duration)
    }

    private setAsPlayer() {
        if (!activePlayback || activePlayback === this) return

        activePlayback.stop()
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
        for (const action of this.actions) {
            if (action.type === "audio") {
                this.checkAudio(action)
                continue
            }

            if (action.time >= previousTime && action.time < this.currentTime) {
                this.playAction(action)
            }
        }

        // check end
        if (this.currentTime >= this.duration) {
            this.currentTime = this.duration
            this.pause()
        }

        if (this.onTimeCallback) this.onTimeCallback(this.currentTime)
    }

    private previousSlide: { id?: string; index?: number } = {}
    private playAction(action: TimelineAction) {
        if (action.type === "action") {
            runAction({ id: action.id, ...action.data })
        } else if (action.type === "slide") {
            this.previousSlide = action.data
            ShowTimeline.playSlide(action.data)
            // } else if (this.onActionCallback) {
            //     this.onActionCallback(action)
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

    // LISTEN

    private unsubscriber: Unsubscriber | null = null
    private startListeners() {
        if (this.type === "show") {
            let firstOutputId = getFirstActiveOutput()?.id || ""
            if (!firstOutputId) return

            let skippedFirst = false
            this.unsubscriber = outputs.subscribe((a) => {
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
        if (this.unsubscriber) {
            this.unsubscriber()
            this.unsubscriber = null
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

    // private onActionCallback: ((action: TimelineAction) => void) | null = null
    // onAction(callback: (action: TimelineAction) => void) {
    //     if (this.onActionCallback) console.error("Only one action callback allowed!")
    //     this.onActionCallback = callback
    // }
}
