import { EventEmitter } from "events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// transcriber.ts imports electron for app.getPath("userData") (temp dir) - not used by the pure helpers
vi.mock("electron", () => ({
    app: { getPath: () => "/tmp/freeshow-vitest" }
}))

const spawnMock = vi.hoisted(() => vi.fn())
vi.mock("child_process", () => ({
    spawn: spawnMock
}))

import { buildWavBuffer, computeRms, dedupeOverlap, isLowConfidence, isNoiseSegment, parseWhisperJson, Transcriber } from "./transcriber"

describe("buildWavBuffer", () => {
    const samples = new Int16Array([0, 1000, -1000, 32767, -32768])
    const wav = buildWavBuffer(samples)

    it("writes a 44 byte header followed by the PCM data", () => {
        expect(wav.length).toBe(44 + samples.length * 2)
    })

    it("writes correct RIFF/WAVE chunk ids and sizes", () => {
        expect(wav.toString("ascii", 0, 4)).toBe("RIFF")
        expect(wav.readUInt32LE(4)).toBe(36 + samples.length * 2) // file size - 8
        expect(wav.toString("ascii", 8, 12)).toBe("WAVE")
        expect(wav.toString("ascii", 12, 16)).toBe("fmt ")
        expect(wav.readUInt32LE(16)).toBe(16) // fmt chunk size
        expect(wav.toString("ascii", 36, 40)).toBe("data")
        expect(wav.readUInt32LE(40)).toBe(samples.length * 2) // data chunk size
    })

    it("describes 16kHz mono 16-bit PCM", () => {
        expect(wav.readUInt16LE(20)).toBe(1) // audio format: PCM
        expect(wav.readUInt16LE(22)).toBe(1) // channels: mono
        expect(wav.readUInt32LE(24)).toBe(16000) // sample rate
        expect(wav.readUInt32LE(28)).toBe(32000) // byte rate: 16000 * 1 channel * 2 bytes
        expect(wav.readUInt16LE(32)).toBe(2) // block align
        expect(wav.readUInt16LE(34)).toBe(16) // bits per sample
    })

    it("writes the samples as Int16 LE", () => {
        expect(wav.readInt16LE(44)).toBe(0)
        expect(wav.readInt16LE(46)).toBe(1000)
        expect(wav.readInt16LE(48)).toBe(-1000)
        expect(wav.readInt16LE(50)).toBe(32767)
        expect(wav.readInt16LE(52)).toBe(-32768)
    })
})

describe("computeRms", () => {
    it("returns 0 for empty input and pure silence", () => {
        expect(computeRms(new Int16Array(0))).toBe(0)
        expect(computeRms(new Int16Array(16000))).toBe(0)
    })

    it("returns the normalized RMS for a constant amplitude signal", () => {
        const samples = new Int16Array(1000)
        for (let i = 0; i < samples.length; i++) samples[i] = i % 2 === 0 ? 16384 : -16384
        expect(computeRms(samples)).toBeCloseTo(0.5, 5)
    })

    it("stays below a silence threshold for near-silent audio but not for speech level audio", () => {
        const quiet = new Int16Array(1000).fill(20)
        const loud = new Int16Array(1000).fill(3000)
        expect(computeRms(quiet)).toBeLessThan(0.01)
        expect(computeRms(loud)).toBeGreaterThan(0.01)
    })
})

