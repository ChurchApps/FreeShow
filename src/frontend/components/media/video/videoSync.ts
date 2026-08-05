import { playingVideoState } from "../../../stores"

export function videoSync(path: string, outputId: string, callback: (state: { currentTime: number; duration: number; paused: boolean; loop: boolean; muted: boolean }) => void) {
    if (!path || !outputId) return null

    const id = `${path}_${outputId}`

    return playingVideoState.subscribe((a) => {
        const state = a[id]
        if (!state) return

        callback(state)
    })
}

export function shouldSyncVideoTime(video: HTMLVideoElement | null, targetTime: number | undefined, lastSyncedTime: number | null): boolean {
    if (!video || targetTime === undefined || video.readyState < 2 || video.seeking) return false

    const diff = Math.abs(video.currentTime - targetTime)
    const isExplicitSeek = lastSyncedTime !== null && Math.abs(targetTime - lastSyncedTime) > 0.3

    // Explicit seek or paused frame sync or major playback drift (>0.75s)
    return isExplicitSeek || (video.paused && diff > 0.05) || diff > 0.75
}
