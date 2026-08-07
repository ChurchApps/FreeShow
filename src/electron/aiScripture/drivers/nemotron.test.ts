import { beforeEach, describe, expect, it } from "vitest"

// the native addon is not installed in CI - inject a scripted fake instead
const state = {
    detected: false,
    closed: 0,
    text: "",
    createdStreams: 0,
    accepted: [] as number[]
}

const fakeSherpa = {
    OnlineRecognizer: class {
        createStream() {
            state.createdStreams++
            return { acceptWaveform: ({ samples }: { samples: Float32Array }) => state.accepted.push(samples.length) }
        }
        isReady() {
            return false
        }
        decode() {}
        getResult() {
            return { text: state.text }
        }
    },
    Vad: class {
        acceptWaveform() {}
        isDetected() {
            return state.detected
        }
        isEmpty() {
            if (state.closed > 0) {
                state.closed--
                return false
            }
            return true
        }
        pop() {}
    }
}

import { NemotronDriver } from "./nemotron"

const PATHS = { encoder: "e", decoder: "d", joiner: "j", tokens: "t" }

/** 100ms of Int16 PCM @ 16kHz, as the renderer sends it. */
function chunk(): Uint8Array {
    return new Uint8Array(1600 * 2)
}

/** Push the post-close tail audio the driver waits for before decoding (CLOSE_DEFER_SAMPLES). */
function pushDeferTail(driver: NemotronDriver) {
    state.detected = false
    for (let i = 0; i < 6; i++) driver.pushAudio(chunk())
}

describe("NemotronDriver", () => {
    let segments: { text: string; startMs: number; endMs: number }[]
    let errors: string[]
    let driver: NemotronDriver

    beforeEach(async () => {
        state.detected = false
        state.closed = 0
        state.text = ""
        state.createdStreams = 0
        state.accepted = []

        segments = []
        errors = []
        driver = new NemotronDriver({
            sherpa: fakeSherpa,
            paths: PATHS,
            vadModelPath: "vad",
            language: "en",
            onSegment: (segment) => segments.push(segment),
            onError: (message) => errors.push(message)
        })
        await driver.start()
    })

    it("emits nothing while no speech is detected", () => {
        driver.pushAudio(chunk())
        driver.pushAudio(chunk())
        expect(segments).toEqual([])
        expect(state.createdStreams).toBe(0)
    })

    it("emits a segment once the VAD closes an utterance and the tail window has passed", () => {
        state.detected = true
        driver.pushAudio(chunk())
        state.text = "John three sixteen"
        state.closed = 1
        driver.pushAudio(chunk())

        // not decoded yet - the driver keeps capturing real tail audio first, in case the close landed mid-word
        expect(segments).toEqual([])

        pushDeferTail(driver)
        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe("John three sixteen")
        expect(segments[0].endMs).toBeGreaterThan(segments[0].startMs)
    })

    it("continues the same utterance when speech resumes inside the tail window", () => {
        state.detected = true
        driver.pushAudio(chunk())
        state.closed = 1
        driver.pushAudio(chunk())

        // the speaker picks back up before the window elapses - no cut
        state.detected = true
        driver.pushAudio(chunk())
        expect(segments).toEqual([])

        state.text = "next verse"
        state.closed = 1
        driver.pushAudio(chunk())
        pushDeferTail(driver)

        expect(segments.map((segment) => segment.text)).toEqual(["next verse"])
        expect(state.createdStreams).toBe(1)
    })

    it("decodes each utterance in ONE batch on a fresh stream", () => {
        for (let i = 0; i < 2; i++) {
            state.detected = true
            driver.pushAudio(chunk())
            state.text = `utterance ${i}`
            state.closed = 1
            driver.pushAudio(chunk())
            pushDeferTail(driver)
        }

        expect(segments.map((segment) => segment.text)).toEqual(["utterance 0", "utterance 1"])
        // one stream and one acceptWaveform per utterance - chunked feeding decodes short utterances to nothing
        expect(state.createdStreams).toBe(2)
        expect(state.accepted).toHaveLength(2)
    })

    it("includes pre-roll audio so the first word is not clipped", () => {
        driver.pushAudio(chunk()) // silence, buffered as pre-roll
        state.detected = true
        driver.pushAudio(chunk())
        state.text = "hello"
        state.closed = 1
        driver.pushAudio(chunk())
        pushDeferTail(driver)

        // the batch carries pre-roll (1600) + detected chunks (2 x 1600) + the finalize pad
        expect(state.accepted[0]).toBeGreaterThan(3 * 1600)
    })

    it("drops empty transcripts", () => {
        state.detected = true
        driver.pushAudio(chunk())
        state.text = "   "
        state.closed = 1
        driver.pushAudio(chunk())

        expect(segments).toEqual([])
    })

    it("flushes an in-progress utterance on stop", async () => {
        state.detected = true
        driver.pushAudio(chunk())
        state.text = "half spoken"
        await driver.stop()

        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe("half spoken")
    })

    it("ignores audio after stop", async () => {
        await driver.stop()
        driver.pushAudio(chunk())
        expect(segments).toEqual([])
        expect(errors).toEqual([])
    })
})
