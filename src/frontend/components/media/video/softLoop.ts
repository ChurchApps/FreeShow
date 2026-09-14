import { clampPlaybackRate, syncVideoToAudio } from "./videoSync"

export class SoftLoopSync {
    private isHolding = false
    private holdReleaseTimeout: NodeJS.Timeout | null = null
    private lastSyncedTime: number | null = null
    private _lastAudioTime: number | undefined = undefined
    private _lastAudioTs = 0

    get holding() {
        return this.isHolding
    }

    update(opacity: number, videoTime: number | undefined, fromTime: number, softLoopValue: number, video: HTMLVideoElement | null, softLoopVideo: HTMLVideoElement | null, paused: boolean, toTime: number = 0, audioTime?: number): number {
        if (!softLoopValue) return 0

        if (opacity > 0.1 && !this.isHolding) {
            this.isHolding = true
        }

        const loopWindowEnd = toTime > 0 ? toTime - softLoopValue : fromTime + softLoopValue + 2
        const audioInWindow = audioTime !== undefined && audioTime > fromTime + 0.5 && audioTime < loopWindowEnd
        const videoInWindow = (videoTime ?? 0) > fromTime + 0.5 && (videoTime ?? 0) < loopWindowEnd

        if (this.isHolding && opacity === 0) {
            const mainSeeked = videoTime !== undefined && !video?.seeking && (audioInWindow || videoInWindow)

            if (mainSeeked && this.holdReleaseTimeout) {
                clearTimeout(this.holdReleaseTimeout)
                this.holdReleaseTimeout = null
                this.isHolding = false
            } else if (!this.holdReleaseTimeout) {
                this.holdReleaseTimeout = setTimeout(() => {
                    this.isHolding = false
                    this.holdReleaseTimeout = null
                }, 1500)
            }
        }

        const effectiveOpacity = opacity > 0 ? opacity : this.isHolding ? 1 : 0

        if (softLoopVideo) {
            if (effectiveOpacity > 0) {
                if (opacity > 0) {
                    const videoDuration = video?.duration || 0
                    const endTime = toTime > 0 && toTime < videoDuration ? toTime : videoDuration

                    if (this.lastSyncedTime === null || audioTime !== this._lastAudioTime) {
                        if (audioTime !== undefined) {
                            this._lastAudioTime = audioTime
                            this._lastAudioTs = performance.now()
                        }
                    }

                    const elapsedSinceAudio = (performance.now() - this._lastAudioTs) / 1000
                    const baseTime = this._lastAudioTime !== undefined && endTime > 0 ? this._lastAudioTime + elapsedSinceAudio : (videoTime ?? 0)
                    const crossfadeAudioTime = endTime > 0 ? fromTime + (baseTime - (endTime - softLoopValue)) : fromTime
                    const targetTime = Math.max(fromTime, Math.min(fromTime + softLoopValue, crossfadeAudioTime))

                    syncVideoToAudio(softLoopVideo, targetTime, this.lastSyncedTime, false, 1)
                    this.lastSyncedTime = targetTime
                } else if (videoTime !== undefined && (videoInWindow || audioInWindow)) {
                    const snapTarget = audioTime !== undefined && audioTime > fromTime && audioTime < loopWindowEnd ? audioTime : videoTime
                    if (Math.abs(softLoopVideo.currentTime - snapTarget) > 0.033) {
                        try {
                            softLoopVideo.currentTime = snapTarget
                        } catch {}
                    }
                    const safeRate = clampPlaybackRate(video?.seeking ? 0.2 : 1)
                    if (Math.abs((softLoopVideo.playbackRate || 1) - safeRate) > 0.001) {
                        softLoopVideo.playbackRate = safeRate
                    }
                    this.lastSyncedTime = snapTarget
                }

                if (softLoopVideo.paused && !paused && !(softLoopVideo as any).isPlayPending) {
                    ;(softLoopVideo as any).isPlayPending = true
                    softLoopVideo
                        .play()
                        .catch(() => {})
                        .finally(() => {
                            delete (softLoopVideo as any).isPlayPending
                        })
                }
            } else {
                if (!softLoopVideo.paused && !(softLoopVideo as any).isPlayPending) {
                    try {
                        softLoopVideo.pause()
                    } catch {}
                }
                this.lastSyncedTime = null
            }
        }

        return effectiveOpacity
    }

    destroy() {
        if (this.holdReleaseTimeout) {
            clearTimeout(this.holdReleaseTimeout)
            this.holdReleaseTimeout = null
        }
    }
}
