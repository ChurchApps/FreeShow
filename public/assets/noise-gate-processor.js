/**
 * AudioWorklet processor for a real-time noise gate.
 * Monitors signal level per-sample and smoothly opens/closes a gain envelope
 * using attack and release time constants, with hysteresis to prevent chatter.
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: "threshold", defaultValue: -40, minValue: -100, maxValue: 0 },
            { name: "attack", defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
            { name: "release", defaultValue: 0.1, minValue: 0.0001, maxValue: 2 },
            { name: "hysteresis", defaultValue: 6, minValue: 0, maxValue: 24 },
            { name: "enabled", defaultValue: 1, minValue: 0, maxValue: 1 }
        ]
    }

    constructor() {
        super()
        this._gain = 0
        this._isOpen = false
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        const output = outputs[0]
        if (!input || !input.length) return true

        const enabled = parameters.enabled[0] > 0.5

        if (!enabled) {
            for (let ch = 0; ch < output.length; ch++) {
                output[ch].set(input[ch] || input[0])
            }
            return true
        }

        const threshDb = parameters.threshold[0]
        const attackSec = parameters.attack[0]
        const releaseSec = parameters.release[0]
        const hystDb = parameters.hysteresis[0]

        const openLinear = Math.pow(10, threshDb / 20)
        const closeLinear = Math.pow(10, (threshDb - hystDb) / 20)
        const attackCoef = Math.exp(-1 / (sampleRate * attackSec))
        const releaseCoef = Math.exp(-1 / (sampleRate * releaseSec))

        const numSamples = output[0].length

        for (let i = 0; i < numSamples; i++) {
            const level = Math.abs((input[0] || [])[i] || 0)

            if (!this._isOpen && level > openLinear) this._isOpen = true
            else if (this._isOpen && level < closeLinear) this._isOpen = false

            const target = this._isOpen ? 1 : 0
            if (target > this._gain) {
                this._gain = 1 - (1 - this._gain) * attackCoef
            } else {
                this._gain = this._gain * releaseCoef
            }

            for (let ch = 0; ch < output.length; ch++) {
                output[ch][i] = ((input[ch] || input[0] || [])[i] || 0) * this._gain
            }
        }

        return true
    }
}

registerProcessor("noise-gate-processor", NoiseGateProcessor)