describe("dedupeOverlap", () => {
    it("keeps everything when nothing was emitted yet", () => {
        const segments = [{ text: "a", startMs: 0, endMs: 2000 }]
        expect(dedupeOverlap(segments, 0)).toEqual(segments)
    })

    it("drops segments that end before the previously emitted end", () => {
        const segments = [
            { text: "old", startMs: 6000, endMs: 6900 },
            { text: "new", startMs: 7000, endMs: 9000 }
        ]
        expect(dedupeOverlap(segments, 7000)).toEqual([{ text: "new", startMs: 7000, endMs: 9000 }])
    })

    it("trims a segment straddling the previously emitted end to start at it", () => {
        const segments = [{ text: "straddling", startMs: 6500, endMs: 8000 }]
        expect(dedupeOverlap(segments, 7000)).toEqual([{ text: "straddling", startMs: 7000, endMs: 8000 }])
    })

    it("drops a segment ending exactly at the previously emitted end", () => {
        expect(dedupeOverlap([{ text: "dup", startMs: 6000, endMs: 7000 }], 7000)).toEqual([])
    })

    it("drops the proportional share of leading words when trimming a straddling segment", () => {
        // 10 words over 5000ms, the first 2000ms were already emitted -> 4 leading words dropped
        const segments = [{ text: "one two three four five six seven eight nine ten", startMs: 5000, endMs: 10000 }]
        expect(dedupeOverlap(segments, 7000)).toEqual([{ text: "five six seven eight nine ten", startMs: 7000, endMs: 10000 }])
    })

    it("removes the re-transcribed overlap words from a whole-window server segment", () => {
        // server mode: one segment spanning the whole 7s window, the first 1s was emitted by the previous window
        const segments = [{ text: "a b c d e f g", startMs: 6000, endMs: 13000 }]
        expect(dedupeOverlap(segments, 7000)).toEqual([{ text: "b c d e f g", startMs: 7000, endMs: 13000 }])
    })

    it("drops a straddling segment entirely when all its words fall inside the overlap", () => {
        // 1 word, ~91% overlapped -> the single word is dropped and nothing remains
        expect(dedupeOverlap([{ text: "word", startMs: 6000, endMs: 7100 }], 7000)).toEqual([])
    })
})

describe("isNoiseSegment", () => {
    it("detects whisper noise annotations", () => {
        expect(isNoiseSegment("[BLANK_AUDIO]")).toBe(true)
        expect(isNoiseSegment("(music)")).toBe(true)
        expect(isNoiseSegment("[Music]")).toBe(true)
        expect(isNoiseSegment("(applause)")).toBe(true)
        expect(isNoiseSegment("*music*")).toBe(true)
        expect(isNoiseSegment(" ♪ ")).toBe(true)
        expect(isNoiseSegment("[silence] ...")).toBe(true)
        expect(isNoiseSegment("")).toBe(true)
        expect(isNoiseSegment("   ")).toBe(true)
    })

    it("keeps real speech, including speech next to an annotation", () => {
        expect(isNoiseSegment("For God so loved the world")).toBe(false)
        expect(isNoiseSegment("[Music] Turn with me to John chapter three")).toBe(false)
        expect(isNoiseSegment("Amen.")).toBe(false)
    })
})

describe("isLowConfidence", () => {
    it("drops segments whisper marks as probable non-speech or low probability", () => {
        expect(isLowConfidence({ noSpeechProb: 0.7 })).toBe(true)
        expect(isLowConfidence({ avgLogprob: -1.5 })).toBe(true)
    })

    it("keeps confident segments and tolerates missing values", () => {
        expect(isLowConfidence({ noSpeechProb: 0.2, avgLogprob: -0.3 })).toBe(false)
        expect(isLowConfidence({})).toBe(false)
    })
})

describe("parseWhisperJson", () => {
    it("parses cli -oj output (transcription array with ms offsets)", () => {
        const json = {
            transcription: [
                { text: " Turn to John three sixteen.", offsets: { from: 0, to: 2500 }, timestamps: { from: "00:00:00,000", to: "00:00:02,500" } },
                { text: " For God so loved the world.", offsets: { from: 2500, to: 6000 } }
            ]
        }
        expect(parseWhisperJson(json, 7000)).toEqual([
            { text: " Turn to John three sixteen.", startMs: 0, endMs: 2500, noSpeechProb: undefined, avgLogprob: undefined },
            { text: " For God so loved the world.", startMs: 2500, endMs: 6000, noSpeechProb: undefined, avgLogprob: undefined }
        ])
    })

    it("parses a plain server json response as one segment spanning the window", () => {
        expect(parseWhisperJson({ text: "For God so loved the world" }, 7000)).toEqual([{ text: "For God so loved the world", startMs: 0, endMs: 7000 }])
    })

    it("parses verbose segments (seconds) including confidence values", () => {
        const json = { segments: [{ text: "hello", start: 1.0, end: 2.5, no_speech_prob: 0.1, avg_logprob: -0.3 }] }
        expect(parseWhisperJson(json, 7000)).toEqual([{ text: "hello", startMs: 1000, endMs: 2500, noSpeechProb: 0.1, avgLogprob: -0.3 }])
    })

    it("returns nothing for empty or malformed responses", () => {
        expect(parseWhisperJson(null, 7000)).toEqual([])
        expect(parseWhisperJson({}, 7000)).toEqual([])
        expect(parseWhisperJson({ text: "   " }, 7000)).toEqual([])
        expect(parseWhisperJson("garbage", 7000)).toEqual([])
        expect(parseWhisperJson({ transcription: [{ noText: true }] }, 7000)).toEqual([])
    })
})

