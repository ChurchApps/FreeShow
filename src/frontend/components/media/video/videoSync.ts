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

// Track seek latency to compensate when seeking a playing video
const pendingSeeks = new WeakMap<HTMLVideoElement, number>()
const seekLatencyEMA = new WeakMap<HTMLVideoElement, number>()
const droppedSample = new WeakMap<HTMLVideoElement, { dropped: number; at: number; struggling: boolean }>()

// whether the video dropped frames within about the last second (sync runs far more often than that, so
// comparing against the previous call would almost always see no change)
function isStruggling(vid: HTMLVideoElement, now: number): boolean {
    const dropped = vid.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0
    const sample = droppedSample.get(vid)
    if (!sample) {
        droppedSample.set(vid, { dropped, at: now, struggling: false })
        return vid.readyState < 4
    }
    if (now - sample.at >= 1000) droppedSample.set(vid, { dropped, at: now, struggling: dropped > sample.dropped })
    return (droppedSample.get(vid)?.struggling ?? false) || vid.readyState < 4
}

export function clampPlaybackRate(rate: number): number {
    return Math.min(16, Math.max(0.1, rate || 1))
}

/**
 * Syncs a video element to an authoritative clock time (audio).
 * - Hard seeks on explicit jumps, paused alignment, or major desync (>1.5s).
 * - 500ms post-seek cooldown ensures smooth playback without repeated drift seeks.
 * - Smooth rate nudge with hysteresis for small continuous drift (80ms deadband).
 */
export function syncVideoToAudio(vid: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null, isSoftLoop = false, targetPlaybackRate = 1, isFadingOut = false): void {
    if (!vid || targetTime === undefined) return
    if (vid.readyState < 2 || vid.seeking) {
        // The caller advances lastSyncedTime on every call, so the record must advance with it: left at its old
        // time, the first sync after a seek measured a second of elapsed time against a tenth of a second of
        // clock, read that as the clock jumping back, and seeked again - every seek causing the next.
        const record = lastSyncRecords.get(vid)
        if (record) lastSyncRecords.set(vid, { ...record, targetTime, timestamp: performance.now() })
        return
    }

    // a previously issued seek resolved — record its latency (slight overshoot is trimmed by the nudge)
    const pendingSince = pendingSeeks.get(vid)
    if (pendingSince !== undefined) {
        pendingSeeks.delete(vid)
        if (!vid.paused) {
            const latency = (performance.now() - pendingSince) / 1000
            const prev = seekLatencyEMA.get(vid) ?? 0
            seekLatencyEMA.set(vid, prev ? prev * 0.5 + latency * 0.5 : latency)
        }
    }

    const rate = clampPlaybackRate(targetPlaybackRate)
    if (isFadingOut) {
        if (Math.abs(vid.playbackRate - rate) > 0.001) {
            vid.playbackRate = rate
        }
        return
    }

    const now = performance.now()
    const diff = vid.currentTime - targetTime
    const absDiff = Math.abs(diff)
    const prevRecord = lastSyncRecords.get(vid)

    // Circular drift for looping media to avoid seeking across loop boundary
    const loopDuration = !isSoftLoop && vid.loop && Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0
    const wrapDiff = loopDuration ? Math.min(absDiff, loopDuration - absDiff) : absDiff
    const inWrapZone = wrapDiff < absDiff

    if (lastSyncedTime === null || lastSyncedTime === undefined || !prevRecord) {
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })
        lastSeekTimestamps.set(vid, now)
        if (wrapDiff > 0.5 && targetTime > 1.0) {
            if (!vid.paused) pendingSeeks.set(vid, now)
            vid.currentTime = targetTime
        }
        return
    }

    // 1. Explicit seek detection
    let targetDelta = targetTime - lastSyncedTime
    if (loopDuration && targetDelta < -loopDuration / 2) targetDelta += loopDuration
    const jumpAmount = targetDelta - Math.max(0, (now - prevRecord.timestamp) / 1000) * rate
    const isExplicitSeek = isSoftLoop ? lastSyncedTime > targetTime + 0.1 : vid.paused ? Math.abs(targetDelta) > 0.05 : jumpAmount > 0.5 * rate || jumpAmount < -0.3 * rate || targetDelta < -0.3

    // 2. Cooldown & Hard Seek (Explicit seeks and paused scrubbing are never blocked by cooldown)
    // A seek only helps once it has landed: on keyframe-sparse 4K that takes longer than the cooldown alone,
    // and seeking again before then restarts it, so the measured seek time is added to the wait.
    const seekCooldownMs = 500 + (seekLatencyEMA.get(vid) ?? 0) * 1000
    const inSeekCooldown = now - (lastSeekTimestamps.get(vid) || 0) < seekCooldownMs
    const shouldHardSeek = (isExplicitSeek && wrapDiff > 0.05) || (vid.paused && wrapDiff > 0.05) || (!inSeekCooldown && wrapDiff > 0.8 * rate)

    if (shouldHardSeek) {
        lastSeekTimestamps.set(vid, now)
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })

        let seekTo = targetTime
        if (!vid.paused) {
            seekTo += Math.min(seekLatencyEMA.get(vid) ?? 0, 8) * rate
            if (loopDuration) seekTo %= loopDuration
            else if (Number.isFinite(vid.duration)) seekTo = Math.min(seekTo, Math.max(targetTime, vid.duration - 0.1))
            pendingSeeks.set(vid, now)
        } else {
            seekLatencyEMA.delete(vid)
        }
        vid.currentTime = seekTo
        vid.playbackRate = rate
        return
    }

    if (inSeekCooldown) {
        lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging: false })
        if (Math.abs(vid.playbackRate - rate) > 0.01) vid.playbackRate = rate
        return
    }

    // 3. Smooth rate nudge with deadband (50ms) & hysteresis (20ms)
    // Scales dynamically: small drift gets gentle nudge, larger drift gets stronger nudge up to ±15%
    let isNudging = prevRecord.isNudging ?? false
    let targetRate = rate

    if (!vid.paused && !inWrapZone && vid.readyState >= 2) {
        if (isNudging && absDiff <= 0.02 * rate) {
            isNudging = false
        } else if (isNudging || absDiff > 0.05 * rate) {
            isNudging = true
            targetRate = rate + Math.max(-0.15 * rate, Math.min(0.15 * rate, -diff * 0.8 * rate))
        }
    } else {
        isNudging = false
    }

    lastSyncRecords.set(vid, { targetTime, timestamp: now, isNudging })

    // Every playbackRate change makes the media pipeline resynchronize - a stall, often dropped frames, and
    // so more drift to correct. The correction therefore moves in coarse steps and is only written when its
    // step changes. A video already dropping frames or short of data is never sped up: asking it to decode
    // faster deepens the deficit until it falls far enough behind to seek, and the seek starts that over.
    const step = 0.05 * rate
    let steppedRate = rate + Math.round((targetRate - rate) / step) * step
    if (steppedRate > rate && isStruggling(vid, now)) steppedRate = rate
    const safeRate = clampPlaybackRate(steppedRate)
    if (Math.abs(vid.playbackRate - safeRate) > step / 2) vid.playbackRate = safeRate
}
