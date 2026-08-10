import { execFileSync, spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { buildEncoderCommand } from "./encoderProfiles"

// only encoder resolution is faked; the ffmpeg processes are real
const mocked = vi.hoisted(() => ({ encoder: "x264" }))
vi.mock("./encoderDetection", () => ({
    resolveEncoder: async () => mocked.encoder,
    getRtmpEncoderSetting: () => mocked.encoder
}))
vi.mock("./ffmpegManager", () => ({ resolveFfmpegPath: async () => "ffmpeg" }))

const { RtmpStreamer, setRtmpStatusListener, setRtmpNoticeListener } = await import("./RtmpStreamer")

function hasFfmpeg(): boolean {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

const WIDTH = 320
const HEIGHT = 180
const FPS = 15

function bgraFrame(value: number): Buffer {
    return Buffer.alloc(WIDTH * HEIGHT * 4, value)
}

function probe(file: string): any {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8" })
    return JSON.parse(out)
}

const describeIfFfmpeg = hasFfmpeg() ? describe : describe.skip

describeIfFfmpeg("RTMP pipeline (real ffmpeg)", () => {
    let tmpDir: string

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-rtmp-"))
    })

    afterEach(() => {
        RtmpStreamer.stopAll()
        mocked.encoder = "x264"
        setRtmpNoticeListener(() => {})
    })

    function feed(id: string, size = { width: WIDTH, height: HEIGHT }) {
        let i = 0
        const frame = Buffer.alloc(size.width * size.height * 4)
        return setInterval(() => {
            frame.fill((i++ * 8) % 256)
            RtmpStreamer.updateFrame(id, frame, size)
        }, 1000 / FPS)
    }

    it("encodes raw BGRA into a valid mpegts stream on stdout", async () => {
        const args = buildEncoderCommand({
            encoderId: "x264",
            inputWidth: WIDTH,
            inputHeight: HEIGHT,
            outputWidth: WIDTH,
            outputHeight: HEIGHT,
            fps: FPS,
            bitrate: 500,
            enableAudio: false
        })

        const ffmpeg = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] })
        const chunks: Buffer[] = []
        ffmpeg.stdout.on("data", (c) => chunks.push(c))

        for (let i = 0; i < FPS * 2; i++) ffmpeg.stdin.write(bgraFrame(i * 8))
        ffmpeg.stdin.end()

        // the silent audio input never ends, which is what we want for a live stream, so stop it explicitly
        await new Promise((r) => setTimeout(r, 3000))
        ffmpeg.kill("SIGTERM")
        await new Promise((resolve) => ffmpeg.on("exit", resolve))

        const output = Buffer.concat(chunks)
        expect(output.length).toBeGreaterThan(0)
        // every mpegts packet starts with the 0x47 sync byte
        expect(output[0]).toBe(0x47)

        const tsFile = path.join(tmpDir, "encoded.ts")
        fs.writeFileSync(tsFile, output)
        const info = probe(tsFile)
        const video = info.streams.find((s: any) => s.codec_type === "video")
        expect(video.codec_name).toBe("h264")
        expect(video.width).toBe(WIDTH)
        expect(video.height).toBe(HEIGHT)
    }, 30000)

    it("fans one encode out to two destinations without re-encoding", async () => {
        const outA = path.join(tmpDir, "a.flv")
        const outB = path.join(tmpDir, "b.flv")

        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [
            { id: "a", url: outA, key: "", enabled: true },
            { id: "b", url: outB, key: "", enabled: true }
        ])

        // the encoder spawns on the first frame, using its actual dimensions
        let i = 0
        const feed = setInterval(() => RtmpStreamer.updateFrame("test-output", bgraFrame((i++ * 8) % 256), { width: WIDTH, height: HEIGHT }), 1000 / FPS)
        await new Promise((r) => setTimeout(r, 5000))
        clearInterval(feed)

        const status = RtmpStreamer.getStatus("test-output")
        expect(status.a?.state).toBe("live")
        expect(status.b?.state).toBe("live")

        RtmpStreamer.stopAll()
        await new Promise((r) => setTimeout(r, 1500))

        for (const file of [outA, outB]) {
            expect(fs.existsSync(file), `${file} should exist`).toBe(true)
            const video = probe(file).streams.find((s: any) => s.codec_type === "video")
            expect(video.codec_name).toBe("h264")
            expect(video.width).toBe(WIDTH)
            expect(video.height).toBe(HEIGHT)
        }
    }, 30000)

    it("pushes destination status through the registered listener", async () => {
        const pushes: { outputId: string; states: string[] }[] = []
        setRtmpStatusListener((outputId, destinations) => pushes.push({ outputId, states: Object.values(destinations).map((d) => d.state) }))

        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [{ id: "a", url: path.join(tmpDir, "listener.flv"), key: "", enabled: true }])

        let i = 0
        const feed = setInterval(() => RtmpStreamer.updateFrame("test-output", bgraFrame((i++ * 8) % 256), { width: WIDTH, height: HEIGHT }), 1000 / FPS)
        await new Promise((r) => setTimeout(r, 4000))
        clearInterval(feed)

        expect(pushes.length).toBeGreaterThan(0)
        expect(pushes.every((p) => p.outputId === "test-output")).toBe(true)
        expect(pushes.some((p) => p.states.includes("live"))).toBe(true)

        setRtmpStatusListener(() => {})
    }, 30000)

    it("recovers to a healthy destination after falling back to software encoding", async () => {
        // nvenc does not exist in a macOS ffmpeg build, so the encoder really fails and the
        // hardware -> software fallback path runs for real
        mocked.encoder = "nvenc"
        const notices: string[] = []
        setRtmpNoticeListener((message) => notices.push(message))

        const out = path.join(tmpDir, "fallback.flv")
        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "nvenc" }, [{ id: "a", url: out, key: "", enabled: true }])

        const feeding = feed("test-output")
        await new Promise((r) => setTimeout(r, 8000))
        clearInterval(feeding)

        expect(notices.some((n) => n.includes("software"))).toBe(true)

        // the destination must end up healthy, not pinned to the informational error
        const status = RtmpStreamer.getStatus("test-output")
        expect(status.a?.state).toBe("live")
        expect(status.a?.error).toBeUndefined()

        RtmpStreamer.stopAll()
        await new Promise((r) => setTimeout(r, 1500))

        const video = probe(out).streams.find((s: any) => s.codec_type === "video")
        expect(video.codec_name).toBe("h264")
    }, 40000)

    it("reconnects relays when the encoder respawns, so timestamps do not jump backwards", async () => {
        const out = path.join(tmpDir, "respawn.flv")
        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [{ id: "a", url: out, key: "", enabled: true }])

        let feeding = feed("test-output")
        await new Promise((r) => setTimeout(r, 3500))
        expect(RtmpStreamer.getStatus("test-output").a?.state).toBe("live")
        clearInterval(feeding)

        // a capture size change forces a new encoder, which restarts its mpegts clock at zero
        const bigger = { width: WIDTH * 2, height: HEIGHT * 2 }
        feeding = feed("test-output", bigger)
        await new Promise((r) => setTimeout(r, 500))

        // the relay must be torn down rather than left connected across the timestamp discontinuity
        expect(RtmpStreamer.getStatus("test-output").a?.state).toBe("reconnecting")

        await new Promise((r) => setTimeout(r, 4500))
        clearInterval(feeding)

        // and it must come back on its own
        expect(RtmpStreamer.getStatus("test-output").a?.state).toBe("live")

        RtmpStreamer.stopAll()
        await new Promise((r) => setTimeout(r, 1500))

        // the broadcast size is the configured one throughout; the larger capture is scaled down
        const video = probe(out).streams.find((s: any) => s.codec_type === "video")
        expect(video.codec_name).toBe("h264")
        expect(video.width).toBe(WIDTH)
    }, 40000)

    it("drops a frame whose buffer does not match the declared size", async () => {
        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [{ id: "a", url: path.join(tmpDir, "mismatch.flv"), key: "", enabled: true }])

        // a truncated buffer would otherwise desync -f rawvideo and shear the broadcast
        RtmpStreamer.updateFrame("test-output", Buffer.alloc(WIDTH * HEIGHT * 4 - 16), { width: WIDTH, height: HEIGHT })

        expect(RtmpStreamer.getStatus("test-output").a?.state).toBe("idle")
    }, 30000)

    it("does not leave a stream running when stopped mid-startup", async () => {
        const out = path.join(tmpDir, "cancelled.flv")

        const starting = RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [{ id: "a", url: out, key: "", enabled: true }])
        RtmpStreamer.stop("test-output")
        await starting

        expect(RtmpStreamer.isRunning("test-output")).toBe(false)
    }, 30000)

    it("applies a destination added while start() was still resolving", async () => {
        const destA = { id: "a", url: path.join(tmpDir, "pending-a.flv"), key: "", enabled: true }
        const destB = { id: "b", url: path.join(tmpDir, "pending-b.flv"), key: "", enabled: true }
        const config = { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }

        const starting = RtmpStreamer.start("test-output", config, [destA])
        // arrives before start() has registered the streamer, so it would be dropped without the pending queue
        RtmpStreamer.update("test-output", config, [destA, destB])
        await starting
        await new Promise((r) => setTimeout(r, 200))

        const status = RtmpStreamer.getStatus("test-output")
        expect(Object.keys(status).sort()).toEqual(["a", "b"])
    }, 30000)

    it("keeps the other destination live when one is removed", async () => {
        const outA = path.join(tmpDir, "keep.flv")
        const outB = path.join(tmpDir, "drop.flv")
        const destA = { id: "a", url: outA, key: "", enabled: true }
        const destB = { id: "b", url: outB, key: "", enabled: true }

        await RtmpStreamer.start("test-output", { width: WIDTH, height: HEIGHT, fps: FPS, bitrate: 500, enableAudio: false, encoder: "x264" }, [destA, destB])

        let i = 0
        const feed = setInterval(() => RtmpStreamer.updateFrame("test-output", bgraFrame((i++ * 8) % 256), { width: WIDTH, height: HEIGHT }), 1000 / FPS)
        await new Promise((r) => setTimeout(r, 3000))

        RtmpStreamer.syncDestinations("test-output", [destA])
        await new Promise((r) => setTimeout(r, 2000))
        clearInterval(feed)

        const status = RtmpStreamer.getStatus("test-output")
        expect(status.a?.state).toBe("live")
        expect(status.b).toBeUndefined()
        expect(RtmpStreamer.isRunning("test-output")).toBe(true)
    }, 30000)
})