// class-level behavior (spawn is mocked - no real whisper processes)

function createFakeChild() {
    const child: any = new EventEmitter()
    child.stderr = new EventEmitter()
    child.exitCode = null
    child.signalCode = null
    child.kill = vi.fn()
    return child
}

function createTranscriber(kind: "cli" | "server", onError = vi.fn()) {
    return new Transcriber({
        binary: { kind, binaryPath: "/fake/whisper" },
        modelPath: "/fake/model.bin",
        language: "en",
        onSegment: vi.fn(),
        onError
    })
}

describe("runCliProcess timeout", () => {
    beforeEach(() => {
        spawnMock.mockReset()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("SIGTERMs then SIGKILLs a hung whisper-cli and rejects so the window counts as a failure", async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)

        const transcriber: any = createTranscriber("cli")
        const promise: Promise<void> = transcriber.runCliProcess("/tmp/in.wav", "/tmp/out")
        promise.catch(() => {}) // asserted below - avoid an unhandled rejection in between

        await vi.advanceTimersByTimeAsync(29999)
        expect(child.kill).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1) // 30s watchdog
        expect(child.kill).toHaveBeenCalledWith("SIGTERM")
        expect(child.kill).not.toHaveBeenCalledWith("SIGKILL")

        await vi.advanceTimersByTimeAsync(2000) // still alive after the term grace period
        expect(child.kill).toHaveBeenCalledWith("SIGKILL")

        child.emit("exit", null)
        await expect(promise).rejects.toThrow(/timed out/)
        expect(transcriber.cliChild).toBe(null)
    })

    it("does not time out a whisper-cli run that exits in time", async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)

        const transcriber: any = createTranscriber("cli")
        const promise: Promise<void> = transcriber.runCliProcess("/tmp/in.wav", "/tmp/out")

        await vi.advanceTimersByTimeAsync(5000)
        child.emit("exit", 0)
        await expect(promise).resolves.toBeUndefined()
        expect(child.kill).not.toHaveBeenCalled()
    })
})

describe("stop() guards", () => {
    beforeEach(() => {
        spawnMock.mockReset()
    })

    it("never spawns whisper-cli once stop() has begun", async () => {
        const transcriber: any = createTranscriber("cli")
        transcriber.stopped = true

        await expect(transcriber.runCliProcess("/tmp/in.wav", "/tmp/out")).rejects.toThrow("stopped")
        expect(spawnMock).not.toHaveBeenCalled()
    })

    it("skips a queued window entirely after stop()", async () => {
        const transcriber: any = createTranscriber("cli")
        transcriber.stopped = true

        await transcriber.runWindow({ samples: new Int16Array(16000), startSample: 0 })
        expect(spawnMock).not.toHaveBeenCalled()
        expect(transcriber.processing).toBe(false)
    })
})

describe("server respawn failure handling", () => {
    beforeEach(() => {
        spawnMock.mockReset()
    })

    it("resets the consecutive failure counter after a successful respawn", async () => {
        const onError = vi.fn()
        const transcriber: any = createTranscriber("server", onError)
        const child = createFakeChild()
        transcriber.serverChild = child
        transcriber.consecutiveFailures = 1
        transcriber.startServer = vi.fn().mockResolvedValue(undefined)

        transcriber.handleServerExit(child, 1)
        expect(transcriber.serverRespawning).toBe(true)
        await Promise.resolve()
        await Promise.resolve()

        expect(transcriber.consecutiveFailures).toBe(0)
        expect(transcriber.serverRespawning).toBe(false)
        expect(onError).not.toHaveBeenCalled()
    })

    it("does not count window failures while the server is respawning", async () => {
        const onError = vi.fn()
        const transcriber: any = createTranscriber("server", onError)
        transcriber.serverRespawning = true

        // transcribeServer throws before posting anywhere while a respawn is in progress
        await transcriber.runWindow({ samples: new Int16Array(16000).fill(3000), startSample: 0 })
        await transcriber.runWindow({ samples: new Int16Array(16000).fill(3000), startSample: 16000 })

        expect(transcriber.consecutiveFailures).toBe(0)
        expect(onError).not.toHaveBeenCalled()
    })
})
