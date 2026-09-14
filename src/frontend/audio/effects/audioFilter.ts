import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch" | "peaking" | "lowshelf" | "highshelf"

export interface FilterConfig {
    enabled: boolean
    type: FilterType
    frequency: number
    q: number
    gain: number
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = { enabled: false, type: "lowpass", frequency: 1000, q: 1.0, gain: 0 }

// Required by AudioFilter.svelte to show/hide the gain slider reactively
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

        this.input.connect(this.dryGain).connect(this.output)
        this.input.connect(this.filter).connect(this.wetGain).connect(this.output)

        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const tc = 0.015 // 15ms smoothing constant to eliminate audio clicks during slider drags
        const { enabled, type, frequency, q, gain } = this.config

        if (this.filter.type !== type) {
            this.filter.type = type
        }

        this.filter.frequency.setTargetAtTime(Math.max(20, Math.min(20000, frequency)), t, tc)
        this.filter.Q.setTargetAtTime(Math.max(0.0001, q), t, tc)
        this.filter.gain.setTargetAtTime(gain, t, tc)

        this.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, t, tc)
        this.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, t, tc)
    }

    updateConfig(config: Partial<FilterConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): FilterConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, this.filter, this.dryGain, this.wetGain, this.output)
    }
}

const integration = createEffectIntegration("filter", DEFAULT_FILTER_CONFIG, AudioFilter)
export const initializeFilter = integration.initialize
export const updateFilterConfig = integration.updateConfig
export const setFilterEnabled = integration.setEnabled
