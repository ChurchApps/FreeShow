// Audio Stereo Shaper Engine & Integration
// Mid-side (M/S) stereo width control using AudioWorklet.
// Falls back to passthrough until the worklet module is loaded.

import { getEffectConfig, setEffectEnabledInStore, subscribeEffect, updateEffectInStore } from "./audioEffectsHelpers"

export interface StereoShaperConfig {
    enabled: boolean
    width: number // 0–200; 100 = normal, 0 = mono, 200 = extra wide
}

export const DEFAULT_STEREO_SHAPER_CONFIG: StereoShaperConfig = {
    enabled: false,
    width: 100
}

export class AudioStereoShaper {
    readonly input: GainNode
    readonly output: GainNode
    private workletNode: AudioWorkletNode | null = null
    private passthrough: GainNode
    private ac: AudioContext
    private config: StereoShaperConfig

    constructor(ac: AudioContext, config: StereoShaperConfig) {
        this.ac = ac
        this.config = { ...config }
        this.input = ac.createGain()
        this.output = ac.createGain()
        this.passthrough = ac.createGain()

        // Start as passthrough; switch to worklet once loaded
        this.input.connect(this.passthrough)
        this.passthrough.connect(this.output)

        this.initWorklet()
    }

    private async initWorklet() {
        try {
            await this.ac.audioWorklet.addModule("./assets/stereo-shaper-processor.js")

            this.workletNode = new AudioWorkletNode(this.ac, "stereo-shaper-processor", {
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
            console.error("StereoShaper worklet init failed:", err)
            // Passthrough remains active
        }
    }

    private applyParams(config: StereoShaperConfig) {
        if (!this.workletNode) return
        const t = this.ac.currentTime
        const p = this.workletNode.parameters
        p.get("width")?.setValueAtTime(config.width, t)
        p.get("enabled")?.setValueAtTime(config.enabled ? 1 : 0, t)
    }

    updateConfig(config: Partial<StereoShaperConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams(this.config)
    }

    setEnabled(enabled: boolean) {
        this.config.enabled = enabled
        this.applyParams(this.config)
    }

    getConfig(): StereoShaperConfig {
        return { ...this.config }
    }

    dispose() {
        for (const node of [this.input, this.workletNode, this.passthrough, this.output]) {
            if (!node) continue
            try {
                node.disconnect()
            } catch {
                /* already disconnected */
            }
        }
    }
}

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

let globalStereoShaper: AudioStereoShaper | null = null

export function initializeStereoShaper(ac: AudioContext): AudioStereoShaper {
    if (globalStereoShaper) return globalStereoShaper

    globalStereoShaper = new AudioStereoShaper(ac, getEffectConfig("stereoShaper", DEFAULT_STEREO_SHAPER_CONFIG))
    subscribeEffect("stereoShaper", (cfg: StereoShaperConfig) => globalStereoShaper?.updateConfig(cfg))

    return globalStereoShaper
}

export function updateStereoShaperConfig(partial: Partial<StereoShaperConfig>) {
    updateEffectInStore("stereoShaper", DEFAULT_STEREO_SHAPER_CONFIG, partial, globalStereoShaper)
}

export function setStereoShaperEnabled(enabled: boolean) {
    setEffectEnabledInStore("stereoShaper", DEFAULT_STEREO_SHAPER_CONFIG, enabled, globalStereoShaper)
}
