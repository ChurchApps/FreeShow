// Audio Filter Engine & Integration
// Configurable BiquadFilter: lowpass, highpass, bandpass, notch, peaking, lowshelf, highshelf.
// Uses a wet/dry split for clean bypass (dry=1/wet=0 when disabled).

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch" | "peaking" | "lowshelf" | "highshelf"

export interface FilterConfig {
    enabled: boolean
    type: FilterType
    frequency: number // 20–20 000 Hz, default 1000
    q: number // 0.1–30,        default 1.0
    gain: number // −24 to +24 dB, default 0  (peaking / shelf types only)
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
    enabled: false,
    type: "lowpass",
    frequency: 1000,
    q: 1.0,
    gain: 0
}

/** Filter types that expose the gain parameter in the UI */
export const GAIN_FILTER_TYPES: FilterType[] = ["peaking", "lowshelf", "highshelf"]

export class AudioFilter {
    readonly input: GainNode
    readonly output: GainNode
    private filter: BiquadFilterNode
    private dryGain: GainNode
    private wetGain: GainNode
    private ac: AudioContext
    private config: FilterConfig

    constructor(ac: AudioContext, config: FilterConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.dryGain = ac.createGain()
        this.wetGain = ac.createGain()
        this.filter = ac.createBiquadFilter()

        // Dry path: input → dry → output
        this.input.connect(this.dryGain)
        this.dryGain.connect(this.output)

        // Wet path: input → filter → wet → output
        this.input.connect(this.filter)
        this.filter.connect(this.wetGain)
        this.wetGain.connect(this.output)

        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const { enabled, type, frequency, q, gain } = this.config

        this.filter.type = type
        this.filter.frequency.setValueAtTime(Math.max(20, Math.min(20000, frequency)), t)
        this.filter.Q.setValueAtTime(Math.max(0.0001, q), t)
        this.filter.gain.setValueAtTime(gain, t)

        this.dryGain.gain.setValueAtTime(enabled ? 0 : 1, t)
        this.wetGain.gain.setValueAtTime(enabled ? 1 : 0, t)
    }

    updateConfig(config: Partial<FilterConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        this.applyParams()
    }

    getConfig(): FilterConfig {
        return { ...this.config }
    }

    dispose() {
        for (const node of [this.input, this.filter, this.dryGain, this.wetGain, this.output]) {
            try {
                node.disconnect()
            } catch {
                /* already disconnected */
            }
        }
    }
}

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

let globalFilter: AudioFilter | null = null

export function initializeFilter(ac: AudioContext): AudioFilter {
    if (globalFilter) return globalFilter

    globalFilter = new AudioFilter(ac, getEffectConfig("filter", DEFAULT_FILTER_CONFIG))
    subscribeEffect("filter", (cfg: FilterConfig) => globalFilter?.updateConfig(cfg))

    return globalFilter
}

export function updateFilterConfig(partial: Partial<FilterConfig>) {
    updateEffectInStore("filter", DEFAULT_FILTER_CONFIG, partial, globalFilter)
}

export function setFilterEnabled(enabled: boolean) {
    setEffectEnabledInStore("filter", DEFAULT_FILTER_CONFIG, enabled, globalFilter)
}
