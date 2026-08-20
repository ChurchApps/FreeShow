import { spawn, type ChildProcess } from "child_process"
import type { RtmpDestination, RtmpDestinationState, RtmpStatus } from "../../types/Output"
import { resolveEncoder } from "./encoderDetection"
import { buildEncoderCommand, buildRelayCommand, getProfile, SAMPLE_RATE, type EncoderId } from "./encoderProfiles"
import { resolveFfmpegPath } from "./ffmpegManager"

// status and notices are pushed through registered listeners rather than importing the IPC layer
// directly, which would create an import cycle back through responsesMain
type RtmpStatusListener = (outputId: string, destinations: RtmpStatus) => void
type RtmpNoticeListener = (message: string) => void
let statusListener: RtmpStatusListener | null = null
let noticeListener: RtmpNoticeListener | null = null

export function setRtmpStatusListener(listener: RtmpStatusListener) {
    statusListener = listener
}

export function setRtmpNoticeListener(listener: RtmpNoticeListener) {
    noticeListener = listener
}

/** minimum relay buffer cap to tolerate network handshake / initial burst */
const MIN_RELAY_BUFFER_CAP_BYTES = 4 * 1024 * 1024
const RELAY_BUFFER_DURATION_SECS = 6
function getRelayBufferCap(bitrateKbps: number): number {
    return Math.max(MIN_RELAY_BUFFER_CAP_BYTES, Math.round(((bitrateKbps * 1000) / 8) * RELAY_BUFFER_DURATION_SECS))
}

const RELAY_LIVE_AFTER_MS = 2000
const BACKOFF_START_MS = 1000
const BACKOFF_MAX_MS = 15000
/**
 * How long a process must survive before a failure is treated as transient and the backoff penalty
 * is forgiven. This is deliberately far longer than the "live" threshold: a rejected stream key or
 * an unroutable host takes several seconds to fail, so resetting at 2s would keep the backoff
 * pinned at its minimum and reconnect hot forever.
 */
const STABLE_AFTER_MS = 60000
/** a hardware encoder dying this soon after start is treated as unsupported */
const HW_FAILURE_WINDOW_MS = 3000
const ENCODER_MAX_CONSECUTIVE_FAILURES = 10
const STATUS_PUSH_INTERVAL_MS = 1000

interface RelayInstance {
    destination: RtmpDestination
    process: ChildProcess | null
    state: RtmpDestinationState
    /** user-facing failure reason; only set while in an error or reconnecting state */
    error?: string
    /** most recent stderr line, kept for diagnostics when a failure does occur */
    lastStderr?: string
    /** unplanned restarts this stream; a climbing count means the destination is struggling */
    restarts: number
    /** reason for the most recent unplanned restart, kept after recovery */
    lastIssue?: string
    startedAt: number
    backoffMs: number
    restartTimer?: NodeJS.Timeout
    liveTimer?: NodeJS.Timeout
    stopped: boolean
}

interface StreamInstance {
    outputId: string
    config: StreamConfig
    encoderId: EncoderId
    ffmpegPath: string
    encoder: ChildProcess | null
    /** actual size of the raw frames, learned from the first captured frame */
    inputSize: { width: number; height: number } | null
    sampleRate?: number
    encoderStartedAt: number
    encoderBackoffMs: number
    encoderFailures: number
    encoderRestartTimer?: NodeJS.Timeout
    triedSoftwareFallback: boolean
    relays: Map<string, RelayInstance>
    videoTimeout?: NodeJS.Timeout
    audioInterval?: NodeJS.Timeout
    lastAudioTime: number
    lastFrame: Buffer | null
    audioStats?: {
        totalBytes: number
        startTime: number
        chunkCount: number
        lastLog: number
    }
    videoFrameCount?: number
    hasReceivedFirstAudio?: boolean
}

interface StreamConfig {
    /** dimensions to broadcast at */
    width: number
    height: number
    fps: number
    bitrate: number
    enableAudio: boolean
    /** "auto", an explicit encoder id, or undefined */
    encoder?: string
}

export class RtmpStreamer {
    private static streamers = new Map<string, StreamInstance>()
    private static starting = new Set<string>()
    private static pending = new Map<string, { config: StreamConfig; destinations: RtmpDestination[] }>()
    /** ids that were stopped while start() was still awaiting */
    private static cancelled = new Set<string>()
    private static statusTimers = new Map<string, NodeJS.Timeout>()

    static isRunning(outputId: string): boolean {
        return this.streamers.has(outputId)
    }

