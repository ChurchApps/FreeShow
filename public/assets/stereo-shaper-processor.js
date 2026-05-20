/**
 * AudioWorklet processor for stereo width control via mid-side (M/S) processing.
 * width = 0  : mono (side = 0)
 * width = 100: normal stereo (unchanged)
 * width = 200: extra wide (side doubled)
 */
class StereoShaperProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: "width", defaultValue: 100, minValue: 0, maxValue: 200 },
            { name: "enabled", defaultValue: 1, minValue: 0, maxValue: 1 }
        ]
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        const output = outputs[0]
        if (!input || !output) return true

        const numChannels = Math.min(input.length, output.length)

        // Mono passthrough – nothing to widen
        if (numChannels < 2) {
            for (let ch = 0; ch < numChannels; ch++) {
                if (input[ch] && output[ch]) output[ch].set(input[ch])
            }
            return true
        }

        const enabled = parameters.enabled[0] > 0.5

        if (!enabled) {
            for (let ch = 0; ch < numChannels; ch++) {
                if (input[ch] && output[ch]) output[ch].set(input[ch])
            }
            return true
        }

        const width = parameters.width[0] / 100 // 0 – 2 scale
        const numSamples = output[0].length

        for (let i = 0; i < numSamples; i++) {
            const l = (input[0] || [])[i] || 0
            const r = (input[1] || [])[i] || 0
            const mid = (l + r) * 0.5
            const side = (l - r) * 0.5 * width
            if (output[0]) output[0][i] = mid + side
            if (output[1]) output[1][i] = mid - side
            // Pass any additional channels through unchanged
            for (let ch = 2; ch < numChannels; ch++) {
                if (output[ch] && input[ch]) output[ch][i] = input[ch][i] || 0
            }
        }

        return true
    }
}

registerProcessor("stereo-shaper-processor", StereoShaperProcessor)
