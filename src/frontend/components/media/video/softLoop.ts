import { shouldSyncVideoTime } from "./videoSync"

export class SoftLoopSync {
    private isHolding = false
    private holdReleaseTimeout: NodeJS.Timeout | null = null
    private lastSyncedTime: number | null = null

    get holding() {
        return this.isHolding
    }

    update(opacity: number, videoTime: number | undefined, fromTime: number, softLoopValue: number, video: HTMLVideoElement | null, softLoopVideo: HTMLVideoElement | null, paused: boolean): number {
        if (!softLoopValue) return 0

        if (opacity > 0.1) this.isHolding = true

        if (this.isHolding && opacity === 0) {
            const targetResumeTime = fromTime + softLoopValue
            const mainSeeked = videoTime !== undefined && (videoTime >= targetResumeTime - 0.5 || (videoTime > 1 && videoTime < targetResumeTime + 1))

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
                if (!this.isHolding) {
                    const duration = video?.duration || 0
                    const targetTime = duration > 0 && videoTime !== undefined ? Math.max(fromTime, fromTime + (videoTime - (duration - softLoopValue))) : fromTime

                    if (shouldSyncVideoTime(softLoopVideo, targetTime, this.lastSyncedTime)) {
                        softLoopVideo.currentTime = targetTime
                    }
                    this.lastSyncedTime = targetTime
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
                    } catch (e) {}
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
