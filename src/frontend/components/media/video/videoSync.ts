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
interface SyncRecord {
    targetTime: number
    timestamp: number
}
const lastSyncRecords = new WeakMap<HTMLVideoElement, SyncRecord>()

export function clampPlaybackRate(rate: number): number {
    return Math.min(16, Math.max(0.1, rate || 1))
}
export function syncVideoToAudio(vid: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false, targetPlaybackRate = 1, isFadingOut = false): void {
    if (!vid || targetTime === undefined || vid.readyState < 2 || vid.seeking) return

    if (isFadingOut) {
        vid.playbackRate = clampPlaybackRate(targetPlaybackRate)
        return
    }

    const now = performance.now()
    const rate = clampPlaybackRate(targetPlaybackRate)
    const diff = vid.currentTime - targetTime // >0: video ahead, <0: video behind
    const absDiff = Math.abs(diff)

    // 1. Improved Explicit Seek Detection:
    // A jump occurs when targetTime (authoritative clock) deviates significantly from
    // expected progress based on elapsed wall-clock time since last sync, or on initial sync.
    const prevRecord = lastSyncRecords.get(vid)
    lastSyncRecords.set(vid, { targetTime, timestamp: now })

    const isFirstSync = lastSyncedTime === null || lastSyncedTime === undefined || !prevRecord

    if (isFirstSync) {
        // Set initial video position to targetTime smoothly on first mount
        lastSeekTimestamps.set(vid, now)
        if (absDiff > 0.05) vid.currentTime = targetTime
        return
    }

    let isExplicitSeek = false
    if (isSoftLoop && lastSyncedTime > targetTime + 0.1) {
        isExplicitSeek = true
    } else if (prevRecord) {
        const elapsedSec = Math.max(0, (now - prevRecord.timestamp) / 1000)
        const targetDelta = targetTime - lastSyncedTime

        if (vid.paused) {
            isExplicitSeek = Math.abs(targetDelta) > 0.5 * rate
        } else {
            const expectedAdvance = elapsedSec * rate
            const jumpAmount = targetDelta - expectedAdvance
            isExplicitSeek = targetDelta < -0.3 * rate || jumpAmount > 0.8 * rate
        }
    }

    // 2. Cooldown check: prevent hard-seek feedback loops while decoder buffers
    const lastSeek = lastSeekTimestamps.get(vid) || 0
    const inSeekCooldown = now - lastSeek < 1500 // 1.5s cooldown after a hard seek

    if (inSeekCooldown && !isExplicitSeek) {
        // While cooling down after a seek, rely exclusively on smooth playbackRate adjustment
        if (!vid.paused && absDiff > 0.03) {
            const nudgeAmount = Math.max(-0.25 * rate, Math.min(0.25 * rate, -diff * 1.5 * rate))
            vid.playbackRate = clampPlaybackRate(rate + nudgeAmount)
        }
        return
    }

    // 3. Determine threshold
    let shouldHardSeek = isExplicitSeek || (vid.paused && absDiff > 0.05) || absDiff > 0.8 * rate

    // 4. Perform Hard Seek
    if (shouldHardSeek) {
        // DEBUG
        // console.warn(`[VideoSync] HARD SEEK TRIGGERED`, {
        //     reason: isExplicitSeek ? "explicit_seek" : vid.paused ? "paused_drift" : "large_drift",
        //     vidTime: vid.currentTime.toFixed(3),
        //     targetTime: targetTime.toFixed(3),
        //     driftMs: (diff * 1000).toFixed(1),
        //     lastSyncedTime: lastSyncedTime?.toFixed(3),
        //     threshold: (isExplicitSeek ? 0.5 * rate : 0.8 * rate).toFixed(3),
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
