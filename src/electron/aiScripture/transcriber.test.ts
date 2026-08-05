import { describe, expect, it, vi } from "vitest"

// transcriber.ts imports electron for app.getPath("userData") (temp dir) - not used by the pure helpers
vi.mock("electron", () => ({
    app: { getPath: () => "/tmp/freeshow-vitest" }
}))

import { buildWavBuffer, computeRms, dedupeOverlap, isLowConfidence, isNoiseSegment, parseWhisperJson } from "./transcriber"

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
