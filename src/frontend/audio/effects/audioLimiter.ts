// Audio Limiter Engine & Integration
// Brick-wall limiter using the Web Audio API DynamicsCompressorNode
// Fixed ratio (20:1) and attack (1 ms) — user controls ceiling and release only.

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export interface LimiterConfig {
    enabled: boolean
    ceiling: number // -30 to 0 dB, default -3 dB
    release: number // 0 to 1 s, default 0.05 s
}

export const DEFAULT_LIMITER_CONFIG: LimiterConfig = {
    enabled: false,
    ceiling: -3,
    release: 0.05
}

const LIMITER_RATIO = 20 // max DynamicsCompressorNode ratio (effectively ∞)
const LIMITER_ATTACK = 0.001 // 1 ms fixed attack

export class AudioLimiter {
    readonly input: GainNode
    readonly output: GainNode
    private compressor: DynamicsCompressorNode
    private ac: AudioContext
    private config: LimiterConfig

    constructor(ac: AudioContext, config: LimiterConfig) {
        this.ac = ac
        this.config = { ...config }

        this.input = ac.createGain()
        this.output = ac.createGain()
        this.compressor = ac.createDynamicsCompressor()

        // Keep node always in chain; bypass = ratio:1, threshold:0
        this.input.connect(this.compressor)
        this.compressor.connect(this.output)

        if (config.enabled) {
            this.applyParams(config)
        } else {
            this.applyBypass()
        }
    }

    private applyParams(config: LimiterConfig) {
        const t = this.ac.currentTime
        this.compressor.threshold.setValueAtTime(config.ceiling, t)
        this.compressor.knee.setValueAtTime(0, t)
        this.compressor.ratio.setValueAtTime(LIMITER_RATIO, t)
        this.compressor.attack.setValueAtTime(LIMITER_ATTACK, t)
        this.compressor.release.setValueAtTime(Math.max(0.001, config.release), t)
    }

    private applyBypass() {
        const t = this.ac.currentTime
        this.compressor.threshold.setValueAtTime(0, t)
        this.compressor.knee.setValueAtTime(0, t)
        this.compressor.ratio.setValueAtTime(1, t)
        this.compressor.attack.setValueAtTime(0, t)
        this.compressor.release.setValueAtTime(0.25, t)
    }

    updateConfig(config: Partial<LimiterConfig>) {
        this.config = { ...this.config, ...config }
        if (this.config.enabled) {
            this.applyParams(this.config)
        } else {
            this.applyBypass()
        }
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        if (enabled) {
            this.applyParams(this.config)
        } else {
            this.applyBypass()
        }
    }

    get reduction(): number {
        return this.compressor.reduction
    }

    getConfig(): LimiterConfig {
        return { ...this.config }
    }

    dispose() {
        try {
            this.input.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.compressor.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.output.disconnect()
        } catch {
            /* already disconnected */
        }
    }
}

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

let globalLimiter: AudioLimiter | null = null

export function initializeLimiter(ac: AudioContext): AudioLimiter {
    if (globalLimiter) return globalLimiter

    globalLimiter = new AudioLimiter(ac, getEffectConfig("limiter", DEFAULT_LIMITER_CONFIG))
    subscribeEffect("limiter", (cfg: LimiterConfig) => globalLimiter?.updateConfig(cfg))

    return globalLimiter
}

export function updateLimiterConfig(partial: Partial<LimiterConfig>) {
    updateEffectInStore("limiter", DEFAULT_LIMITER_CONFIG, partial, globalLimiter)
}

export function setLimiterEnabled(enabled: boolean) {
    setEffectEnabledInStore("limiter", DEFAULT_LIMITER_CONFIG, enabled, globalLimiter)
}

export function getLimiterReduction(): number {
    return globalLimiter?.reduction ?? 0
}
