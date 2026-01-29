import { get, Unsubscriber } from "svelte/store"
import type { TimelineAction } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { activeShow, isTimelinePlaying, outputs, playingAudio, showsCache, timecode } from "../../stores"
import { runAction } from "../actions/actions"
import { clone } from "../helpers/array"
import { getFirstActiveOutput } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import { ShowTimeline } from "./ShowTimeline"
import { TimelineType } from "./TimelineActions"
import { getProjectShowDurations } from "./timeline"
import { sendMain } from "../../IPC/main"
import { Main } from "../../../types/IPC/Main"
import { startListeningLTC, stopListeningLTC } from "./timecode"

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

    private listenerPaused: boolean = false
    play(isListener: boolean = false) {
        this.listenerPaused = false
        if (isListener) return

        this.setAsPlayer()
        isTimelinePlaying.set(true)
        this.initTimecode()

        this.isPlaying = true
        this.startLoop()
        this.startListeners()

        this.runCallbacks(this.onPlayCallbacks)
    }

    pause(isListener: boolean = false) {
        if (isListener) {
            this.listenerPaused = true
            this.checkAudioPause(this.actions)
            return
        }
        if (!this.isPlaying) return

        if (activePlayback === this) {
            isTimelinePlaying.set(false)
            if (this.type === "project") {
                sendMain(Main.TIMECODE_STOP)
                stopListeningLTC()
            }
        }

        this.isPlaying = false
        this.stopLoop()
        this.stopListeners()

        this.checkAudioPause(this.actions)

        this.runCallbacks(this.onPauseCallbacks)
    }

    stop() {
        if (activePlayback === this) {
            activePlayback = null
            isTimelinePlaying.set(false)
            if (this.type === "project") {
                sendMain(Main.TIMECODE_STOP)
                stopListeningLTC()
            }
        }

        this.isPlaying = false
        this.setTime(0)
        this.stopLoop()
        this.stopListeners()

        this.checkAudioStop(this.actions)

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
    private previousTickTime: number = 0
    private startLoop() {
        this.lastTime = performance.now()
        this.previousTickTime = this.currentTime
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

    private receiveTime: boolean = false
    private loop() {
        if (!this.isPlaying) {
            this.stopLoop()
            return
        }

        if (this.type === "project") this.offset = get(timecode).offset || 0
        this.receiveTime = this.type === "project" && get(timecode)?.type === "receive"

        this.tick()
        this.next()
    }

    // TICK

    private offset: number = 0
    private getTimeWithOffset(time: number) {
        return time + this.offset
    }

    private tick() {
        if (this.listenerPaused) return

        if (!this.receiveTime) {
            const now = performance.now()
            const delta = now - this.lastTime
            this.lastTime = now

            this.currentTime += delta
        }

        const previousTime = this.previousTickTime
        this.previousTickTime = this.currentTime

        this.hasPlayed = []

        // run actions
        for (const action of this.actions) {
            if (action.type === "audio") {
                this.checkAudio(action)
                continue
            }

            if (action.type === "show") {
                this.checkShow(action, previousTime)
                continue
            }

            const shouldPlay = action.time >= this.getTimeWithOffset(previousTime) && action.time < this.getTimeWithOffset(this.currentTime)
            if (shouldPlay) {
                this.playAction(action, this.ref)
            }
        }

        // check end
        if (this.currentTime >= this.duration) {
            this.currentTime = this.duration
            this.pause()
        }

        this.sendTimecode()
        if (this.onTimeCallback) this.onTimeCallback(this.currentTime)
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
        const shouldPlay = this.getTimeWithOffset(this.currentTime) >= audioStart && this.getTimeWithOffset(this.currentTime) < audioEnd
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
        const tolerance = 50 // ms // 20 is too low
        const seekPos = (this.getTimeWithOffset(this.currentTime) - audioStart) / 1000
        const currentAudioTime = playing.audio.currentTime || 0
        const diff = Math.abs(currentAudioTime - seekPos) * 1000
        if (diff > tolerance) AudioPlayer.setTime(path, seekPos)
    }

    // check if any audio is playing and pause it
    private checkAudioPause(actions: TimelineAction[]) {
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && get(playingAudio)[a.path] && !get(playingAudio)[a.path].paused) {
                    AudioPlayer.pause(a.path)
                }
            }

            if (action.type === "show") {
                const data = this.getShowLayoutFromRef(action.data)
                const showTimelineActions = data?.layout?.timeline?.actions || []
                if (showTimelineActions.length) this.checkAudioPause(showTimelineActions)
            }
        }
    }

    // check if any audio is playing and stop it
    private checkAudioStop(actions: TimelineAction[]) {
        for (const action of actions) {
            if (action.type === "audio") {
                const a = action.data
                if (a && a.path && get(playingAudio)[a.path]) {
                    AudioPlayer.stop(a.path)
                }
            }

            if (action.type === "show") {
                const data = this.getShowLayoutFromRef(action.data)
                const showTimelineActions = data?.layout?.timeline?.actions || []
                if (showTimelineActions.length) this.checkAudioStop(showTimelineActions)
            }
        }
    }

    private isLoaded: string[] = []
    private getShowLayoutFromRef(ref: { id?: string; layoutId?: string }) {
        const showId = ref.id
        if (!showId) return null

        const show = get(showsCache)[showId]
        if (!show) {
            if (this.isLoaded.includes(showId)) return null

            this.isLoaded.push(showId)
            loadShows([showId])
            return null
        }

        const layoutId = ref.layoutId || show.settings?.activeLayout || ""
        const layout = show.layouts?.[layoutId]
        if (!layout) return null

        return { layout: clone(layout), ref: { id: showId, layoutId } }
    }

    private checkShow(action: TimelineAction, previousTime: number) {
        const data = this.getShowLayoutFromRef(action.data)
        if (!data?.layout) return

        const timeline = data.layout.timeline

        // if show does not have any timeline actions, just start the first slide instead
        if (!timeline?.actions?.length) {
            const shouldPlay = action.time >= this.getTimeWithOffset(previousTime) && action.time < this.getTimeWithOffset(this.currentTime)
            if (!shouldPlay) return

            // start first slide
            const firstSlideId = data.layout.slides?.[0]?.id
            if (!firstSlideId) return

            ShowTimeline.playSlide({ id: firstSlideId, index: 0 }, data.ref)
            return
        }

        const showStart = action.time

        // update times to match new timeline position
        const showTimelineActions = timeline.actions.map((a) => ({ ...a, time: a.time + showStart }))

        for (const action of showTimelineActions) {
            if (action.type === "audio") {
                this.checkAudio(action)
                continue
            }

            const shouldPlay = action.time >= this.getTimeWithOffset(previousTime) && action.time < this.getTimeWithOffset(this.currentTime)
            if (shouldPlay) {
                this.playAction(action, data.ref)
            }
        }
    }

    // TIMECODE

    private initTimecode() {
        if (this.type !== "project") return

        const type = get(timecode).type || "send"
        const mode = get(timecode).mode || "LTC"
        let shouldSend = true
        if (type === "send" && mode === "LTC" && !get(timecode).audioOutput) shouldSend = false
        else if (type === "receive" && mode === "LTC" && !get(timecode).audioInput) shouldSend = false
        else if (type === "send" && mode === "MTC" && !get(timecode).midiOutput) shouldSend = false
        else if (type === "receive" && mode === "MTC" && !get(timecode).midiInput) shouldSend = false

        const framerate = get(timecode).framerate || 25
        const data = { midiInput: get(timecode).midiInput || "", midiOutput: get(timecode).midiOutput || "" }
        if (shouldSend) sendMain(Main.TIMECODE_START, { type, mode, framerate, data })

        if (type === "receive" && mode === "LTC") {
            this.setTime(0)
            startListeningLTC()
        }
    }

    private lastSentFrame: number = -1
    private sendTimecode() {
        if (this.type !== "project") return

        const type = get(timecode).type || "send"
        const mode = get(timecode).mode || "LTC"
        if (type === "send" && mode === "LTC" && !get(timecode).audioOutput) return
        if (type === "send" && mode === "MTC" && !get(timecode).midiOutput) return

        // limit to framerate
        const framerate = get(timecode).framerate || 25
        const frameDuration = 1000 / framerate
        const currentFrame = Math.floor(this.currentTime / frameDuration)

        if (currentFrame <= this.lastSentFrame) return
        this.lastSentFrame = currentFrame

        sendMain(Main.TIMECODE_VALUE, this.currentTime)
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
