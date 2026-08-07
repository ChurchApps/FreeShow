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
    })

    it("emits a segment when the VAD closes an utterance", () => {
        state.detected = true
        driver.pushAudio(chunk())
        state.text = "John three sixteen"
        state.closed = 1
        driver.pushAudio(chunk())

        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe("John three sixteen")
        expect(segments[0].endMs).toBeGreaterThan(segments[0].startMs)
    })

    it("uses a fresh recognizer stream for every utterance", () => {
        for (let i = 0; i < 2; i++) {
            state.detected = true
            driver.pushAudio(chunk())
            state.text = `utterance ${i}`
            state.closed = 1
            driver.pushAudio(chunk())
            state.detected = false
            driver.pushAudio(chunk())
        }

        expect(segments).toHaveLength(2)
        // one stream per utterance - reusing a stream across an endpoint makes the decoder go deaf
        expect(state.createdStreams).toBe(2)
    })

    it("keeps feeding an open utterance while the VAD confidence dips", () => {
        state.detected = true
        driver.pushAudio(chunk())
        const whileSpeaking = state.accepted.length

        // the VAD no longer flags speech, but the utterance has not closed - the word's tail is still arriving
        state.detected = false
        driver.pushAudio(chunk())
        expect(state.accepted.length).toBeGreaterThan(whileSpeaking)

        state.text = "next verse"
        state.closed = 1
        driver.pushAudio(chunk())
        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe("next verse")
    })

    it("replays pre-roll audio so the first word is not clipped", () => {
        driver.pushAudio(chunk()) // silence, buffered as pre-roll
        state.detected = true
        driver.pushAudio(chunk())

        // the opening stream receives the buffered chunk before the live one
        expect(state.accepted.length).toBeGreaterThanOrEqual(2)
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
