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

interface SyncRecord {
    targetTime: number
    timestamp: number
    isNudging?: boolean
}

const lastSeekTimestamps = new WeakMap<HTMLVideoElement, number>()
const lastSyncRecords = new WeakMap<HTMLVideoElement, SyncRecord>()

// Seek latency compensation: a 4K hard seek can take seconds while the clock keeps running, so
// seeking to where the clock WAS re-creates the drift forever. Track each element's seek latency
// (EMA) and aim ahead by that much so a single seek lands on the moving target.
const pendingSeeks = new WeakMap<HTMLVideoElement, number>()
const seekLatencyEMA = new WeakMap<HTMLVideoElement, number>()

export function clampPlaybackRate(rate: number): number {
    return Math.min(16, Math.max(0.1, rate || 1))
}

/**
 * Syncs a video element to an authoritative clock time (audio).
 * - Hard seeks on explicit jumps, paused alignment, or major desync (>1.5s).
 * - 500ms post-seek cooldown ensures smooth playback without re-seeking.
 * - Smooth rate nudge with hysteresis for small continuous drift (80ms deadband).
 */
export function syncVideoToAudio(vid: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false, targetPlaybackRate = 1, isFadingOut = false, isVirtualClock = false): void {
    if (!vid || targetTime === undefined || vid.readyState < 2 || vid.seeking) return

    // a previously issued seek resolved — record its latency (slight overshoot is trimmed by the nudge)
    const pendingSince = pendingSeeks.get(vid)
    if (pendingSince !== undefined) {
        pendingSeeks.delete(vid)
        const latency = (performance.now() - pendingSince) / 1000
        const prev = seekLatencyEMA.get(vid) ?? 0
        seekLatencyEMA.set(vid, prev ? prev * 0.5 + latency * 0.5 : latency)
    }

    const rate = clampPlaybackRate(targetPlaybackRate)
    if (isFadingOut) {
        vid.playbackRate = rate
        return
    }

    const now = performance.now()
    const diff = vid.currentTime - targetTime
    const absDiff = Math.abs(diff)
    const prevRecord = lastSyncRecords.get(vid)

    // Loop-wrap tolerance: when this element loops NATIVELY (mirror of a looping output; soft loop excluded —
    // it cross-fade seeks instead of wrapping), a wrap is not real drift: the authoritative clock restarting
    // while the mirror is still near the end (or vice versa) makes the linear diff look huge for an instant.
    // Measure drift on the circular timeline (min of |a-b| and duration-|a-b|) so we let the native loop wrap
    // on its own instead of hard-seeking across the loop point (which stuttered previews at every loop).
    const loopDuration = !isSoftLoop && vid.loop && Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0
    const wrapDiff = loopDuration ? Math.min(absDiff, loopDuration - absDiff) : absDiff
    const inWrapZone = wrapDiff < absDiff

    if (lastSyncedTime === null || lastSyncedTime === undefined || !prevRecord) {
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })
        lastSeekTimestamps.set(vid, now)
        if (wrapDiff > 0.05) {
            pendingSeeks.set(vid, now)
            vid.currentTime = targetTime
        }
        return
    }

    // 1. Explicit seek detection — wrap-aware: a backward jump of more than half the loop is the
    // clock wrapping, not a user seek (treating it as one hard-seeked every synced element at once,
    // a self-sustaining seek storm on 4K content).
    let targetDelta = targetTime - lastSyncedTime
    if (loopDuration && targetDelta < -loopDuration / 2) targetDelta += loopDuration
    const jumpAmount = targetDelta - Math.max(0, (now - prevRecord.timestamp) / 1000) * rate
    const isExplicitSeek = isSoftLoop ? lastSyncedTime > targetTime + 0.1 : vid.paused ? Math.abs(targetDelta) > 0.05 : jumpAmount > 0.5 * rate || jumpAmount < -0.3 * rate || targetDelta < -0.3

    // 2. Cooldown & Hard Seek (drift measured circularly so a native loop wrap never triggers a seek).
    // Looping content on the virtual clock (no audio to lip-sync) tolerates more drift and recovers by
    // rate nudge instead — a mid-stream 4K seek can cost a multi-second catch-up decode.
    const driftSeekThreshold = isVirtualClock && loopDuration ? 5 : 1.5
    const inSeekCooldown = now - (lastSeekTimestamps.get(vid) || 0) < 500
    const shouldHardSeek = (isExplicitSeek && wrapDiff > 0.05) || (vid.paused && wrapDiff > 0.05) || (!inSeekCooldown && wrapDiff > driftSeekThreshold * rate)

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
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })

        // aim ahead by the measured seek latency (playing only — paused wants the exact frame)
        let seekTo = targetTime
        if (!vid.paused) {
            seekTo += Math.min(seekLatencyEMA.get(vid) ?? 0, 8) * rate
            if (loopDuration) seekTo %= loopDuration
            else if (Number.isFinite(vid.duration)) seekTo = Math.min(seekTo, Math.max(targetTime, vid.duration - 0.1))
        }
        pendingSeeks.set(vid, now)
        vid.currentTime = seekTo
        vid.playbackRate = rate
        return
    }

    if (inSeekCooldown) {
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })
        if (Math.abs(vid.playbackRate - rate) > 0.01) vid.playbackRate = rate
        return
    }

    // 3. Smooth rate nudge with deadband (80ms) & hysteresis (30ms)
    let isNudging = prevRecord.isNudging ?? false
    let targetRate = rate

    if (!vid.paused && !inWrapZone) {
        // (skipped inside the wrap zone: the nudge direction from the linear diff is inverted across a
        // loop wrap — hold the plain rate for the instant until both sides of the loop have wrapped)
        if (isNudging && absDiff <= 0.03 * rate) {
            isNudging = false
        } else if (isNudging || absDiff > 0.08 * rate) {
            isNudging = true
            targetRate = rate + Math.max(-0.06 * rate, Math.min(0.06 * rate, -diff * 0.4 * rate))
        }
    } else {
        isNudging = false
    }

    lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging })

    const safeRate = clampPlaybackRate(targetRate)
    if (Math.abs(vid.playbackRate - safeRate) > 0.008) vid.playbackRate = safeRate
}
