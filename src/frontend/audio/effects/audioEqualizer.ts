// Audio Equalizer Engine & Integration
// Handles EQ band calculations, Web Audio API integration, and Svelte store management

import { get } from "svelte/store"
import { activeAudioEffects, audioEffects } from "../../stores"
import { setEffectEnabledInStore } from "./audioEffectsHelpers"

export interface EQBand {
    frequency: number
    gain: number // in dB (-24 to +24)
    q: number // quality factor (steepness) (0.1 to 30)
    type: "highpass" | "lowpass" | "peaking"
    label: string
}

export interface EqualizerConfig {
    bands: EQBand[]
    enabled: boolean
}

export class AudioEqualizer {
    private audioContext: AudioContext | null = null
    private inputGainNode: GainNode | null = null
    private outputGainNode: GainNode | null = null
    private filterNodes: BiquadFilterNode[] = []
    private config: EqualizerConfig

    constructor(config?: EqualizerConfig) {
        this.config = config || {
            enabled: true,
            bands: AudioEqualizer.getDefaultBands()
        }
    }

    // Default 6-band EQ configuration
    static getDefaultBands(): EQBand[] {
        return [
            { frequency: 60, gain: 0, q: 0.7, type: "lowpass", label: "60Hz" },
            { frequency: 150, gain: 0, q: 0.7, type: "peaking", label: "150Hz" },
            { frequency: 400, gain: 0, q: 0.7, type: "peaking", label: "400Hz" },
            { frequency: 1000, gain: 0, q: 0.7, type: "peaking", label: "1kHz" },
            { frequency: 2500, gain: 0, q: 0.7, type: "peaking", label: "2.5kHz" },
            { frequency: 6300, gain: 0, q: 0.7, type: "highpass", label: "6.3kHz" }
        ]
    }

    // Initialize the equalizer with Web Audio API
    public initialize(ac: AudioContext) {
        this.audioContext = ac

        // Create input and output gain nodes
        this.inputGainNode = ac.createGain()
        this.outputGainNode = ac.createGain()

        // Create filter nodes for each band
        this.createFilterNodes()

        // Connect the filter chain
        this.connectFilters()
    }

    private createFilterNodes() {
        if (!this.audioContext) return

        this.filterNodes = []

        this.config.bands.forEach((band) => {
            const filter = this.audioContext!.createBiquadFilter()
            this.updateFilterFromBand(filter, band)
            this.filterNodes.push(filter)
        })
    }

    private updateFilterFromBand(filter: BiquadFilterNode, band: EQBand) {
        if (!this.audioContext) return

        const currentTime = this.audioContext.currentTime

        // Use peaking filters for all bands to allow proper gain control
        filter.type = "peaking"

        // Set frequency
        filter.frequency.setValueAtTime(band.frequency, currentTime)

        // Adjust Q factor based on filter type for different characteristics
        let qValue = band.q
        if (band.type === "highpass" || band.type === "lowpass") {
            qValue = Math.max(0.5, band.q * 0.8)
        }
        filter.Q.setValueAtTime(qValue, currentTime)

        // Set gain for all filter types - respect enabled state
        const effectiveGain = this.config.enabled ? band.gain : 0
        filter.gain.setValueAtTime(effectiveGain, currentTime)
    }

    public connectFilters() {
        if (!this.inputGainNode || !this.outputGainNode) return

        this.inputGainNode.disconnect()
        for (const filter of this.filterNodes) {
            filter.disconnect()
        }

        if (this.filterNodes.length === 0) {
            this.inputGainNode.connect(this.outputGainNode)
            return
        }

        // Connect input -> first filter
        this.inputGainNode.connect(this.filterNodes[0])

        // Connect filters in series
        for (let i = 0; i < this.filterNodes.length - 1; i++) {
            this.filterNodes[i].connect(this.filterNodes[i + 1])
        }

        // Connect last filter -> output
        this.filterNodes[this.filterNodes.length - 1].connect(this.outputGainNode)
    }

    public getNodes(): { input: GainNode; output: GainNode } | null {
        if (!this.inputGainNode || !this.outputGainNode) return null
        return { input: this.inputGainNode, output: this.outputGainNode }
    }

    public updateBands(bands: EQBand[]) {
        this.config.bands = [...bands]

        if (this.audioContext) {
            const currentTime = this.audioContext.currentTime

            bands.forEach((band, index) => {
                if (this.filterNodes[index]) {
                    const filter = this.filterNodes[index]
                    filter.frequency.cancelScheduledValues(currentTime)
                    filter.Q.cancelScheduledValues(currentTime)
                    filter.gain.cancelScheduledValues(currentTime)
                    this.updateFilterFromBand(filter, band)
                }
            })
        }
    }

    public updateBand(bandIndex: number, band: EQBand) {
        if (bandIndex < 0 || bandIndex >= this.config.bands.length) return
        this.config.bands[bandIndex] = { ...band }

        if (this.filterNodes[bandIndex]) {
            this.updateFilterFromBand(this.filterNodes[bandIndex], band)
        }
    }

    public setBandGain(bandIndex: number, gain: number) {
        if (bandIndex < 0 || bandIndex >= this.config.bands.length || !this.audioContext) return
        this.config.bands[bandIndex].gain = gain

        if (this.filterNodes[bandIndex]) {
            const effectiveGain = this.config.enabled ? gain : 0
            const currentTime = this.audioContext.currentTime
            this.filterNodes[bandIndex].gain.setValueAtTime(effectiveGain, currentTime)
        }
    }