    static anyRunning(): boolean {
        return this.streamers.size > 0
    }

    // ----- lifecycle -----

    /** Apply the latest settings: restart only when the encode itself changed, otherwise just sync relays. */
    static update(outputId: string, config: StreamConfig, destinations: RtmpDestination[]) {
        // encoder detection can take seconds on a cold cache; hold the latest settings until start() finishes
        if (this.starting.has(outputId)) {
            this.pending.set(outputId, { config, destinations })
            return
        }

        const streamer = this.streamers.get(outputId)
        if (!streamer) {
            void this.start(outputId, config, destinations)
            return
        }

        if (configRequiresRestart(streamer.config, config)) {
            console.log(`[RtmpStreamer] Encode settings changed for ${outputId}, restarting`)
            this.stop(outputId)
            void this.start(outputId, config, destinations)
            return
        }

        this.syncDestinations(outputId, destinations)
    }

    static async start(outputId: string, config: StreamConfig, destinations: RtmpDestination[]) {
        if (this.isRunning(outputId) || this.starting.has(outputId)) return
        this.starting.add(outputId)

        try {
            const ffmpegPath = await resolveFfmpegPath()
            if (!ffmpegPath) {
                console.error("[RtmpStreamer] Cannot start: FFmpeg is not installed.")
                return
            }

            const encoderId = await resolveEncoder(config.encoder)
            if (this.cancelled.has(outputId)) return

            console.log(`[RtmpStreamer] Starting ${outputId} with ${getProfile(encoderId).label} at ${config.width}x${config.height} ${config.fps}fps ${config.bitrate}k`)

            const streamer: StreamInstance = {
                outputId,
                config,
                encoderId,
                ffmpegPath,
                encoder: null,
                inputSize: null,
                encoderStartedAt: 0,
                encoderBackoffMs: BACKOFF_START_MS,
                encoderFailures: 0,
                triedSoftwareFallback: false,
                relays: new Map(),
                lastAudioTime: Date.now(),
                lastFrame: null
            }
            this.streamers.set(outputId, streamer)

            // the encoder is spawned once the first frame reveals the real capture size
            this.syncDestinations(outputId, destinations)
        } finally {
            this.starting.delete(outputId)
            this.cancelled.delete(outputId)

            const pending = this.pending.get(outputId)
            if (pending) {
                this.pending.delete(outputId)
                this.update(outputId, pending.config, pending.destinations)
            }
        }
    }

    static stop(outputId: string) {
        this.pending.delete(outputId)
        if (this.starting.has(outputId)) this.cancelled.add(outputId)

        const streamer = this.streamers.get(outputId)
        if (!streamer) return

        console.log(`[RtmpStreamer] Stopping ${outputId}...`)

        // CLEAR AUDIO STATS AND QUEUES ON STOP
        streamer.audioStats = undefined
        streamer.lastFrame = null

        this.streamers.delete(outputId)

        if (streamer.encoderRestartTimer) clearTimeout(streamer.encoderRestartTimer)
        streamer.encoderRestartTimer = undefined

        for (const relay of streamer.relays.values()) this.stopRelay(relay)
        this.stopEncoder(streamer)

        const timer = this.statusTimers.get(outputId)
        if (timer) {
            clearTimeout(timer)
            this.statusTimers.delete(outputId)
        }

        statusListener?.(outputId, {})
    }

    static stopAll() {
        for (const id of this.starting) this.cancelled.add(id)
        // an id that is only mid-start has no entry in streamers, so its queued update must be
        // dropped here or it would resurrect the stream after shutdown
        this.pending.clear()
        for (const id of [...this.streamers.keys()]) this.stop(id)
    }

    // ----- encoder -----

