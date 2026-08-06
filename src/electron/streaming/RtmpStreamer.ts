import { spawn, type ChildProcess } from "child_process"
import { config } from "../data/store"
import { getFfmpegPath, isFfmpegInstalled } from "./ffmpegManager"

interface StreamInstance {
    process: ChildProcess
    width: number
    height: number
    fps: number
    enableAudio: boolean
    videoInterval: NodeJS.Timeout
    audioInterval?: NodeJS.Timeout
    lastAudioTime: number
    lastFrame: Buffer
}

const SAMPLE_RATE = 48000
const AUDIO_CHANNELS = 2
const SILENCE_THRESHOLD_MS = 100
const SILENCE_INTERVAL_MS = 50

export class RtmpStreamer {
    private static streamers = new Map<string, StreamInstance>()

    static isRunning(outputId: string): boolean {
        return this.streamers.has(outputId)
    }

    static anyRunning(): boolean {
        return this.streamers.size > 0
    }

    // Detected usable hardware H.264 encoder (cached across all streams), or null for software libx264.
    private static hwEncoderProbe: Promise<string | null> | null = null

    // Probe which hardware H.264 encoder actually WORKS on this machine. Presence in `-encoders` isn't enough
    // (a build can list an encoder the GPU/driver can't run), so we run a 1-frame test encode of each candidate
    // and keep the first that exits cleanly. Result is cached; falls back to libx264 when none work.
    static async detectHwEncoder(): Promise<string | null> {
        if (this.hwEncoderProbe) return this.hwEncoderProbe
        this.hwEncoderProbe = (async () => {
            // respect the app's "disable hardware acceleration" setting — use software libx264 when it's off
            try {
                if (config.get("disableHardwareAcceleration") === true) {
                    console.info("[RtmpStreamer] hardware acceleration disabled in settings; using software libx264")
                    return null
                }
            } catch {
                // ignore
            }
            const ffmpegPath = getFfmpegPath()
            for (const enc of ["h264_nvenc", "h264_amf", "h264_qsv"]) {
                if (await this.testEncoder(ffmpegPath, enc)) {
                    console.info(`[RtmpStreamer] hardware H.264 encoder available: ${enc}`)
                    return enc
                }
            }
            console.info("[RtmpStreamer] no working hardware H.264 encoder; using software libx264")
            return null
        })()
        return this.hwEncoderProbe
    }