    public setEnabled(enabled: boolean) {
        const wasEnabled = this.config.enabled
        this.config.enabled = enabled

        if (wasEnabled !== enabled && this.audioContext) {
            const currentTime = this.audioContext.currentTime
            this.filterNodes.forEach((filter, index) => {
                if (filter && this.config.bands[index]) {
                    const effectiveGain = enabled ? this.config.bands[index].gain : 0
                    filter.gain.cancelScheduledValues(currentTime)
                    filter.gain.setValueAtTime(effectiveGain, currentTime)
                }
            })
        }
    }

    public getConfig(): EqualizerConfig {
        return { ...this.config }
    }

    public reset() {
        this.config.bands = AudioEqualizer.getDefaultBands()
        this.updateBands(this.config.bands)
    }

    public dispose() {
        this.filterNodes.forEach((node) => {
            try {
                node.disconnect()
            } catch (err) {}
        })

        if (this.inputGainNode) {
            try {
                this.inputGainNode.disconnect()
            } catch (err) {}
        }

        if (this.outputGainNode) {
            try {
                this.outputGainNode.disconnect()
            } catch (err) {}
        }

        this.filterNodes = []
        this.inputGainNode = null
        this.outputGainNode = null
        this.audioContext = null
    }
}

// Utility functions for EQ calculations (for visualization)
export class EqualizerCalculations {
    static calculateBandResponse(band: EQBand, frequency: number): number {
        const centerFreq = band.frequency
        const gain = band.gain
        const q = band.q

        if (band.type === "peaking") {
            const ratio = frequency / centerFreq
            const logRatio = Math.log2(ratio)
            const bandwidth = 1 / q
            return gain / (1 + Math.pow((2 * logRatio) / bandwidth, 2))
        } else if (band.type === "highpass") {
            const ratio = frequency / centerFreq
            const order = Math.max(1, q)
            const filterResponse = 1 / (1 + Math.pow(ratio, 2 * order))
            return gain * (1 - filterResponse)
        } else if (band.type === "lowpass") {
            const ratio = frequency / centerFreq
            const order = Math.max(1, q)
            const filterResponse = Math.pow(ratio, 2 * order) / (1 + Math.pow(ratio, 2 * order))
            return gain * (1 - filterResponse)
        }

        return 0
    }

    static calculateCombinedResponse(bands: EQBand[], frequency: number): number {
        let totalGain = 0
        bands.forEach((band) => {
            totalGain += this.calculateBandResponse(band, frequency)
        })
        return Math.max(-30, Math.min(30, totalGain))
    }

    static generateResponseCurve(bands: EQBand[], numPoints = 300, minFreq = 20, maxFreq = 20000): { frequency: number; response: number }[] {
        const points: { frequency: number; response: number }[] = []
        for (let i = 0; i <= numPoints; i++) {
            const logMin = Math.log10(minFreq)
            const logMax = Math.log10(maxFreq)
            const logFreq = logMin + (i / numPoints) * (logMax - logMin)
            const frequency = Math.pow(10, logFreq)
            const response = this.calculateCombinedResponse(bands, frequency)
            points.push({ frequency, response })
        }
        return points
    }
}

// ============================================================================
// STORE HELPERS
// ============================================================================

export const DEFAULT_EQUALIZER_CONFIG: EqualizerConfig = {
    enabled: false,
    bands: AudioEqualizer.getDefaultBands()
}

export function updateEqualizerBands(bands: EQBand[], channelId?: string) {
    const target = channelId || get(activeAudioEffects) || "main"
    audioEffects.update((all) => {
        const channelConfig = all[target] || {}
        return { ...all, [target]: { ...channelConfig, equalizer: { ...channelConfig?.equalizer, bands: [...bands] } } as any }
    })
}

export function updateEqualizerBandGain(bandIndex: number, gain: number, channelId?: string) {
    const target = channelId || get(activeAudioEffects) || "main"
    audioEffects.update((all) => {
        const channelConfig = all[target] || {}
        const config = channelConfig?.equalizer ?? { enabled: false, bands: AudioEqualizer.getDefaultBands() }
        const newBands = [...config.bands]
        if (newBands[bandIndex]) {
            newBands[bandIndex].gain = gain
        }
        return { ...all, [target]: { ...channelConfig, equalizer: { ...config, bands: newBands } } as any }
    })
}

export function updateEqualizerBand(bandIndex: number, band: EQBand, channelId?: string) {
    const target = channelId || get(activeAudioEffects) || "main"
    audioEffects.update((all) => {
        const channelConfig = all[target] || {}
        const config = channelConfig?.equalizer ?? { enabled: false, bands: AudioEqualizer.getDefaultBands() }
        const newBands = [...config.bands]
        if (bandIndex >= 0 && bandIndex < newBands.length) {
            newBands[bandIndex] = { ...band }
        }
        return { ...all, [target]: { ...channelConfig, equalizer: { ...config, bands: newBands } } as any }
    })
}

export function setEqualizerEnabled(enabled: boolean, channelId?: string) {
    const target = channelId || get(activeAudioEffects) || "main"
    setEffectEnabledInStore("equalizer", DEFAULT_EQUALIZER_CONFIG, enabled, target)
}
