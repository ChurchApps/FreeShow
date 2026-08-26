import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface NoiseGateConfig {
    enabled: boolean
    threshold: number // -100 to 0 dB, default -40
    attack: number // 0 to 1 s, default 0.003
    release: number // 0 to 2 s, default 0.1
    hysteresis: number // 0 to 24 dB, default 6
}

export const DEFAULT_NOISE_GATE_CONFIG: NoiseGateConfig = {
    enabled: false,
    threshold: -40,
    attack: 0.003,
    release: 0.1,
    hysteresis: 6
}

export class AudioNoiseGate {
    readonly input: GainNode
    readonly output: GainNode
    private workletNode: AudioWorkletNode | null = null
    private passthrough: GainNode
    private ac: AudioContext
    private config: NoiseGateConfig
    private isDisposed = false

    constructor(ac: AudioContext, config: NoiseGateConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.passthrough = ac.createGain()

        this.input.connect(this.passthrough)
        this.passthrough.connect(this.output)

        this.initWorklet()
    }

    private async initWorklet() {
        try {
            await this.ac.audioWorklet.addModule("./assets/noise-gate-processor.js")
            if (this.isDisposed) return

            this.workletNode = new AudioWorkletNode(this.ac, "noise-gate-processor", {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 2,
                channelCountMode: "explicit"
            })

            safelyDisconnect(this.input, this.passthrough)

            this.input.connect(this.workletNode)
            this.workletNode.connect(this.output)
            this.applyParams()
        } catch (err) {
            console.error("NoiseGate worklet init failed:", err)
        }
    }

    private applyParams() {
        if (!this.workletNode || this.isDisposed) return
        const t = this.ac.currentTime
        const p = this.workletNode.parameters
        p.get("threshold")?.setValueAtTime(this.config.threshold, t)
        p.get("attack")?.setValueAtTime(this.config.attack, t)
        p.get("release")?.setValueAtTime(this.config.release, t)
        p.get("hysteresis")?.setValueAtTime(this.config.hysteresis, t)
        p.get("enabled")?.setValueAtTime(this.config.enabled ? 1 : 0, t)
    }

    updateConfig(config: Partial<NoiseGateConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): NoiseGateConfig {
        return { ...this.config }
    }

    dispose() {
        this.isDisposed = true
        safelyDisconnect(this.input, this.workletNode, this.passthrough, this.output)
    }
}

const integration = createEffectIntegration("noiseGate", DEFAULT_NOISE_GATE_CONFIG, AudioNoiseGate)
export const initializeNoiseGate = integration.initialize
export const updateNoiseGateConfig = integration.updateConfig
export const setNoiseGateEnabled = integration.setEnabled
