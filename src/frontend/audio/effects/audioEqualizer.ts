import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface EQBand {
    frequency: number
    gain: number // -24 to +24 dB
    type?: BiquadFilterType
    q?: number
    label?: string
}

export type BandConfig = EQBand

export interface EqualizerConfig {
    enabled: boolean
    bands: EQBand[]
}

export const DEFAULT_EQUALIZER_CONFIG: EqualizerConfig = {
    enabled: true,
    bands: [
        { frequency: 60, gain: 0, q: 1.0, type: "lowshelf" },
        { frequency: 170, gain: 0, q: 1.0, type: "peaking" },
        { frequency: 500, gain: 0, q: 1.0, type: "peaking" },
        { frequency: 1500, gain: 0, q: 1.0, type: "peaking" },
        { frequency: 4500, gain: 0, q: 1.0, type: "peaking" },
        { frequency: 12000, gain: 0, q: 1.0, type: "highshelf" }
    ]
}

export const EqualizerCalculations = {
    calculateBandResponse(band: EQBand, frequency: number): number {
        if (band.gain === 0) return 0

        const f0 = band.frequency
        const Q = Math.max(0.1, band.q ?? 1.0)
        const gain = band.gain
        const ratio = frequency / f0

        if (band.type === "highshelf" || band.type === "lowshelf") {
            // Standard smooth shelf frequency response curve
            const octaveDiff = Math.log2(ratio)
            const slope = 1 / Q

            // Sigmoid transition around cutoff frequency
            const transition = 1 / (1 + Math.exp((band.type === "highshelf" ? octaveDiff : -octaveDiff) / (slope * 0.5)))
            const response = gain * (1 - transition)

            return Math.max(-24, Math.min(24, response))
        }

        // Standard Peaking filter
        const octaveDiff = Math.abs(Math.log2(ratio))
        const bandwidth = 1 / Q
        const response = gain * Math.exp(-Math.pow(octaveDiff / bandwidth, 2))

        return Math.max(-24, Math.min(24, response))
    },

    calculateCombinedResponse(bands: EQBand[], frequency: number): number {
        let totalGain = 0
        for (const band of bands) {
            totalGain += this.calculateBandResponse(band, frequency)
        }
        return Math.max(-24, Math.min(24, totalGain))
    }
}

export class AudioEqualizer {
    readonly input: GainNode
    readonly output: GainNode
    private filters: BiquadFilterNode[] = []
    private dryGain: GainNode
    private wetGain: GainNode
    private ac: AudioContext
    private config: EqualizerConfig

    constructor(ac: AudioContext, config: EqualizerConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.dryGain = ac.createGain()
        this.wetGain = ac.createGain()

        this.input.connect(this.dryGain).connect(this.output)
        this.rebuildFilters()
    }

    static getDefaultBands(): EQBand[] {
        return DEFAULT_EQUALIZER_CONFIG.bands.map((band) => ({ ...band }))
    }

    private rebuildFilters() {
        safelyDisconnect(...this.filters)
        this.filters = []

        if (!this.config.bands || this.config.bands.length === 0) {
            this.input.connect(this.wetGain).connect(this.output)
            this.applyGains()
            return
        }

        this.filters = this.config.bands.map((band, idx) => {
            const filter = this.ac.createBiquadFilter()
            const defaultType = idx === 0 ? "lowshelf" : idx === this.config.bands.length - 1 ? "highshelf" : "peaking"
            filter.type = band.type || defaultType

            // Set initial params immediately
            const t = this.ac.currentTime
            filter.frequency.setValueAtTime(band.frequency, t)
            filter.gain.setValueAtTime(band.gain, t)
            filter.Q.setValueAtTime(band.q ?? 1.0, t)
            return filter
        })

        // Connect chain without breaking graph in real-time updates
        let current: AudioNode = this.input
        for (const filter of this.filters) {
            current.connect(filter)
            current = filter
        }
        current.connect(this.wetGain).connect(this.output)

        this.applyGains()
    }

    private applyGains() {
        const t = Number.isFinite(this.ac.currentTime) ? this.ac.currentTime : 0
        const timeConstant = 0.015 // Smooth transition constant (15ms)
        const enabled = Boolean(this.config.enabled)

        this.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, t, timeConstant)
        this.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, t, timeConstant)
    }

    updateConfig(config: Partial<EqualizerConfig>) {
        const newBands = config.bands
        const bandsCountChanged = newBands && newBands.length !== this.filters.length

        this.config = { ...this.config, ...config }

        // Rebuild the audio node graph if count changed
        if (bandsCountChanged) {
            this.rebuildFilters()
            return
        }

        // Smooth parameter updates for frequency, Q, gain, and filter type
        const t = this.ac.currentTime
        const tc = 0.015 // 15ms exponential smoothing constant

        this.config.bands.forEach((band, i) => {
            const filter = this.filters[i]
            if (filter) {
                if (band.type && filter.type !== band.type) filter.type = band.type

                const gain = Number.isFinite(band.gain) ? band.gain : 0
                const freq = Math.max(20, Math.min(20000, band.frequency || 1000))
                const q = Math.max(0.1, band.q ?? 1.0)

                filter.gain.setTargetAtTime(gain, t, tc)
                filter.frequency.setTargetAtTime(freq, t, tc)
                filter.Q.setTargetAtTime(q, t, tc)
            }
        })

        this.applyGains()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): EqualizerConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, ...this.filters, this.dryGain, this.wetGain, this.output)
    }
}

const integration = createEffectIntegration("equalizer", DEFAULT_EQUALIZER_CONFIG, AudioEqualizer)

export const initializeEqualizer = integration.initialize
export const updateEqualizerConfig = integration.updateConfig
export const setEqualizerEnabled = integration.setEnabled

export function updateEqualizerBands(bands: EQBand[], channelId?: string, effectId?: string) {
    updateEqualizerConfig({ bands }, channelId, effectId)
}
