import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface CompressorConfig {
    enabled: boolean
    threshold: number
    knee: number
    ratio: number
    attack: number
    release: number
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

        this.input.connect(this.compressor).connect(this.output)
        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const tc = 0.015

        if (this.config.enabled) {
            this.compressor.threshold.setTargetAtTime(this.config.threshold, t, tc)
            this.compressor.knee.setTargetAtTime(this.config.knee, t, tc)
            this.compressor.ratio.setTargetAtTime(this.config.ratio, t, tc)
            this.compressor.attack.setTargetAtTime(this.config.attack, t, tc)
            this.compressor.release.setTargetAtTime(Math.max(0.001, this.config.release), t, tc)
        } else {
            this.compressor.threshold.setTargetAtTime(0, t, tc)
            this.compressor.knee.setTargetAtTime(0, t, tc)
            this.compressor.ratio.setTargetAtTime(1, t, tc)
            this.compressor.attack.setTargetAtTime(0, t, tc)
            this.compressor.release.setTargetAtTime(0.25, t, tc)
        }
    }

    updateConfig(config: Partial<CompressorConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    get reduction(): number {
        return this.compressor.reduction
    }

    getConfig(): CompressorConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, this.compressor, this.output)
    }
}

const integration = createEffectIntegration("compressor", DEFAULT_COMPRESSOR_CONFIG, AudioCompressor)
export const initializeCompressor = integration.initialize
export const getGlobalCompressor = integration.getInstance
export const updateCompressorConfig = integration.updateConfig
export const setCompressorEnabled = integration.setEnabled
export const getCompressorReduction = () => integration.getInstance()?.reduction ?? 0
