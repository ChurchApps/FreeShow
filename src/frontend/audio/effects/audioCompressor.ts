// Audio Compressor Engine & Integration
// Handles dynamics compression using the Web Audio API DynamicsCompressorNode

import { getEffectConfig, setEffectEnabledInStore, updateEffectInStore } from "./audioEffectsHelpers"

export interface CompressorConfig {
    enabled: boolean
    threshold: number // -100 to 0 dB, default -24
    knee: number // 0 to 40 dB, default 30
    ratio: number // 1 to 20, default 12
    attack: number // 0 to 1 s, default 0.003
    release: number // 0 to 1 s, default 0.25
}

export const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
    enabled: false,
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25
}

export class AudioCompressor {
    readonly input: GainNode
    readonly output: GainNode
    private compressor: DynamicsCompressorNode
    private ac: AudioContext
    private config: CompressorConfig

    constructor(ac: AudioContext, config: CompressorConfig) {
        this.ac = ac
        this.config = { ...config }

        this.input = ac.createGain()
        this.output = ac.createGain()
        this.compressor = ac.createDynamicsCompressor()

        this.applyParams(config)

        // Always keep compressor in chain; use ratio=1 / threshold=0 for bypass
        this.input.connect(this.compressor)
        this.compressor.connect(this.output)

        if (!config.enabled) this.applyBypass()
    }

    private applyParams(config: CompressorConfig) {
        const t = this.ac.currentTime
        this.compressor.threshold.setValueAtTime(config.threshold, t)
        this.compressor.knee.setValueAtTime(config.knee, t)
        this.compressor.ratio.setValueAtTime(config.ratio, t)
        this.compressor.attack.setValueAtTime(config.attack, t)
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

    updateConfig(config: Partial<CompressorConfig>) {
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

    /** Instantaneous gain reduction in dB (always <= 0). Read-only from the Web Audio node. */
    get reduction(): number {
        return this.compressor.reduction
    }

    getConfig(): CompressorConfig {
        return { ...this.config }
    }

    dispose() {
        try {
            this.input.disconnect()
        } catch {
            // already disconnected
        }
        try {
            this.compressor.disconnect()
        } catch {
            // already disconnected
        }
        try {
            this.output.disconnect()
        } catch {
            // already disconnected
        }
    }
}

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

let globalCompressor: AudioCompressor | null = null

/**
 * Create the global compressor instance for the given AudioContext.
 * Returns the input node — callers should connect their source to input
 * and connect output to the next node in the chain (e.g. ac.destination).
 */
export function initializeCompressor(ac: AudioContext): AudioCompressor {
    if (globalCompressor) {
        globalCompressor.dispose()
    }
    globalCompressor = new AudioCompressor(ac, getEffectConfig("compressor", DEFAULT_COMPRESSOR_CONFIG))
    return globalCompressor
}

export function getGlobalCompressor(): AudioCompressor | null {
    return globalCompressor
}

export function updateCompressorConfig(partial: Partial<CompressorConfig>) {
    updateEffectInStore("compressor", DEFAULT_COMPRESSOR_CONFIG, partial, globalCompressor)
}

export function setCompressorEnabled(enabled: boolean) {
    setEffectEnabledInStore("compressor", DEFAULT_COMPRESSOR_CONFIG, enabled, globalCompressor)
}

export function getCompressorReduction(): number {
    return globalCompressor?.reduction ?? 0
}
