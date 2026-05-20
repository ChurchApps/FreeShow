// Audio Reverb Engine & Integration
// Algorithmic reverb using ConvolverNode with a synthetically generated impulse response.
// No IR files required — the IR is computed from roomSize and dampening parameters.

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export interface ReverbConfig {
    enabled: boolean
    roomSize: number // 0 to 1, default 0.5  (controls IR duration: 0.1s – 4s)
    dampening: number // 0 to 1, default 0.5  (higher = faster high-freq decay)
    wet: number // 0 to 1, default 0.25
}

export const DEFAULT_REVERB_CONFIG: ReverbConfig = {
    enabled: false,
    roomSize: 0.5,
    dampening: 0.5,
    wet: 0.25
}

/** Generate a stereo exponential-decay impulse response for use with ConvolverNode. */
function generateIR(ac: AudioContext, roomSize: number, dampening: number): AudioBuffer {
    const duration = 0.1 + roomSize * 3.9 // 0.1 s to 4.0 s
    const length = Math.floor(ac.sampleRate * duration)
    const buffer = ac.createBuffer(2, length, ac.sampleRate)
    const decay = 1 + dampening * 7 // higher dampening → steeper decay exponent

    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel)
        for (let i = 0; i < length; i++) {
            const t = i / length
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
        }
    }

    return buffer
}

export class AudioReverb {
    readonly input: GainNode
    readonly output: GainNode
    private convolver: ConvolverNode
    private dryGain: GainNode
    private wetGain: GainNode
    private ac: AudioContext
    private config: ReverbConfig

    constructor(ac: AudioContext, config: ReverbConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.convolver = ac.createConvolver()
        this.dryGain = ac.createGain()
        this.wetGain = ac.createGain()

        // Dry path:  input → dry → output
        // Wet path:  input → convolver → wet → output
        this.input.connect(this.dryGain)
        this.dryGain.connect(this.output)
        this.input.connect(this.convolver)
        this.convolver.connect(this.wetGain)
        this.wetGain.connect(this.output)

        this.updateIR()
        this.applyGains()
    }

    private updateIR() {
        this.convolver.buffer = generateIR(this.ac, this.config.roomSize, this.config.dampening)
    }

    private applyGains() {
        const wet = this.config.enabled ? this.config.wet : 0
        this.dryGain.gain.setValueAtTime(1, this.ac.currentTime)
        this.wetGain.gain.setValueAtTime(wet, this.ac.currentTime)
    }

    updateConfig(config: Partial<ReverbConfig>) {
        const irChanged = config.roomSize !== undefined || config.dampening !== undefined
        this.config = { ...this.config, ...config }
        if (irChanged) this.updateIR()
        this.applyGains()
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        this.applyGains()
    }

    getConfig(): ReverbConfig {
        return { ...this.config }
    }

    dispose() {
        try {
            this.input.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.convolver.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.dryGain.disconnect()
        } catch {
            /* already disconnected */
        }
        try {
            this.wetGain.disconnect()
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

let globalReverb: AudioReverb | null = null

export function initializeReverb(ac: AudioContext): AudioReverb {
    if (globalReverb) return globalReverb

    globalReverb = new AudioReverb(ac, getEffectConfig("reverb", DEFAULT_REVERB_CONFIG))
    subscribeEffect("reverb", (cfg: ReverbConfig) => globalReverb?.updateConfig(cfg))

    return globalReverb
}

export function updateReverbConfig(partial: Partial<ReverbConfig>) {
    updateEffectInStore("reverb", DEFAULT_REVERB_CONFIG, partial, globalReverb)
}

export function setReverbEnabled(enabled: boolean) {
    setEffectEnabledInStore("reverb", DEFAULT_REVERB_CONFIG, enabled, globalReverb)
}
