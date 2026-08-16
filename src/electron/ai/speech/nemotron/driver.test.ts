import { afterEach, describe, expect, it, vi } from "vitest"

import { NemotronDriver } from "./driver"

const SAMPLE_RATE = 16000

// one second of non-silent Int16 LE PCM
function pcmSeconds(seconds: number): Uint8Array {
    return new Uint8Array(new Int16Array(seconds * SAMPLE_RATE).fill(1000).buffer)
}

interface FakeControls {
    detected: boolean // what the VAD reports for every chunk
    closedQueue: number // pending VAD segment closes (isEmpty/pop)
    decodeTexts: string[] // consumed per decodeBatch call; the last entry repeats when exhausted
    decodeAdvanceMs?: number // fake-timer time burned inside each decode (slow-machine simulation)
}

function makeSherpa(controls: FakeControls) {
    return {
        OnlineRecognizer: class {
            createStream() {
                return { steps: 0 }
            }
            acceptWaveform() {}
            isReady(stream: { steps: number }) {
                return stream.steps > 0
            }
            decode(stream: { steps: number }) {
                stream.steps--
            }
            getResult() {
                const text = controls.decodeTexts.length > 1 ? controls.decodeTexts.shift()! : (controls.decodeTexts[0] ?? "")
                if (controls.decodeAdvanceMs) vi.advanceTimersByTime(controls.decodeAdvanceMs)
                return { text }
            }
        },
        Vad: class {
            acceptWaveform() {}
            isDetected() {
                return controls.detected
            }
            isEmpty() {
                return controls.closedQueue <= 0
            }
            pop() {
                controls.closedQueue--
            }
        }
    }
}

// the fake recognizer's createStream is stream-shaped but decode is driven by getResult only -
// patch acceptWaveform/decode compatibility for the driver's batch loop
function makeDriver(controls: FakeControls, onSegment: (segment: { text: string }) => void) {
    const sherpa = makeSherpa(controls)
    // the driver calls stream.acceptWaveform({...}) on the object createStream returned
    sherpa.OnlineRecognizer.prototype.createStream = function () {
        return {
            steps: 1,
            acceptWaveform() {}
        }
    } as any

    return new NemotronDriver({
        paths: { encoder: "e", decoder: "d", joiner: "j", tokens: "t" } as any,
        vadModelPath: "vad",
        sherpa,
        onSegment: onSegment as any,
        onError: (message: string) => {
            throw new Error(message)
        }
    })
}

afterEach(() => {
    vi.useRealTimers()
})

describe("NemotronDriver", () => {
    it("streams agreed partial words, then the close delivers the remainder in order", async () => {
        const controls: FakeControls = { detected: true, closedQueue: 0, decodeTexts: ["hello world", "hello world again", "hello world again friends"] }
        const segments: string[] = []
        const driver = makeDriver(controls, (segment) => segments.push(segment.text))
        await driver.start()

        driver.pushAudio(pcmSeconds(2)) // first partial: no agreement yet
        driver.pushAudio(pcmSeconds(2)) // second partial: "hello world" agreed twice - emitted
        expect(segments).toEqual(["hello world"])

        controls.closedQueue = 1 // the VAD closes the utterance...
        driver.pushAudio(pcmSeconds(1)) // ...arming the deferred close
        controls.detected = false // silence follows (speech resuming would cancel the defer)
        driver.pushAudio(pcmSeconds(1)) // covers the close-defer window - finalize runs
        expect(segments).toEqual(["hello world", "again friends"])
    })

    it("forces the utterance boundary at the cap when the VAD never closes (constant program audio)", async () => {
        const controls: FakeControls = { detected: true, closedQueue: 0, decodeTexts: ["alpha beta gamma delta"] }
        const segments: string[] = []
        const driver = makeDriver(controls, (segment) => segments.push(segment.text))
        await driver.start()

        for (let second = 0; second < 20; second++) driver.pushAudio(pcmSeconds(1))

        // the text streamed out even though the VAD never produced a boundary...
        expect(segments.join(" ")).toContain("alpha beta gamma delta")
        // ...and the buffer was reset by a forced finalize instead of freezing at the cap
        expect((driver as any).utteranceSamples).toBeLessThan(17 * SAMPLE_RATE)
    })

    it("backs the partial interval off when decodes run slow instead of going quiet", async () => {
        vi.useFakeTimers()
        const controls: FakeControls = { detected: true, closedQueue: 0, decodeTexts: ["one two"], decodeAdvanceMs: 1500 }
        const driver = makeDriver(controls, () => {})
        await driver.start()

        driver.pushAudio(pcmSeconds(2)) // first partial: slow decode
        expect((driver as any).partialBackoff).toBe(2)

        driver.pushAudio(pcmSeconds(4)) // next partial (interval doubled): still slow
        expect((driver as any).partialBackoff).toBe(4)

        driver.pushAudio(pcmSeconds(8))
        expect((driver as any).partialBackoff).toBe(4) // capped
    })

    it("stop flushes the utterance still being spoken", async () => {
        const controls: FakeControls = { detected: true, closedQueue: 0, decodeTexts: ["", "the words being spoken"] }
        const segments: string[] = []
        const driver = makeDriver(controls, (segment) => segments.push(segment.text))
        await driver.start()

        driver.pushAudio(pcmSeconds(2)) // partial consumed the empty first entry - nothing emitted yet
        await driver.stop()
        expect(segments).toEqual(["the words being spoken"])
    })
})
