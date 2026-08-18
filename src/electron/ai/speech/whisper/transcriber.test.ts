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

import fs from "fs"

import { buildWavBuffer, computeRms, evenlySpacedWords, findSilenceValley, isLowConfidence, isNoiseSegment, isRepetitionLoop, parseWhisperJson, segmentRepeatKey, shouldRerunWindow, Transcriber } from "./transcriber"

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

describe("findSilenceValley", () => {
    const RATE = 16000
    const loud = (seconds: number) => Int16Array.from({ length: Math.round(seconds * RATE) }, (_, i) => (i % 2 ? 8000 : -8000))
    const quiet = (seconds: number) => new Int16Array(Math.round(seconds * RATE))

    it("finds the quiet dip inside the trailing search stretch", () => {
        const samples = new Int16Array(4 * RATE)
        samples.set(loud(3.2), 0)
        // 3.2s-3.5s is silence, then loud again to the end
        samples.set(loud(0.5), Math.round(3.5 * RATE))
        const valley = findSilenceValley(samples, Math.round(1.2 * RATE))
        expect(valley).not.toBeNull()
        expect(valley!).toBeGreaterThan(3.2 * RATE)
        expect(valley!).toBeLessThan(3.5 * RATE)
    })

    it("returns null when the trailing stretch never goes quiet", () => {
        expect(findSilenceValley(loud(4), Math.round(1.2 * RATE))).toBeNull()
    })

    it("returns null when the window is shorter than one frame", () => {
        expect(findSilenceValley(quiet(0.05), Math.round(1.2 * RATE))).toBeNull()
    })
})

