// Audio Delay Engine & Integration
// Tap-delay echo effect using DelayNode with a feedback loop and wet/dry mix.

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export interface DelayConfig {
    enabled: boolean
    delayTime: number // 0.01 to 2 s,  default 0.5
    feedback: number // 0 to 0.95,    default 0.3
    wet: number // 0 to 1,       default 0.3
}

export const DEFAULT_DELAY_CONFIG: DelayConfig = {
    enabled: false,
    delayTime: 0.5,
    feedback: 0.3,
    wet: 0.3
}

export class AudioDelay {
    readonly input: GainNode
    readonly output: GainNode
    private delayNode: DelayNode
    private feedbackGain: GainNode
    private dryGain: GainNode
    private wetGain: GainNode
    private ac: AudioContext
    private config: DelayConfig

    constructor(ac: AudioContext, config: DelayConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.delayNode = ac.createDelay(2.0)
        this.feedbackGain = ac.createGain()
        this.dryGain = ac.createGain()
        this.wetGain = ac.createGain()

        // Dry:      input → dry → output
        // Wet:      input → delay → wet → output
        // Feedback: delay → feedback → delay  (loop)
        this.input.connect(this.dryGain)
        this.dryGain.connect(this.output)
        this.input.connect(this.delayNode)
        this.delayNode.connect(this.wetGain)
        this.wetGain.connect(this.output)
        this.delayNode.connect(this.feedbackGain)
        this.feedbackGain.connect(this.delayNode)

        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const wet = this.config.enabled ? this.config.wet : 0
        this.delayNode.delayTime.setValueAtTime(this.config.delayTime, t)
        this.feedbackGain.gain.setValueAtTime(Math.min(0.95, this.config.feedback), t)
        this.dryGain.gain.setValueAtTime(1, t)
        this.wetGain.gain.setValueAtTime(wet, t)
    }

    updateConfig(config: Partial<DelayConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        this.applyParams()
    }

    getConfig(): DelayConfig {
        return { ...this.config }
    }

    dispose() {
        try {
            this.input.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.delayNode.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.feedbackGain.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.dryGain.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.wetGain.disconnect()
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

let globalDelay: AudioDelay | null = null

export function initializeDelay(ac: AudioContext): AudioDelay {
    if (globalDelay) return globalDelay

    globalDelay = new AudioDelay(ac, getEffectConfig("delay", DEFAULT_DELAY_CONFIG))
    subscribeEffect("delay", (cfg: DelayConfig) => globalDelay?.updateConfig(cfg))

    return globalDelay
}

export function updateDelayConfig(partial: Partial<DelayConfig>) {
    updateEffectInStore("delay", DEFAULT_DELAY_CONFIG, partial, globalDelay)
}

export function setDelayEnabled(enabled: boolean) {
    setEffectEnabledInStore("delay", DEFAULT_DELAY_CONFIG, enabled, globalDelay)
}
