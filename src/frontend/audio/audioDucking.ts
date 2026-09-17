import { get } from "svelte/store"
import { audioRouting, channelDuckingMultipliers } from "../stores"
import { AudioInputCapture } from "./routing/audioInputCapture"
import { AudioRoutingManager } from "./routing/audioRoutingManager"
import { dbToGain, MIN_DB } from "./dBUtils"

interface ChannelState {
    reductionDb: number       // 0 dB (no ducking) down to -48 dB
    targetReductionDb: number // target reduction in dB
    holdUntil: number
    samples: { time: number; db: number }[]
}

export class AudioDucking {
    private static instance: AudioDucking
    public static getInstance(): AudioDucking {
        return (AudioDucking.instance ??= new AudioDucking())
    }

    private running = false
    private loopId: number | null = null
    private lastTickTime = 0
    private channels = new Map<string, ChannelState>()

    // Ducking parameters in dB
    // Input scale: -36 dB to 0 dB maps linearly to 0 dB down to MAX_ATTENUATION_DB (-48 dB)
    private static readonly THRESHOLD_DB = -36     // -36 dB input threshold (0 dB reduction)
    private static readonly FULL_DUCK_DB = 0       // 0 dB input -> max reduction (-48 dB)
    private static readonly MAX_ATTENUATION_DB = -48 // Max reduction level in dB

    // Timing in milliseconds
    private static readonly HOLD_UP_MS = 600
    private static readonly WINDOW_MS = 250

    // Smooth rates in dB per second
    // Attack: 60 dB/s -> smooth ~800ms to reach full -48 dB duck
    private static readonly ATTACK_RATE_DB_PER_SEC = 60
    // Release: 20 dB/s -> gentle ~2.4s recovery back to 0 dB
    private static readonly RELEASE_RATE_DB_PER_SEC = 20

    private constructor() {
        audioRouting.subscribe((config) => {
            const hasDucking = (config?.connections || []).some((c) => c.type === "ducking")
            if (hasDucking) this.start()
            else this.stop()
        })
    }

    public start() {
        if (this.running) return
        this.running = true
        this.lastTickTime = performance.now()
        this.loopId = requestAnimationFrame(this.tick)
    }

    public stop() {
        this.running = false
        if (this.loopId !== null) {
            cancelAnimationFrame(this.loopId)
            this.loopId = null
        }
        if (this.channels.size > 0) {
            this.channels.clear()
            channelDuckingMultipliers.set({})
            AudioRoutingManager.getInstance().setChannelDucking(new Map())
        }
    }

    private tick = (now: number) => {
        if (!this.running) return

        const connections = get(audioRouting)?.connections || []
        const duckingConns = connections.filter((c) => c.type === "ducking")

        if (duckingConns.length === 0) {
            this.stop()
            return
        }

        const dtSec = Math.min(0.1, Math.max(0.001, (now - this.lastTickTime) / 1000))
        this.lastTickTime = now

        // Map target channels to their ducking input source IDs
        const channelSources = new Map<string, string[]>()
        for (const { from, to } of duckingConns) {
            let list = channelSources.get(to)
            if (!list) channelSources.set(to, (list = []))
            list.push(from)
        }

        const inputCapture = AudioInputCapture.getInstance()

        // Prune removed channels
        for (const id of this.channels.keys()) {
            if (!channelSources.has(id)) this.channels.delete(id)
        }

        const multipliersMap = new Map<string, number>()
        const multipliersObj: Record<string, number> = {}

        for (const [channelId, sourceIds] of channelSources.entries()) {
            let state = this.channels.get(channelId)
            if (!state) {
                state = { reductionDb: 0, targetReductionDb: 0, holdUntil: 0, samples: [] }
                this.channels.set(channelId, state)
            }

            // Get max peak dB among input sources
            let maxDb = MIN_DB
            for (const srcId of sourceIds) {
                const db = inputCapture.getVisualizerData(srcId)?.db
                if (typeof db === "number" && db > maxDb) maxDb = db
            }

            // Rolling window averaging
            state.samples.push({ time: now, db: maxDb })
            const cutoff = now - AudioDucking.WINDOW_MS
            while (state.samples.length > 0 && state.samples[0].time < cutoff) {
                state.samples.shift()
            }

            let sumPower = 0
            for (const s of state.samples) {
                sumPower += s.db <= MIN_DB ? 0 : Math.pow(10, s.db / 20)
            }
            const avgPower = sumPower / state.samples.length
            const avgDb = avgPower > 0.00001 ? 20 * Math.log10(avgPower) : MIN_DB

            // Calculate target reduction directly in dB (MIN_DB (-60 dB) = 0 dB reduction, 0 dB = -48 dB reduction)
            let computedReductionDb = 0
            if (avgDb > AudioDucking.THRESHOLD_DB) {
                const ratio = Math.min(1.0, Math.max(0.0, (avgDb - AudioDucking.THRESHOLD_DB) / (AudioDucking.FULL_DUCK_DB - AudioDucking.THRESHOLD_DB)))
                computedReductionDb = ratio * AudioDucking.MAX_ATTENUATION_DB
            }

            // Duck deeper immediately when louder; enforce hold timer before rising
            if (computedReductionDb < state.targetReductionDb) {
                state.targetReductionDb = computedReductionDb
                state.holdUntil = now + AudioDucking.HOLD_UP_MS
            } else if (now < state.holdUntil) {
                state.targetReductionDb = Math.min(state.targetReductionDb, computedReductionDb)
            } else {
                state.targetReductionDb = computedReductionDb
            }

            // Smooth in dB domain at constant dB/sec rate
            if (state.targetReductionDb < state.reductionDb) {
                // Attack: ducking down (more negative dB)
                state.reductionDb = Math.max(state.targetReductionDb, state.reductionDb - AudioDucking.ATTACK_RATE_DB_PER_SEC * dtSec)
            } else if (now >= state.holdUntil && state.reductionDb < state.targetReductionDb) {
                // Release: fading up (less negative dB)
                state.reductionDb = Math.min(state.targetReductionDb, state.reductionDb + AudioDucking.RELEASE_RATE_DB_PER_SEC * dtSec)
            }

            if (state.targetReductionDb === 0 && state.reductionDb >= -0.1) {
                state.reductionDb = 0
            }

            // Convert to linear gain multiplier for Web Audio & stores
            const linearMult = state.reductionDb <= AudioDucking.MAX_ATTENUATION_DB ? dbToGain(AudioDucking.MAX_ATTENUATION_DB) : dbToGain(state.reductionDb)
            multipliersMap.set(channelId, linearMult)
            multipliersObj[channelId] = linearMult
        }

        channelDuckingMultipliers.set(multipliersObj)
        AudioRoutingManager.getInstance().setChannelDucking(multipliersMap)

        this.loopId = requestAnimationFrame(this.tick)
    }
}
