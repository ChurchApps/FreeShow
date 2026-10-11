import { afterEach, describe, expect, it, vi } from "vitest"
import { syncVideoToAudio } from "./videoSync"

// a video element whose seeks take `seekMs` to complete (e.g. a stage display remounting a large video)
function fakeVideo(seekMs: number) {
    let time = 0
    let seekDoneAt = 0
    const vid = {
        readyState: 4,
        paused: false,
        loop: false,
        duration: 600,
        playbackRate: 1,
        seeks: 0,
        get seeking() {
            return performance.now() < seekDoneAt
        },
        get currentTime() {
            return time
        },
        set currentTime(value: number) {
            time = value
            seekDoneAt = performance.now() + seekMs
            vid.seeks++
        },
        advance(ms: number) {
            if (!vid.seeking) time += (ms / 1000) * vid.playbackRate
        }
    }
    return vid
}

afterEach(() => vi.restoreAllMocks())

describe("syncVideoToAudio", () => {
    it("catches up a freshly mounted video without seeking in a loop when seeks are slow", () => {
        let now = 1000
        vi.spyOn(performance, "now").mockImplementation(() => now)

        const vid = fakeVideo(600)
        let master = 30 // the main output is already 30s into the video
        let lastSyncedTime: number | null = null

        for (let tick = 0; tick < 100; tick++) {
            syncVideoToAudio(vid as any, master, lastSyncedTime)
            lastSyncedTime = master

            now += 100
            master += 0.1
            vid.advance(100)
        }

        expect(vid.seeks).toBeLessThanOrEqual(3)
        expect(Math.abs(vid.currentTime - master)).toBeLessThan(0.1)
    })
})
