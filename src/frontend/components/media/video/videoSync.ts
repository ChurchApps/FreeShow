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

/**
 * Sync a video element to an authoritative clock time.
 *
 * - Hard seek for: explicit timeline jumps, large drift (>0.3s), or paused frame correction.
 * - Rate nudge for: small drift (<0.3s) while playing — avoids decoder interruption/stutter.
 * - Restores normal playbackRate once drift is within 20ms.
 *
 * @param vid               The video element to sync.
 * @param targetTime        The authoritative clock time to sync to.
 * @param lastSyncedTime    The previously synced time (used to detect explicit seeks).
 * @param isSoftLoop        Whether a soft-loop crossfade is active (affects seek detection).
 * @param targetPlaybackRate The user-configured playback speed (default 1). Used to scale
 *                          thresholds and restore the rate after a hard seek.
 */
export function clampPlaybackRate(rate: number): number {
    return Math.min(16, Math.max(0.1, rate || 1))
}

export function syncVideoToAudio(vid: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false, targetPlaybackRate = 1): void {
    if (!vid || targetTime === undefined || vid.readyState < 2 || vid.seeking) return

    const rate = clampPlaybackRate(targetPlaybackRate)
    const diff = vid.currentTime - targetTime // >0: video is ahead, <0: video is behind

    // 1. Detect explicit seek: lastSyncedTime jumped unexpectedly relative to the actual video clock
    const isExplicitSeek = lastSyncedTime !== null && (Math.abs(targetTime - vid.currentTime) > 0.5 * rate || (isSoftLoop && lastSyncedTime > targetTime + 0.1))

    // 2. Perform hard seek ONLY when necessary (paused correction, large drift, or explicit user seek)
    if (isExplicitSeek || (vid.paused && Math.abs(diff) > 0.05) || Math.abs(diff) > 0.3 * rate) {
        vid.currentTime = targetTime
        vid.playbackRate = rate
        return
    }

    // 3. Rate nudge for continuous playback drift correction (<0.3s drift)
    const targetRate = !vid.paused && Math.abs(diff) > 0.02 ? rate + Math.max(-0.1 * rate, Math.min(0.1 * rate, -diff * 2 * rate)) : rate

    const safeRate = clampPlaybackRate(targetRate)

    // Minimize DOM writes
    if (Math.abs(vid.playbackRate - safeRate) > 0.005) vid.playbackRate = safeRate
}
