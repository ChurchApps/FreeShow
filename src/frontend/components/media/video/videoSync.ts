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
const lastSeekTimestamps = new WeakMap<HTMLVideoElement, number>()
export function clampPlaybackRate(rate: number): number {
    return Math.min(16, Math.max(0.1, rate || 1))
}
export function syncVideoToAudio(vid: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false, targetPlaybackRate = 1): void {
    if (!vid || targetTime === undefined || vid.readyState < 2 || vid.seeking) return

    const now = performance.now()
    const rate = clampPlaybackRate(targetPlaybackRate)
    const diff = vid.currentTime - targetTime // >0: video ahead, <0: video behind
    const absDiff = Math.abs(diff)

    // 1. Improved Explicit Seek Detection:
    // A jump occurs when targetTime deviates significantly from EITHER:
    // a) where the audio was on the last tick (lastSyncedTime)
    // b) where the video element currently is (vid.currentTime)
    const isFirstSync = lastSyncedTime === null || lastSyncedTime === undefined

    const targetVsLastSynced = lastSyncedTime !== null && lastSyncedTime !== undefined ? Math.abs(targetTime - lastSyncedTime) : 0

    const isExplicitSeek =
        isFirstSync ||
        absDiff > 0.5 * rate || // Directly checks if vid.currentTime is far from targetTime after seeking
        targetVsLastSynced > 0.3 * rate ||
        (isSoftLoop && lastSyncedTime !== null && lastSyncedTime > targetTime + 0.1)

    // 2. Cooldown check: prevent hard-seek feedback loops while decoder buffers
    const lastSeek = lastSeekTimestamps.get(vid) || 0
    const inSeekCooldown = now - lastSeek < 1000 // Extended window for slower hardware decoders

    if (inSeekCooldown && !isExplicitSeek) {
        // While cooling down after a seek, rely exclusively on smooth playbackRate adjustment
        if (!vid.paused && absDiff > 0.03) {
            const nudgeAmount = Math.max(-0.2 * rate, Math.min(0.2 * rate, -diff * 1.5 * rate))
            vid.playbackRate = clampPlaybackRate(rate + nudgeAmount)
        }
        return
    }

    // 3. Determine threshold
    const hardSeekThreshold = isExplicitSeek ? 0.8 * rate : 0.35 * rate

    // 4. Perform Hard Seek
    if (isExplicitSeek || (vid.paused && absDiff > 0.05) || absDiff > hardSeekThreshold) {
        // DEBUG
        // console.warn(`[VideoSync] HARD SEEK TRIGGERED`, {
        //     reason: isExplicitSeek ? (isFirstSync ? "initial_mount" : "explicit_seek") : vid.paused ? "paused_drift" : "large_drift",
        //     vidTime: vid.currentTime.toFixed(3),
        //     targetTime: targetTime.toFixed(3),
        //     driftMs: (diff * 1000).toFixed(1),
        //     lastSyncedTime: lastSyncedTime?.toFixed(3),
        //     threshold: hardSeekThreshold.toFixed(3),
        //     playbackRate: rate
        // })

        lastSeekTimestamps.set(vid, now)
        vid.currentTime = targetTime
        vid.playbackRate = rate
        return
    }

    // 5. Rate Nudge for Continuous Small Drift (< 0.35s)
    let targetRate = rate
    if (!vid.paused && absDiff > 0.02) {
        const nudgeAmount = Math.max(-0.1 * rate, Math.min(0.1 * rate, -diff * 1.2 * rate))
        targetRate = rate + nudgeAmount
    }

    const safeRate = clampPlaybackRate(targetRate)
    if (Math.abs(vid.playbackRate - safeRate) > 0.005) {
        vid.playbackRate = safeRate
    }
}
