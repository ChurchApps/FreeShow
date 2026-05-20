// Audio Noise Gate Engine & Integration
// Real-time gate using AudioWorklet. Falls back to passthrough until worklet is loaded.

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export interface NoiseGateConfig {
    enabled: boolean
    threshold: number // -100 to 0 dB,  default -40
    attack: number // 0 to 1 s,      default 0.003
    release: number // 0 to 2 s,      default 0.1
    hysteresis: number // 0 to 24 dB,    default 6
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

    constructor(ac: AudioContext, config: NoiseGateConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.passthrough = ac.createGain()

        // Start as passthrough; will switch to worklet once loaded
        this.input.connect(this.passthrough)
        this.passthrough.connect(this.output)

        this.initWorklet()
    }

    private async initWorklet() {
        try {
            await this.ac.audioWorklet.addModule("./assets/noise-gate-processor.js")

            this.workletNode = new AudioWorkletNode(this.ac, "noise-gate-processor", {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 2,
                channelCountMode: "explicit"
            })

            this.input.disconnect(this.passthrough)
            this.passthrough.disconnect(this.output)
            this.input.connect(this.workletNode)
            this.workletNode.connect(this.output)

            this.applyParams(this.config)
        } catch (err) {
            console.error("NoiseGate worklet init failed:", err)
            // Passthrough remains active
        }
    }

    private applyParams(config: NoiseGateConfig) {
        if (!this.workletNode) return
        const t = this.ac.currentTime
        const p = this.workletNode.parameters
        p.get("threshold")?.setValueAtTime(config.threshold, t)
        p.get("attack")?.setValueAtTime(config.attack, t)
        p.get("release")?.setValueAtTime(config.release, t)
        p.get("hysteresis")?.setValueAtTime(config.hysteresis, t)
        p.get("enabled")?.setValueAtTime(config.enabled ? 1 : 0, t)
    }

    updateConfig(config: Partial<NoiseGateConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams(this.config)
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        this.applyParams(this.config)
    }

    getConfig(): NoiseGateConfig {
        return { ...this.config }
    }

    dispose() {
        try {
            this.input.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.workletNode?.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.passthrough.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.output.disconnect()
        } catch {
            /* already disconnected */
        }
    }
}

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

let globalNoiseGate: AudioNoiseGate | null = null

export function initializeNoiseGate(ac: AudioContext): AudioNoiseGate {
    if (globalNoiseGate) return globalNoiseGate

    globalNoiseGate = new AudioNoiseGate(ac, getEffectConfig("noiseGate", DEFAULT_NOISE_GATE_CONFIG))
    subscribeEffect("noiseGate", (cfg: NoiseGateConfig) => globalNoiseGate?.updateConfig(cfg))

    return globalNoiseGate
}

export function updateNoiseGateConfig(partial: Partial<NoiseGateConfig>) {
    updateEffectInStore("noiseGate", DEFAULT_NOISE_GATE_CONFIG, partial, globalNoiseGate)
}

export function setNoiseGateEnabled(enabled: boolean) {
    setEffectEnabledInStore("noiseGate", DEFAULT_NOISE_GATE_CONFIG, enabled, globalNoiseGate)
}