    private static spawnEncoder(streamer: StreamInstance, inputSize: { width: number; height: number }) {
        const { config } = streamer
        const args = buildEncoderCommand({
            encoderId: streamer.encoderId,
            inputWidth: inputSize.width,
            inputHeight: inputSize.height,
            outputWidth: config.width,
            outputHeight: config.height,
            fps: config.fps,
            bitrate: config.bitrate,
            enableAudio: config.enableAudio,
            sampleRate: streamer.sampleRate || SAMPLE_RATE
        })

        const scaling = inputSize.width !== config.width || inputSize.height !== config.height
        console.log(`[RtmpStreamer] Encoding ${streamer.outputId}: captured ${inputSize.width}x${inputSize.height} -> broadcast ${config.width}x${config.height}${scaling ? " (scaling)" : ""}`)

        let encoder: ChildProcess
        try {
            encoder = spawn(streamer.ffmpegPath, args, {
                stdio: config.enableAudio ? ["pipe", "pipe", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
                env: { ...process.env, NSUnbufferedIO: "YES" },
                windowsHide: true
            })
        } catch (err) {
            console.error(`[RtmpStreamer] Failed to spawn encoder for ${streamer.outputId}:`, err)
            return
        }

        streamer.encoderStartedAt = Date.now()
        streamer.hasReceivedFirstAudio = false

        streamer.encoder = encoder
        streamer.inputSize = inputSize
        streamer.encoderStartedAt = Date.now()
        streamer.lastAudioTime = Date.now()

        encoder.stdin?.on("error", () => {}) // suppress writes racing teardown
        ;(encoder.stdio[3] as any)?.on("error", () => {})

        encoder.stdout?.on("data", (chunk: Buffer) => this.fanOut(streamer, chunk))
        encoder.stderr?.on("data", (chunk: Buffer) => console.warn(`[RtmpStreamer:encoder ${streamer.outputId}] ${chunk.toString().trim()}`))

        // spawn failures (ENOENT, EAGAIN) surface asynchronously and emit no "exit"
        encoder.on("error", (err) => {
            if (streamer.encoder !== encoder) return
            console.error(`[RtmpStreamer] Encoder error for ${streamer.outputId}:`, err)
            this.onEncoderExit(streamer, null, null)
        })
        encoder.on("exit", (code, signal) => {
            if (streamer.encoder !== encoder) return
            this.onEncoderExit(streamer, code, signal)
        })

        let isWriting = false
        streamer.videoFrameCount = 0

        const sendVideoFrame = () => {
            const frameInterval = 1000 / config.fps
            let startTime = performance.now()
            let frameCount = 0

            const tick = () => {
                frameCount++
                const expectedTime = startTime + frameCount * frameInterval
                const delay = Math.max(0, expectedTime - performance.now())

                streamer.videoTimeout = setTimeout(() => {
                    tick()

                    const stdin = streamer.encoder?.stdin
                    if (!stdin || stdin.destroyed || !streamer.lastFrame || isWriting) return

                    // Hold video until audio arrives
                    if (config.enableAudio && !streamer.hasReceivedFirstAudio) return

                    // Never write if stdin has ANY unsent data (>0 bytes queued).
                    // This guarantees VideoPipe Queued NEVER hits 8100 KB at startup!
                    if (stdin.writableLength > 0) return

                    isWriting = true
                    try {
                        stdin.write(streamer.lastFrame, () => {
                            isWriting = false
                            streamer.videoFrameCount = (streamer.videoFrameCount || 0) + 1
                        })
                    } catch {
                        isWriting = false
                    }
                }, delay)
            }

            tick()
        }

        sendVideoFrame()
    }

    private static stopEncoder(streamer: StreamInstance) {
        if (streamer.videoTimeout) clearTimeout(streamer.videoTimeout)
        if (streamer.audioInterval) clearInterval(streamer.audioInterval)
        streamer.videoTimeout = undefined
        streamer.audioInterval = undefined

        const encoder = streamer.encoder
        streamer.encoder = null
        if (!encoder) return

        encoder.removeAllListeners("exit")
        encoder.removeAllListeners("error")
        try {
            encoder.stdin?.end()
            ;(encoder.stdio[3] as any)?.end()
            encoder.kill("SIGTERM")
        } catch (err) {
            console.error("[RtmpStreamer] Error stopping encoder:", err)
        }
    }

    /**
     * Replace the encoder process and reconnect every relay. A fresh encoder restarts its mpegts
     * timestamps at zero, so a relay left connected across the swap sees time jump backwards and
     * pushes corrupt packets and a DTS discontinuity to a live ingest.
     */
    private static respawnEncoder(streamer: StreamInstance, inputSize: { width: number; height: number }, reason: string) {
        this.stopEncoder(streamer)
        this.spawnEncoder(streamer, inputSize)
        if (!streamer.encoder) return

        for (const relay of streamer.relays.values()) {
            this.restartRelay(streamer, relay, reason, { resetBackoff: true })
        }
    }

    private static onEncoderExit(streamer: StreamInstance, code: number | null, signal: string | null) {
        if (!this.streamers.has(streamer.outputId)) return

        const uptime = Date.now() - streamer.encoderStartedAt
        console.log(`[RtmpStreamer] Encoder exited for ${streamer.outputId} (code ${code}, signal ${signal}, up ${Math.round(uptime / 1000)}s)`)

        this.stopEncoder(streamer)

        if (!streamer.inputSize) {
            this.stop(streamer.outputId)
            return
        }

        const diedEarly = uptime < HW_FAILURE_WINDOW_MS
        if (code !== 0 && diedEarly && streamer.encoderId !== "x264" && !streamer.triedSoftwareFallback) {
            const label = getProfile(streamer.encoderId).label
            console.warn(`[RtmpStreamer] ${label} failed to start, falling back to software encoding`)
            streamer.triedSoftwareFallback = true
            streamer.encoderId = "x264"
            noticeListener?.(`${label} is unavailable — streaming with software encoding.`)
            this.respawnEncoder(streamer, streamer.inputSize, "Encoder restarted")
            return
        }

        // an encoder that ran for a long time before dying hit a transient fault, not a broken config
        if (uptime >= STABLE_AFTER_MS) {
            streamer.encoderBackoffMs = BACKOFF_START_MS
            streamer.encoderFailures = 0
        }

        streamer.encoderFailures++
        if (streamer.encoderFailures > ENCODER_MAX_CONSECUTIVE_FAILURES) {
            console.error(`[RtmpStreamer] Encoder for ${streamer.outputId} failed ${streamer.encoderFailures} times in a row, giving up`)
            noticeListener?.("Streaming stopped: the encoder failed repeatedly.")
            this.stop(streamer.outputId)
            return
        }

        const delay = streamer.encoderBackoffMs
        streamer.encoderBackoffMs = Math.min(delay * 2, BACKOFF_MAX_MS)
        console.log(`[RtmpStreamer] Restarting encoder for ${streamer.outputId} in ${delay}ms (attempt ${streamer.encoderFailures})`)

        streamer.encoderRestartTimer = setTimeout(() => {
            streamer.encoderRestartTimer = undefined
            if (!this.streamers.has(streamer.outputId) || !streamer.inputSize) return
            this.respawnEncoder(streamer, streamer.inputSize, "Encoder restarted")
        }, delay)
    }

    // ----- relays -----

    /** Add, remove and toggle destinations without restarting the encoder. */
    static syncDestinations(outputId: string, destinations: RtmpDestination[]) {
        const streamer = this.streamers.get(outputId)
        if (!streamer) return

        const wanted = new Map(destinations.filter((d) => d.enabled && d.url).map((d) => [d.id, d]))

        for (const [id, relay] of streamer.relays) {
            const next = wanted.get(id)
            if (!next || buildDestinationUrl(next) !== buildDestinationUrl(relay.destination)) {
                this.stopRelay(relay)
                streamer.relays.delete(id)
            }
        }

        for (const [id, destination] of wanted) {
            if (streamer.relays.has(id)) continue
            const relay: RelayInstance = { destination, process: null, state: "idle", startedAt: 0, backoffMs: BACKOFF_START_MS, stopped: false, restarts: 0 }
            streamer.relays.set(id, relay)
            if (streamer.encoder) this.spawnRelay(streamer, relay)
        }

        if (!streamer.relays.size) {
            console.log(`[RtmpStreamer] No enabled destinations left for ${outputId}, stopping.`)
            this.stop(outputId)
            return
        }

        this.pushStatus(outputId)
    }

    private static spawnRelay(streamer: StreamInstance, relay: RelayInstance) {
        if (relay.stopped || relay.process) return

        let child: ChildProcess
        try {
            child = spawn(streamer.ffmpegPath, buildRelayCommand(buildDestinationUrl(relay.destination)), {
                stdio: ["pipe", "ignore", "pipe"],
                windowsHide: true
            })
        } catch (err: any) {
            this.noteRelayIssue(relay, err?.message || "Could not start relay")
            this.setRelayState(streamer, relay, "error", err?.message || "Could not start relay")
            this.scheduleRelayRestart(streamer, relay)
            return
        }

        relay.process = child
        relay.startedAt = Date.now()
        this.setRelayState(streamer, relay, "connecting")

        child.stdin?.on("error", () => {})
        child.stderr?.on("data", (chunk: Buffer) => {
            const message = chunk.toString().trim()
            if (!message) return
            // kept separate from relay.error: ffmpeg emits warnings routinely on a healthy relay,
            // and surfacing those as a destination error would leave a red notice under a live dot
            relay.lastStderr = message.split("\n").pop()!.slice(0, 200)
            console.warn(`[RtmpStreamer:relay ${relay.destination.url}] ${message}`)
        })

        relay.liveTimer = setTimeout(() => {
            if (relay.process !== child || relay.stopped) return
            this.setRelayState(streamer, relay, "live")
        }, RELAY_LIVE_AFTER_MS)

        // spawn failures surface asynchronously and emit no "exit", so this must schedule its own retry
        child.on("error", (err) => {
            if (relay.process !== child) return
            this.clearRelayProcess(relay)
            if (relay.stopped || !this.streamers.has(streamer.outputId)) return
            console.error(`[RtmpStreamer] Relay "${relay.destination.url}" failed to start:`, err.message)
            this.noteRelayIssue(relay, err.message)
            this.setRelayState(streamer, relay, "error", err.message)
            this.scheduleRelayRestart(streamer, relay)
        })

        child.on("exit", (code) => {
            if (relay.process !== child) return
            const uptime = Date.now() - relay.startedAt
            this.clearRelayProcess(relay)
            if (relay.stopped || !this.streamers.has(streamer.outputId)) return

            // only a genuinely stable run forgives the backoff; a rejected stream key can take
            // several seconds to fail, which is longer than the "live" threshold
            if (uptime >= STABLE_AFTER_MS) relay.backoffMs = BACKOFF_START_MS

            console.log(`[RtmpStreamer] Relay "${relay.destination.url}" exited (code ${code}, up ${Math.round(uptime / 1000)}s), reconnecting...`)
            this.noteRelayIssue(relay, relay.lastStderr || `Connection dropped (exit ${code})`)
            this.setRelayState(streamer, relay, "reconnecting", relay.lastStderr)
            this.scheduleRelayRestart(streamer, relay)
        })
    }

    private static clearRelayProcess(relay: RelayInstance) {
        relay.process = null
        if (relay.liveTimer) clearTimeout(relay.liveTimer)
        relay.liveTimer = undefined
    }

    /**
     * Record an unplanned restart. Reconnects we initiate ourselves (an encoder respawn) are not
     * the destination's fault and deliberately do not go through here.
     */
    private static noteRelayIssue(relay: RelayInstance, reason?: string) {
        relay.restarts++
        if (reason) relay.lastIssue = reason
    }

    private static scheduleRelayRestart(streamer: StreamInstance, relay: RelayInstance) {
        if (relay.stopped || relay.restartTimer) return
        const delay = relay.backoffMs
        relay.backoffMs = Math.min(relay.backoffMs * 2, BACKOFF_MAX_MS)
        relay.restartTimer = setTimeout(() => {
            relay.restartTimer = undefined
            if (!this.streamers.has(streamer.outputId) || relay.stopped) return
            this.spawnRelay(streamer, relay)
        }, delay)
    }

    private static stopRelay(relay: RelayInstance) {
        relay.stopped = true
        if (relay.restartTimer) clearTimeout(relay.restartTimer)
        relay.restartTimer = undefined

        const child = relay.process
        this.clearRelayProcess(relay)
        if (!child) return

        child.removeAllListeners("exit")
        child.removeAllListeners("error")
        try {
            child.stdin?.end()
            child.kill("SIGTERM")
        } catch {}
    }

    /** Reconnect one relay without touching the encoder or the other destinations. */
    private static restartRelay(streamer: StreamInstance, relay: RelayInstance, reason: string, { resetBackoff = false } = {}) {
        const child = relay.process
        this.clearRelayProcess(relay)

        if (child) {
            child.removeAllListeners("exit")
            child.removeAllListeners("error")
            try {
                child.stdin?.end()
                child.kill("SIGTERM")
            } catch {}
        }

        // a reconnect we initiated is not the destination's fault, so it should not be penalised
        if (resetBackoff) relay.backoffMs = BACKOFF_START_MS
        else this.noteRelayIssue(relay, reason)

        this.setRelayState(streamer, relay, "reconnecting", reason)
        this.scheduleRelayRestart(streamer, relay)
    }

    private static fanOut(streamer: StreamInstance, chunk: Buffer) {
        const bufferCap = getRelayBufferCap(streamer.config.bitrate)
        for (const relay of streamer.relays.values()) {
            const stdin = relay.process?.stdin
            if (!stdin || stdin.destroyed) continue

            // dropping chunks would corrupt the bitstream, so a destination that cannot keep up is
            // restarted instead; flv resyncs on the next keyframe
            if (stdin.writableLength > bufferCap) {
                console.warn(`[RtmpStreamer] Destination "${relay.destination.url}" is too slow (buffered ${stdin.writableLength} bytes > cap ${bufferCap}), restarting relay`)
                this.restartRelay(streamer, relay, "Destination could not keep up")
                continue
            }

            stdin.write(chunk)
        }
    }

    // ----- inputs -----

    static updateFrame(outputId: string, buffer: Buffer, size: { width: number; height: number }) {
        const streamer = this.streamers.get(outputId)
        if (!streamer) return

        // -f rawvideo has no framing, so a buffer that disagrees with the declared -video_size would
        // silently shear the broadcast diagonally rather than fail
        const expected = size.width * size.height * 4
        if (buffer.length !== expected) {
            console.error(`[RtmpStreamer] Dropping frame for ${outputId}: got ${buffer.length} bytes, expected ${expected} for ${size.width}x${size.height}`)
            return
        }

        streamer.lastFrame = buffer

        if (!streamer.encoder) {
            // an encoder restart is already scheduled; do not race it
            if (streamer.encoderRestartTimer) return

            this.spawnEncoder(streamer, size)
            if (streamer.encoder) {
                for (const relay of streamer.relays.values()) this.spawnRelay(streamer, relay)
            }
            return
        }

        // the capture resolution changed under us, so the encoder's -video_size no longer matches
        if (streamer.inputSize && (streamer.inputSize.width !== size.width || streamer.inputSize.height !== size.height)) {
            console.log(`[RtmpStreamer] Capture size changed to ${size.width}x${size.height}, restarting encoder`)
            this.respawnEncoder(streamer, size, "Resolution changed")
        }
    }

    static updateAudio(outputId: string | undefined, buffer: Buffer, _sampleRate: number = 48000) {
        const writeToStreamer = (streamer: StreamInstance) => {
            if (!streamer || !streamer.config.enableAudio) return

            const audioStream = streamer.encoder?.stdio[3] as any
            if (!audioStream || audioStream.destroyed) return

            if (!streamer.hasReceivedFirstAudio) streamer.hasReceivedFirstAudio = true

            try {
                audioStream.write(buffer)
                if (streamer.audioStats) {
                    streamer.audioStats.totalBytes += buffer.length
                    streamer.audioStats.chunkCount++
                }
            } catch (err) {
                console.error(`[AudioDebug:${streamer.outputId}] Pipe write error:`, err)
            }
        }

        if (outputId) {
            const streamer = this.streamers.get(outputId)
            if (streamer) writeToStreamer(streamer)
        } else {
            for (const streamer of this.streamers.values()) {
                writeToStreamer(streamer)
            }
        }
    }

    // ----- status -----

    private static setRelayState(streamer: StreamInstance, relay: RelayInstance, state: RtmpDestinationState, error?: string) {
        relay.state = state
        // a healthy relay must never carry a stale error, or the UI shows a red notice under a green dot
        relay.error = state === "live" || state === "connecting" || state === "idle" ? undefined : error
        this.pushStatus(streamer.outputId)
    }

    static getStatus(outputId: string): RtmpStatus {
        const streamer = this.streamers.get(outputId)
        if (!streamer) return {}

        const status: RtmpStatus = {}
        for (const [id, relay] of streamer.relays) {
            status[id] = {
                state: relay.state,
                ...(relay.error ? { error: relay.error } : {}),
                ...(relay.restarts ? { restarts: relay.restarts, ...(relay.lastIssue ? { lastIssue: relay.lastIssue } : {}) } : {})
            }
        }
        return status
    }

    private static pushStatus(outputId: string) {
        if (this.statusTimers.has(outputId)) return
        this.statusTimers.set(
            outputId,
            setTimeout(() => {
                this.statusTimers.delete(outputId)
                if (!this.streamers.has(outputId)) return
                statusListener?.(outputId, this.getStatus(outputId))
            }, STATUS_PUSH_INTERVAL_MS)
        )
    }
}

// HELPERS

/** Destination changes are relay-only; anything here means the encoder has to be respawned. */
function configRequiresRestart(prev: StreamConfig, next: StreamConfig): boolean {
    return prev.width !== next.width || prev.height !== next.height || prev.fps !== next.fps || prev.bitrate !== next.bitrate || prev.enableAudio !== next.enableAudio || prev.encoder !== next.encoder
}

function buildDestinationUrl(destination: { url: string; key: string }): string {
    // remove trailing slashes
    const url = destination.url.replace(/\/+$/, "")
    return destination.key ? `${url}/${destination.key}` : url
}