describe("evenlySpacedWords", () => {
    it("spreads words across the segment duration", () => {
        const words = evenlySpacedWords({ text: "one two three four", startMs: 1000, endMs: 3000 })
        expect(words.map((word) => word.text)).toEqual(["one", "two", "three", "four"])
        expect(words[0]).toEqual({ text: "one", startMs: 1000, endMs: 1500 })
        expect(words[3]).toEqual({ text: "four", startMs: 2500, endMs: 3000 })
    })

    it("returns nothing for an empty segment", () => {
        expect(evenlySpacedWords({ text: "   ", startMs: 0, endMs: 1000 })).toEqual([])
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

    it("flows the overall result.language through to every segment (cli -oj with -l auto)", () => {
        const json = {
            result: { language: "fr" },
            transcription: [
                { text: " Dieu a tant aimé le monde.", offsets: { from: 0, to: 2500 } },
                { text: " Jean trois seize.", offsets: { from: 2500, to: 6000 } }
            ]
        }
        expect(parseWhisperJson(json, 7000)).toEqual([
            { text: " Dieu a tant aimé le monde.", startMs: 0, endMs: 2500, noSpeechProb: undefined, avgLogprob: undefined, language: "fr" },
            { text: " Jean trois seize.", startMs: 2500, endMs: 6000, noSpeechProb: undefined, avgLogprob: undefined, language: "fr" }
        ])
    })

    it("drops an unresolved 'auto' language instead of passing it on", () => {
        const json = { result: { language: "auto" }, transcription: [{ text: " hello", offsets: { from: 0, to: 1000 } }] }
        expect(parseWhisperJson(json, 7000)[0].language).toBeUndefined()
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

describe("vocabulary prompt plumbing", () => {
    beforeEach(() => {
        spawnMock.mockReset()
    })

    function cliArgs(transcriber: any): string[] {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const promise: Promise<void> = transcriber.runCliProcess("/tmp/in.wav", "/tmp/out")
        child.emit("exit", 0)
        return promise.then(() => spawnMock.mock.calls[spawnMock.mock.calls.length - 1][1] as string[]) as any
    }

    it("passes --prompt to whisper-cli when a prompt is set", async () => {
        const transcriber: any = createTranscriber("cli")
        transcriber.options.prompt = "Thus saith the LORD concerning Amalekites"

        const args = await cliArgs(transcriber)
        expect(args[args.indexOf("--prompt") + 1]).toBe("Thus saith the LORD concerning Amalekites")
    })

    it("omits --prompt entirely when none is set", async () => {
        const args = await cliArgs(createTranscriber("cli"))
        expect(args).not.toContain("--prompt")
    })

    it("applies a live setPrompt() update to the next cli run", async () => {
        const transcriber: any = createTranscriber("cli")
        transcriber.setPrompt("names of Daniel: Nebuchadnezzar, Shadrach")

        const args = await cliArgs(transcriber)
        expect(args[args.indexOf("--prompt") + 1]).toContain("Nebuchadnezzar")
    })
})

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

describe("shouldRerunWindow", () => {
    it("re-runs when the detected language falls outside the declared set", () => {
        expect(shouldRerunWindow("de", ["en", "fr"])).toBe(true)
        expect(shouldRerunWindow(" DE ", ["en", "fr"])).toBe(true) // whitespace/case tolerant
    })

    it("does not re-run when the detected language is declared", () => {
        expect(shouldRerunWindow("en", ["en", "fr"])).toBe(false)
        expect(shouldRerunWindow("fr", ["en", "fr"])).toBe(false)
        expect(shouldRerunWindow("FR", ["en", " fr "])).toBe(false)
    })

    it("never re-runs without a resolved detection or a declared set", () => {
        expect(shouldRerunWindow(undefined, ["en", "fr"])).toBe(false)
        expect(shouldRerunWindow("", ["en", "fr"])).toBe(false)
        expect(shouldRerunWindow("auto", ["en", "fr"])).toBe(false)
        expect(shouldRerunWindow("de", undefined)).toBe(false)
        expect(shouldRerunWindow("de", [])).toBe(false)
    })
})

// forced re-run of a window whose "-l auto" guess falls outside the declared spoken languages

describe("cli declared-language re-run", () => {
    const wav = buildWavBuffer(new Int16Array(1600).fill(3000))

    // each spawned "whisper-cli" writes the JSON output matching the requested -l flag, then exits 0
    function mockCliRuns(jsonByLanguage: { [language: string]: any }) {
        spawnMock.mockImplementation((_binary: string, args: string[]) => {
            const child = createFakeChild()
            const language = args[args.indexOf("-l") + 1]
            const outBase = args[args.indexOf("-of") + 1]
            setImmediate(() => {
                fs.writeFileSync(outBase + ".json", JSON.stringify(jsonByLanguage[language]))
                child.exitCode = 0
                child.emit("exit", 0)
            })
            return child
        })
    }

    function createInterpretationTranscriber() {
        return new Transcriber({
            binary: { kind: "cli", binaryPath: "/fake/whisper" },
            modelPath: "/fake/model.bin",
            language: "auto",
            declaredLanguages: ["en", "fr"],
            primaryLanguage: "en",
            onSegment: vi.fn(),
            onError: vi.fn()
        })
    }

    function spawnedWavPath(callIndex: number): string {
        const args = spawnMock.mock.calls[callIndex][1] as string[]
        return args[args.indexOf("-f") + 1]
    }

    beforeEach(() => {
        spawnMock.mockReset()
    })

    it("replaces the segments with the forced re-run when it reads as confident speech", async () => {
        mockCliRuns({
            auto: { result: { language: "de" }, transcription: [{ text: " Kauderwelsch", offsets: { from: 0, to: 1000 } }] },
            en: { result: { language: "en" }, transcription: [{ text: " For God so loved the world", offsets: { from: 0, to: 1000 } }] }
        })

        const transcriber: any = createInterpretationTranscriber()
        const json: any = await transcriber.transcribeCli(wav, 7000)

        expect(spawnMock).toHaveBeenCalledTimes(2)
        expect(spawnMock.mock.calls[0][1]).toContain("auto")
        expect(spawnMock.mock.calls[1][1]).toContain("en")
        // both runs must transcribe the SAME window WAV
        expect(spawnedWavPath(1)).toBe(spawnedWavPath(0))

        expect(json.result.language).toBe("en")
        expect(parseWhisperJson(json, 7000)).toEqual([{ text: " For God so loved the world", startMs: 0, endMs: 1000, noSpeechProb: undefined, avgLogprob: undefined, language: "en" }])
    })

    it("keeps the original segments when the forced re-run is only noise", async () => {
        mockCliRuns({
            auto: { result: { language: "de" }, transcription: [{ text: " Etwas auf Deutsch", offsets: { from: 0, to: 1000 } }] },
            en: { result: { language: "en" }, transcription: [{ text: " [BLANK_AUDIO]", offsets: { from: 0, to: 1000 } }] }
        })

        const transcriber: any = createInterpretationTranscriber()
        const json: any = await transcriber.transcribeCli(wav, 7000)

        expect(spawnMock).toHaveBeenCalledTimes(2)
        expect(json.result.language).toBe("de")
        expect(parseWhisperJson(json, 7000)[0].text).toBe(" Etwas auf Deutsch")
    })

    it("keeps the original segments when the forced re-run is low-confidence", async () => {
        mockCliRuns({
            auto: { result: { language: "de" }, transcription: [{ text: " Etwas auf Deutsch", offsets: { from: 0, to: 1000 } }] },
            en: { result: { language: "en" }, transcription: [{ text: " garbled maybe words", offsets: { from: 0, to: 1000 }, no_speech_prob: 0.9, avg_logprob: -2.5 }] }
        })

        const transcriber: any = createInterpretationTranscriber()
        const json: any = await transcriber.transcribeCli(wav, 7000)

        expect(spawnMock).toHaveBeenCalledTimes(2)
        expect(json.result.language).toBe("de")
        expect(parseWhisperJson(json, 7000)[0].text).toBe(" Etwas auf Deutsch")
    })

    it("does not re-run when the detected language is inside the declared set, and unlinks the temp files", async () => {
        mockCliRuns({
            auto: { result: { language: "fr" }, transcription: [{ text: " Dieu a tant aimé le monde", offsets: { from: 0, to: 1000 } }] }
        })

        const transcriber: any = createInterpretationTranscriber()
        const json: any = await transcriber.transcribeCli(wav, 7000)

        expect(spawnMock).toHaveBeenCalledTimes(1)
        expect(json.result.language).toBe("fr")
        expect(fs.existsSync(spawnedWavPath(0))).toBe(false)
    })

    it("unlinks the window WAV only after the re-run has read it", async () => {
        let wavExistedDuringRerun = false
        spawnMock.mockImplementation((_binary: string, args: string[]) => {
            const child = createFakeChild()
            const language = args[args.indexOf("-l") + 1]
            const outBase = args[args.indexOf("-of") + 1]
            const jsonByLanguage: { [key: string]: any } = {
                auto: { result: { language: "de" }, transcription: [{ text: " Kauderwelsch", offsets: { from: 0, to: 1000 } }] },
                en: { result: { language: "en" }, transcription: [{ text: " For God so loved the world", offsets: { from: 0, to: 1000 } }] }
            }
            setImmediate(() => {
                if (language === "en") wavExistedDuringRerun = fs.existsSync(args[args.indexOf("-f") + 1])
                fs.writeFileSync(outBase + ".json", JSON.stringify(jsonByLanguage[language]))
                child.exitCode = 0
                child.emit("exit", 0)
            })
            return child
        })

        const transcriber: any = createInterpretationTranscriber()
        await transcriber.transcribeCli(wav, 7000)

        expect(spawnMock).toHaveBeenCalledTimes(2)
        expect(wavExistedDuringRerun).toBe(true) // the WAV survived until the re-run
        expect(fs.existsSync(spawnedWavPath(0))).toBe(false) // ...and is gone afterwards
        expect(fs.existsSync(spawnedWavPath(0).replace(/\.wav$/, ".json"))).toBe(false)
    })

    it("skips the re-run once stop() has begun and still unlinks the temp files", async () => {
        spawnMock.mockImplementation((_binary: string, args: string[]) => {
            const child = createFakeChild()
            const outBase = args[args.indexOf("-of") + 1]
            setImmediate(() => {
                fs.writeFileSync(outBase + ".json", JSON.stringify({ result: { language: "de" }, transcription: [{ text: " Kauderwelsch", offsets: { from: 0, to: 1000 } }] }))
                child.exitCode = 0
                // stop() right before the exit - runCliProcess rejects, so the original result never reaches a re-run
                transcriber.stopped = true
                child.emit("exit", 0)
            })
            return child
        })

        const transcriber: any = createInterpretationTranscriber()
        await expect(transcriber.transcribeCli(wav, 7000)).rejects.toThrow("stopped")

        expect(spawnMock).toHaveBeenCalledTimes(1)
        expect(fs.existsSync(spawnedWavPath(0))).toBe(false)
    })
})

describe("parseWhisperJson token words (-ojf)", () => {
    it("folds the token stream into words with timing and a computed avg-logprob", () => {
        const json = {
            result: { language: "en" },
            transcription: [
                {
                    text: " come over here",
                    offsets: { from: 0, to: 1500 },
                    tokens: [
                        { text: "[_BEG_]", p: 0.99, offsets: { from: 0, to: 0 } },
                        { text: " come", p: 0.9, offsets: { from: 0, to: 400 } },
                        { text: " o", p: 0.8, offsets: { from: 450, to: 600 } },
                        { text: "ver", p: 0.7, offsets: { from: 600, to: 800 } },
                        { text: " here", p: 0.95, offsets: { from: 900, to: 1400 } }
                    ]
                }
            ]
        }
        const [segment] = parseWhisperJson(json, 2000)
        expect(segment.words).toEqual([
            { text: "come", startMs: 0, endMs: 400 },
            { text: "over", startMs: 450, endMs: 800 },
            { text: "here", startMs: 900, endMs: 1400 }
        ])
        // mean(ln p) over the real tokens - the confidence gate finally works on the cli path
        const expected = (Math.log(0.9) + Math.log(0.8) + Math.log(0.7) + Math.log(0.95)) / 4
        expect(segment.avgLogprob).toBeCloseTo(expected, 5)
    })

    it("keeps a provided avg_logprob over the computed one and survives missing tokens", () => {
        const json = { transcription: [{ text: "plain", offsets: { from: 0, to: 500 }, avg_logprob: -0.25 }] }
        const [segment] = parseWhisperJson(json, 1000)
        expect(segment.avgLogprob).toBe(-0.25)
        expect(segment.words).toBeUndefined()
    })
})

describe("coverage-driven windowing", () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it("keeps windows contiguous when decodes are slow - no audio is ever skipped", async () => {
        // every decode takes real wall time, so fresh audio piles up while one runs -
        // the old queue dropped that audio, the coverage design must grow into it instead
        spawnMock.mockImplementation((_binary: string, args: string[]) => {
            const child = createFakeChild()
            const outBase = args[args.indexOf("-of") + 1]
            setTimeout(() => {
                fs.writeFileSync(outBase + ".json", JSON.stringify({ transcription: [{ text: " steady speech continues", offsets: { from: 0, to: 2000 } }] }))
                child.exitCode = 0
                child.emit("exit", 0)
            }, 60)
            return child
        })

        const transcriber = new Transcriber({ binary: { kind: "cli", binaryPath: "/bin/whisper" }, modelPath: "model.bin", language: "en", onSegment: () => {}, onError: () => {} }) as any
        await transcriber.start()

        const ranges: [number, number][] = []
        const originalRun = transcriber.runWindow.bind(transcriber)
        transcriber.runWindow = (window: any) => {
            ranges.push([window.startSample, window.startSample + window.samples.length])
            return originalRun(window)
        }

        // ~14s of loud audio in 100ms chunks (no silence - snapping and skipping stay out of play)
        const chunk = new Int16Array(1600).fill(8000)
        const bytes = new Uint8Array(chunk.buffer.slice(0))
        for (let i = 0; i < 140; i++) {
            transcriber.pushAudio(bytes)
            if (i % 20 === 19) await delay(15) // let decodes interleave with the feed
        }
        // drain: decodes keep chaining off the backlog until less than a step remains
        for (let i = 0; i < 100 && (transcriber.processing || transcriber.totalSamples - transcriber.coveredUntilSample >= 3 * 16000); i++) await delay(25)
        await transcriber.stop()

        expect(ranges.length).toBeGreaterThan(1)
        // the invariant the old queue violated: every window begins AT OR BEFORE the previous
        // window's end - decode lag grows windows, it never punches holes in the audio
        for (let i = 1; i < ranges.length; i++) {
            expect(ranges[i][0]).toBeLessThanOrEqual(ranges[i - 1][1])
        }
        // and the pipeline actually made progress through the backlog
        expect(transcriber.coveredUntilSample).toBeGreaterThan(6 * 16000)
    })
})

describe("isRepetitionLoop", () => {
    it("catches whisper's decode loops", () => {
        expect(isRepetitionLoop("heh, heh, heh, heh, heh, heh, heh, heh,")).toBe(true)
        expect(isRepetitionLoop("you you you you you you")).toBe(true)
        expect(isRepetitionLoop("the the the the the the the the")).toBe(true)
    })

    it("keeps real speech, including natural emphasis", () => {
        expect(isRepetitionLoop("for god so loved the world that he gave his only begotten son")).toBe(false)
        expect(isRepetitionLoop("very very very good this morning")).toBe(false)
        expect(isRepetitionLoop("holy holy holy is the lord of hosts")).toBe(false)
        expect(isRepetitionLoop("amen")).toBe(false) // short segments never count
    })
})

describe("segmentRepeatKey", () => {
    it("matches the same line through punctuation and case shifts", () => {
        expect(segmentRepeatKey("Thank you for watching!")).toBe(segmentRepeatKey("thank you for watching."))
        expect(segmentRepeatKey("Turn to John 3:16")).not.toBe(segmentRepeatKey("Turn to John 3:17"))
    })
})
