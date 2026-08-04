import { playingVideoState } from "../../../stores"

export function videoSync(path: string, outputId: string, callback: (state: { currentTime: number; duration: number; paused: boolean; loop: boolean; muted: boolean }) => void) {
    const id = `${path}_${outputId}`

    return playingVideoState.subscribe((a) => {
        const state = a[id]
        if (!state) return

        callback(state)
    })
}
