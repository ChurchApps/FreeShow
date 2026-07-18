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

    static start(outputId: string, url: string, width: number, height: number, fps = 30, enableAudio = true) {
        if (this.isRunning(outputId)) return
        if (!isFfmpegInstalled()) {
            console.error(`[RtmpStreamer] Cannot start RTMP stream: FFmpeg is not installed.`)
            return
        }

        const ffmpegPath = getFfmpegPath()
        const args = this.getFfmpegArgs(url, width, height, fps, enableAudio)

        console.log(`[RtmpStreamer] Spawning FFmpeg to stream ${outputId} to ${url} at ${width}x${height} (${fps} fps, audio: ${enableAudio})...`)
        try {
            const stdioConfig: any = enableAudio ? ["pipe", "ignore", "inherit", "pipe"] : ["pipe", "ignore", "inherit"]
            const process = spawn(ffmpegPath, args, {
                stdio: stdioConfig
            })

            process.stdin?.on("error", (_err) => {
                // Suppress write errors on exit
            })

            const audioStream = process.stdio[3] as any
            audioStream?.on("error", (_err: any) => {
                // Suppress write errors on exit
            })

            process.on("error", (err) => {
                console.error(`[RtmpStreamer] FFmpeg process error for ${outputId}:`, err)
                this.stop(outputId)
            })

            process.on("exit", (code, signal) => {
                console.log(`[RtmpStreamer] FFmpeg exited for ${outputId} with code ${code} and signal ${signal}`)
                this.stop(outputId)
            })

            const initialFrame = Buffer.alloc(width * height * 4)
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
                process,
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

    private static getFfmpegArgs(url: string, width: number, height: number, fps: number, enableAudio: boolean): string[] {
        const args = ["-f", "rawvideo", "-pixel_format", "bgra", "-video_size", `${width}x${height}`, "-framerate", `${fps}`, "-i", "pipe:0"]

        if (enableAudio) {
            args.push("-f", "s16le", "-ar", `${SAMPLE_RATE}`, "-ac", `${AUDIO_CHANNELS}`, "-i", "pipe:3")
        } else {
            args.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=${SAMPLE_RATE}`)
        }

        args.push("-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p", "-g", `${fps * 2}`, "-c:a", "aac", "-b:a", "128k", "-f", "flv", url)
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

    static sendFrame(outputId: string, buffer: Buffer) {
        const streamer = this.streamers.get(outputId)
        if (streamer) {
            streamer.lastFrame = buffer
        }
    }

    static sendAudio(buffer: Buffer) {
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
