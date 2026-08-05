import { playingVideoState } from "../../../stores"
import type { PlayingVideoState } from "./videoPlayer"

export function videoSync(path: string, outputId: string, callback: (state: PlayingVideoState) => void) {
    if (!path || !outputId) return null

    const id = `${path}_${outputId}`

    return playingVideoState.subscribe((a) => {
        const state = a[id]
        if (!state) return

        callback(state)
    })
}

export function shouldSyncVideoTime(video: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false): boolean {
    if (!video || targetTime === undefined || video.readyState < 2 || video.seeking) return false

    const rate = video.playbackRate || 1
    const diff = Math.abs(video.currentTime - targetTime)

    // Scale thresholds according to playback rate
    const seekThreshold = 0.3 * rate
    const driftThreshold = 0.75 * rate

    const isExplicitSeek = lastSyncedTime !== null && (Math.abs(targetTime - lastSyncedTime) > seekThreshold || (isSoftLoop ? lastSyncedTime > targetTime + 0.1 : false))

    // Explicit seek, loop-back reset, or paused frame sync or playback drift scaled by rate
    return isExplicitSeek || (video.paused && diff > 0.05) || diff > driftThreshold
}
