import { spawn, type ChildProcess } from "child_process"
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
const SILENCE_THRESHOLD_MS = 150
const SILENCE_INTERVAL_MS = 50

export class RtmpStreamer {
    private static streamers = new Map<string, StreamInstance>()

    static isRunning(outputId: string): boolean {
        return this.streamers.has(outputId)
    }

    static anyRunning(): boolean {
        return this.streamers.size > 0
    }

    static start(outputId: string, url: string, width: number, height: number, fps = 30, enableAudio = true, bitrate = 4000) {
        if (this.isRunning(outputId)) return
        console.log(`[RtmpStreamer] Starting RTMP stream for ${outputId}...`)

        if (!isFfmpegInstalled()) {
            console.error(`[RtmpStreamer] Cannot start RTMP stream: FFmpeg is not installed.`)
            return
        }

        const ffmpegPath = getFfmpegPath()

        // Detect if we're likely getting Retina/HighDPI frames from Electron
        // macOS on ARM (M-series) usually captures at 2x scale
        const isRetina = process.platform === "darwin"

        const args = this.getFfmpegArgs(url, width, height, fps, enableAudio, isRetina, bitrate)

        console.log(`[RtmpStreamer] Spawning FFmpeg to stream ${outputId} to ${url} at ${width}x${height} (${fps} fps, bitrate: ${bitrate}k, audio: ${enableAudio}, retina: ${isRetina})...`)
        try {
            const stdioConfig: any = enableAudio ? ["pipe", "ignore", "inherit", "pipe"] : ["pipe", "ignore", "inherit"]
            const ffmpegProcess = spawn(ffmpegPath, args, {
                stdio: stdioConfig,
                env: { ...process.env, NSUnbufferedIO: "YES" }
            })

            ffmpegProcess.stdin?.on("error", (_err) => {})

            const audioStream = ffmpegProcess.stdio[3] as any
            audioStream?.on("error", (_err: any) => {})

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

            const videoInterval = setInterval(() => {
                const streamer = this.streamers.get(outputId)
                if (!streamer || !streamer.process.stdin || streamer.process.stdin.destroyed) return

                try {
                    streamer.process.stdin.write(streamer.lastFrame)
                } catch (err) {
                    console.error(`[RtmpStreamer] Error writing video frame to FFmpeg for ${outputId}:`, err)
                }
            }, frameDelay)

            let audioInterval: NodeJS.Timeout | undefined
            if (enableAudio) {
                // Audio silence filling: 50ms chunk (9600 bytes) if audio stream pauses
                const bytesPer50ms = Math.floor(SAMPLE_RATE * 2 * AUDIO_CHANNELS * (SILENCE_INTERVAL_MS / 1000))
                const silenceChunk = Buffer.alloc(bytesPer50ms)
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

    private static getFfmpegArgs(url: string, width: number, height: number, fps: number, enableAudio: boolean, isRetina = false, bitrate = 4000): string[] {
        const inputWidth = isRetina ? width * 2 : width
        const inputHeight = isRetina ? height * 2 : height

        const args = ["-use_wallclock_as_timestamps", "1", "-f", "rawvideo", "-pixel_format", "bgra", "-video_size", `${inputWidth}x${inputHeight}`, "-framerate", `${fps}`, "-i", "pipe:0"]

        if (enableAudio) {
            args.push("-use_wallclock_as_timestamps", "1", "-f", "s16le", "-ar", `${SAMPLE_RATE}`, "-ac", `${AUDIO_CHANNELS}`, "-i", "pipe:3")
        } else {
            args.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=${SAMPLE_RATE}`)
        }

        const vf = isRetina ? `scale=${width}:${height},format=yuv420p` : "format=yuv420p"
        const bitrateKbps = `${bitrate}k`
        const bufsizeKbps = `${Math.round(bitrate * 1.5)}k`

        args.push("-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-b:v", bitrateKbps, "-maxrate", bitrateKbps, "-bufsize", bufsizeKbps, "-pix_fmt", "yuv420p", "-vf", vf, "-g", `${fps * 2}`, "-c:a", "aac", "-b:a", "128k", "-ar", `${SAMPLE_RATE}`, "-ac", `${AUDIO_CHANNELS}`, "-af", "aresample=async=1000", "-flvflags", "no_duration_filesize", "-f", "flv", url)
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
