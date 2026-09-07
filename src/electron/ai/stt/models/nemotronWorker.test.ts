import { describe, expect, it, vi } from "vitest"
import type { TranscriberSegment } from "../sttHelper"
import { NemotronDriver } from "./nemotronWorker"

const SAMPLE_RATE = 16000
const PRIMING_MS = 1300
const CHUNK_MS = 1120
const pcm = (ms: number) => new Uint8Array(new Int16Array(Math.round((ms / 1000) * SAMPLE_RATE)).fill(1000).buffer)

// a recognizer whose hypothesis is scripted, so a token growing in place can be reproduced exactly
function fakeSherpa(steps: string[]) {
    const stream = {
        buffered: 0,
        consumed: 0,
        text: "",
        blanks: 0,
        setOption() {},
        acceptWaveform(input: { samples: Float32Array }) {
            this.buffered += (input.samples.length / SAMPLE_RATE) * 1000
        }
    }
    let at = 0
    return {
        OnlineRecognizer: class {
            createStream() {
                return stream
            }
            isReady() {
                return stream.buffered - stream.consumed >= (stream.consumed === 0 ? PRIMING_MS : CHUNK_MS)
            }
            decode() {
                stream.consumed += stream.consumed === 0 ? PRIMING_MS : CHUNK_MS
                const before = stream.text
                if (at < steps.length) stream.text = steps[at++]
                stream.blanks = stream.text === before ? stream.blanks + 14 : 2
            }
            getResult() {
                return { text: stream.text, num_trailing_blanks: stream.blanks }
            }
            reset() {
                stream.text = ""
                stream.blanks = 0
            }
        },
        Vad: class {
            acceptWaveform() {}
            isDetected() {
                return true
            }
            isEmpty() {
                return true
            }
            pop() {}
        }
    }
}

describe("a token that grows in place", () => {
    it("is never committed half-built", async () => {
        // seen live as "[MUSIC" then "]", and "chapter" truncated to "cha"
        const segments: TranscriberSegment[] = []
        const driver = new NemotronDriver({ modelDir: "m", sherpa: fakeSherpa(["[MUS", "[MUSIC", "[MUSIC]", "[MUSIC] and"]), onSegment: (s) => segments.push(s), onInterim: () => {}, onError: vi.fn() })

        await driver.start()
        for (let sent = 0; sent < PRIMING_MS + CHUNK_MS * 7; sent += 100) driver.pushAudio(pcm(100))
        await driver.stop()

        const words = segments.map((s) => s.text).join(" ")
        expect(words).toContain("[MUSIC]")
        expect(words).not.toContain("[MUS ")
    })
})

describe("a token added after the word settled", () => {
    it("is flagged so the transcript glues it on", async () => {
        // the pause that settles "come" is also what makes the model put a comma after it
        const segments: TranscriberSegment[] = []
        const driver = new NemotronDriver({ modelDir: "m", sherpa: fakeSherpa(["come", "come", "come, just"]), onSegment: (s) => segments.push(s), onInterim: () => {}, onError: vi.fn() })

        await driver.start()
        for (let sent = 0; sent < PRIMING_MS + CHUNK_MS * 4; sent += 100) driver.pushAudio(pcm(100))
        await driver.stop()

        const texts = segments.filter((s) => s.text).map((s) => (s.glue ? "+" : "") + s.text)
        expect(texts).toEqual(["come", "+,", "just"])
    })
})