    private static testEncoder(ffmpegPath: string, encoder: string): Promise<boolean> {
        return new Promise((resolve) => {
            let settled = false
            const finish = (ok: boolean) => {
                if (settled) return
                settled = true
                resolve(ok)
            }
            let proc: ChildProcess
            try {
                proc = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "nullsrc=s=256x256:d=1", "-frames:v", "1", "-c:v", encoder, "-f", "null", "-"], { windowsHide: true })
            } catch {
                return finish(false)
            }
            proc.on("error", () => finish(false))
            proc.on("exit", (code) => finish(code === 0))
            setTimeout(() => {
                try {
                    proc.kill()
                } catch {
                    // ignore
                }
                finish(false)
            }, 5000)
        })
    }

    // outputs whose async start (encoder probe) is in flight — prevents a double-spawn before `streamers` is set
    private static starting = new Set<string>()

    static async start(outputId: string, url: string, width: number, height: number, fps = 30, enableAudio = true, bitrate = 4000) {
        if (this.isRunning(outputId) || this.starting.has(outputId)) return
        console.log(`[RtmpStreamer] Starting RTMP stream for ${outputId}...`)

        if (!isFfmpegInstalled()) {
            console.error(`[RtmpStreamer] Cannot start RTMP stream: FFmpeg is not installed.`)
            return
        }

        this.starting.add(outputId)
        const ffmpegPath = getFfmpegPath()
        // GPU H.264 encode when available (huge CPU saving at 1080p/4K) — falls back to libx264
        const hwEncoder = await this.detectHwEncoder()
        this.starting.delete(outputId)
        // a stop() may have raced in while we were probing
        if (this.isRunning(outputId)) return

        // Detect if we're likely getting Retina/HighDPI frames from Electron
        // macOS on ARM (M-series) usually captures at 2x scale
        const isRetina = process.platform === "darwin"

        const args = this.getFfmpegArgs(url, width, height, fps, enableAudio, isRetina, bitrate, hwEncoder)

        console.log(`[RtmpStreamer] Spawning FFmpeg to stream ${outputId} to ${url} at ${width}x${height} (${fps} fps, bitrate: ${bitrate}k, audio: ${enableAudio}, retina: ${isRetina})...`)
        try {
            const stdioConfig: any = enableAudio ? ["pipe", "ignore", "inherit", "pipe"] : ["pipe", "ignore", "inherit"]
            const ffmpegProcess = spawn(ffmpegPath, args, {
                stdio: stdioConfig,
                env: { ...process.env, NSUnbufferedIO: "YES" }
            })

            ffmpegProcess.stdin?.on("error", (_err) => {
                // Suppress write errors on exit
            })

            const audioStream = ffmpegProcess.stdio[3] as any
            audioStream?.on("error", (_err: any) => {
                // Suppress write errors on exit
            })

            ffmpegProcess.on("error", (err) => {
                console.error(`[RtmpStreamer] FFmpeg process error for ${outputId}:`, err)
                this.stop(outputId)
            })

            ffmpegProcess.on("exit", (code, signal) => {
                console.log(`[RtmpStreamer] FFmpeg exited for ${outputId} with code ${code} and signal ${signal}`)
                this.stop(outputId)
            })

            const initialFrame = Buffer.alloc(width * height * 4 * (isRetina ? 4 : 1))
            const frameDelay = 1000 / fps

            let isWriting = false
            const videoInterval = setInterval(() => {
                const streamer = this.streamers.get(outputId)
                if (!streamer || !streamer.process.stdin || streamer.process.stdin.destroyed) return
                if (isWriting) return // Skip if previous frame still writing

                try {
                    isWriting = true
                    streamer.process.stdin.write(streamer.lastFrame, () => {
                        isWriting = false
                    })
                } catch (err) {
                    isWriting = false
                    console.error(`[RtmpStreamer] Error writing video frame to FFmpeg for ${outputId}:`, err)
                }
            }, frameDelay)

            let audioInterval: NodeJS.Timeout | undefined
            if (enableAudio) {
                // Audio silence filling: 50ms of silence at 48k stereo (16-bit)
                const silenceChunk = Buffer.alloc(SAMPLE_RATE * 2 * AUDIO_CHANNELS * (SILENCE_INTERVAL_MS / 1000))
                audioInterval = setInterval(() => {
                    const streamer = this.streamers.get(outputId)
                    if (!streamer) return

                    if (Date.now() - streamer.lastAudioTime > SILENCE_THRESHOLD_MS) {
                        const aStream = streamer.process.stdio[3] as any
                        if (aStream && !aStream.destroyed) {
                            try {
                                aStream.write(silenceChunk)
                            } catch {}
                        }
                    }
                }, SILENCE_INTERVAL_MS)
            }

            this.streamers.set(outputId, {
                process: ffmpegProcess,
                width,
                height,
                fps,
                enableAudio,
                videoInterval,
                audioInterval,
                lastAudioTime: Date.now(),
                lastFrame: initialFrame
            })
        } catch (err) {
            console.error(`[RtmpStreamer] Failed to spawn FFmpeg:`, err)
        }
    }

    private static getFfmpegArgs(url: string, width: number, height: number, fps: number, enableAudio: boolean, isRetina = false, bitrate = 4000, hwEncoder: string | null = null): string[] {
        const inputWidth = isRetina ? width * 2 : width
        const inputHeight = isRetina ? height * 2 : height

        const args = ["-f", "rawvideo", "-pixel_format", "bgra", "-video_size", `${inputWidth}x${inputHeight}`, "-framerate", `${fps}`, "-thread_queue_size", "4096", "-i", "pipe:0"]

        if (enableAudio) {
            args.push("-f", "s16le", "-ar", `${SAMPLE_RATE}`, "-ac", `${AUDIO_CHANNELS}`, "-thread_queue_size", "4096", "-i", "pipe:3")
        } else {
            args.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=${SAMPLE_RATE}`)
        }

        const bitrateKbps = `${bitrate}k`
        const bufsizeKbps = `${bitrate * 2}k`
        const gop = `${fps * 2}`
        // hardware encoders take NV12; libx264 takes yuv420p. Include the downscale (retina) in the same filter.
        const pixFmt = hwEncoder ? "nv12" : "yuv420p"
        const vf = isRetina ? `scale=${width}:${height},format=${pixFmt}` : `format=${pixFmt}`
        args.push("-vf", vf)

        // Encoder-specific low-latency CBR settings, roughly matching the libx264 "veryfast/zerolatency" profile.
        if (hwEncoder === "h264_nvenc") {
            args.push("-c:v", "h264_nvenc", "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-b:v", bitrateKbps, "-maxrate", bitrateKbps, "-bufsize", bufsizeKbps, "-g", gop)
        } else if (hwEncoder === "h264_amf") {
            args.push("-c:v", "h264_amf", "-usage", "lowlatency", "-rc", "cbr", "-b:v", bitrateKbps, "-maxrate", bitrateKbps, "-g", gop)
        } else if (hwEncoder === "h264_qsv") {
            args.push("-c:v", "h264_qsv", "-preset", "veryfast", "-b:v", bitrateKbps, "-maxrate", bitrateKbps, "-bufsize", bufsizeKbps, "-g", gop)
        } else {
            args.push("-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-b:v", bitrateKbps, "-maxrate", bitrateKbps, "-bufsize", bufsizeKbps, "-g", gop)
        }

        args.push("-pix_fmt", pixFmt, "-c:a", "aac", "-b:a", "128k", "-f", "flv", url)
        return args
    }

    static stop(outputId: string) {
        const streamer = this.streamers.get(outputId)
        if (!streamer) return

        console.log(`[RtmpStreamer] Stopping RTMP stream for ${outputId}...`)

        clearInterval(streamer.videoInterval)
        if (streamer.audioInterval) clearInterval(streamer.audioInterval)

        try {
            streamer.process.stdin?.end()
            ;(streamer.process.stdio[3] as any)?.end()
            streamer.process.kill("SIGTERM")
        } catch (err) {
            console.error(`[RtmpStreamer] Error stopping FFmpeg process:`, err)
        }
        this.streamers.delete(outputId)
    }

    static stopAll() {
        for (const id of this.streamers.keys()) {
            this.stop(id)
        }
    }

    static updateFrame(outputId: string, buffer: Buffer) {
        const streamer = this.streamers.get(outputId)
        if (streamer) {
            // Create a copy to avoid race conditions with the capture buffer
            const frameCopy = Buffer.allocUnsafe(buffer.length)
            buffer.copy(frameCopy)
            streamer.lastFrame = frameCopy
        }
    }

    static updateAudio(buffer: Buffer) {
        const now = Date.now()
        for (const streamer of this.streamers.values()) {
            if (!streamer.enableAudio) continue

            streamer.lastAudioTime = now
            const audioStream = streamer.process.stdio[3] as any
            if (audioStream && !audioStream.destroyed) {
                try {
                    audioStream.write(buffer)
                } catch (err) {
                    console.error(`[RtmpStreamer] Error writing audio to FFmpeg:`, err)
                }
            }
        }
    }
}
