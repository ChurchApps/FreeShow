import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface DelayConfig {
    enabled: boolean
    delayTime: number
    feedback: number
    wet: number
}

export const DEFAULT_DELAY_CONFIG: DelayConfig = { enabled: false, delayTime: 0.5, feedback: 0.3, wet: 0.3 }

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

        this.input.connect(this.dryGain).connect(this.output)
        this.input.connect(this.delayNode).connect(this.wetGain).connect(this.output)
        this.delayNode.connect(this.feedbackGain).connect(this.delayNode)

        this.applyParams()
    }

    private applyParams() {
        const t = this.ac.currentTime
        const tc = 0.015

        this.delayNode.delayTime.setTargetAtTime(Math.max(0, Math.min(2.0, this.config.delayTime)), t, tc)
        this.feedbackGain.gain.setTargetAtTime(Math.min(0.95, Math.max(0, this.config.feedback)), t, tc)
        this.dryGain.gain.setTargetAtTime(1, t, tc)
        this.wetGain.gain.setTargetAtTime(this.config.enabled ? this.config.wet : 0, t, tc)
    }

    updateConfig(config: Partial<DelayConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): DelayConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, this.delayNode, this.feedbackGain, this.dryGain, this.wetGain, this.output)
    }
}

const integration = createEffectIntegration("delay", DEFAULT_DELAY_CONFIG, AudioDelay)
export const initializeDelay = integration.initialize
export const updateDelayConfig = integration.updateConfig
export const setDelayEnabled = integration.setEnabled
