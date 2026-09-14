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
    enabled: false,
    bands: [
        { frequency: 60, gain: 0, type: "lowshelf", q: 1, label: "60Hz" },
        { frequency: 250, gain: 0, type: "peaking", q: 1, label: "250Hz" },
        { frequency: 1000, gain: 0, type: "peaking", q: 1, label: "1k" },
        { frequency: 4000, gain: 0, type: "peaking", q: 1, label: "4k" },
        { frequency: 12000, gain: 0, type: "highshelf", q: 1, label: "12k" }
    ]
}

export const EqualizerCalculations = {
    calculateBandResponse(band: EQBand, frequency: number): number {
        if (band.gain === 0 && band.type !== "lowpass" && band.type !== "highpass") return 0

        const f0 = band.frequency
        const Q = band.q ?? 1.0
        const gain = band.gain

        if (band.type === "lowpass") {
            if (frequency <= f0) return 0
            const octaves = Math.log2(frequency / f0)
            return Math.max(-24, -12 * octaves)
        }

        if (band.type === "highpass") {
            if (frequency >= f0) return 0
            const octaves = Math.log2(f0 / frequency)
            return Math.max(-24, -12 * octaves)
        }

        const octaveDiff = Math.abs(Math.log2(frequency / f0))
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
        const t = this.ac.currentTime
        const timeConstant = 0.015 // Smooth transition constant (15ms)
        const enabled = this.config.enabled

        this.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, t, timeConstant)
        this.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, t, timeConstant)
    }

    updateConfig(config: Partial<EqualizerConfig>) {
        const newBands = config.bands
        const bandsCountChanged = newBands && newBands.length !== this.filters.length

        // Check if filter types changed (requires graph rebuild)
        const typesChanged = newBands && newBands.some((b, i) => this.filters[i] && b.type && b.type !== this.filters[i].type)

        this.config = { ...this.config, ...config }

        // Only tear down and rebuild audio nodes IF structural topology changed
        if (bandsCountChanged || typesChanged) {
            this.rebuildFilters()
            return
        }

        // SMOOTH PARAMETER UPDATES (No stutter or audio dropouts!)
        const t = this.ac.currentTime
        const tc = 0.015 // 15ms exponential smoothing constant

        this.config.bands.forEach((band, i) => {
            const filter = this.filters[i]
            if (filter) {
                filter.gain.setTargetAtTime(band.gain, t, tc)
                filter.frequency.setTargetAtTime(Math.max(20, Math.min(20000, band.frequency)), t, tc)
                filter.Q.setTargetAtTime(Math.max(0.1, band.q ?? 1.0), t, tc)
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
