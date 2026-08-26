import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface LimiterConfig {
    enabled: boolean
    ceiling: number
    release: number
}

export const DEFAULT_LIMITER_CONFIG: LimiterConfig = { enabled: false, ceiling: -3, release: 0.05 }

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

        this.input.connect(this.compressor).connect(this.output)
        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const tc = 0.015

        if (this.config.enabled) {
            this.compressor.threshold.setTargetAtTime(this.config.ceiling, t, tc)
            this.compressor.knee.setTargetAtTime(0, t, tc)
            this.compressor.ratio.setTargetAtTime(20, t, tc)
            this.compressor.attack.setTargetAtTime(0.001, t, tc)
            this.compressor.release.setTargetAtTime(Math.max(0.001, this.config.release), t, tc)
        } else {
            this.compressor.threshold.setTargetAtTime(0, t, tc)
            this.compressor.knee.setTargetAtTime(0, t, tc)
            this.compressor.ratio.setTargetAtTime(1, t, tc)
            this.compressor.attack.setTargetAtTime(0, t, tc)
            this.compressor.release.setTargetAtTime(0.25, t, tc)
        }
    }

    updateConfig(config: Partial<LimiterConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    get reduction(): number {
        return this.compressor.reduction
    }

    getConfig(): LimiterConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, this.compressor, this.output)
    }
}

const integration = createEffectIntegration("limiter", DEFAULT_LIMITER_CONFIG, AudioLimiter)
export const initializeLimiter = integration.initialize
export const updateLimiterConfig = integration.updateConfig
export const setLimiterEnabled = integration.setEnabled
export const getLimiterReduction = () => integration.getInstance()?.reduction ?? 0
