import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface StereoShaperConfig {
    enabled: boolean
    width: number // 0–200; 100 = normal, 0 = mono, 200 = extra wide
}

export const DEFAULT_STEREO_SHAPER_CONFIG: StereoShaperConfig = { enabled: false, width: 100 }

export class AudioStereoShaper {
    readonly input: GainNode
    readonly output: GainNode
    private workletNode: AudioWorkletNode | null = null
    private passthrough: GainNode
    private ac: AudioContext
    private config: StereoShaperConfig
    private isDisposed = false

    constructor(ac: AudioContext, config: StereoShaperConfig) {
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
            await this.ac.audioWorklet.addModule("./assets/stereo-shaper-processor.js")
            if (this.isDisposed) return

            this.workletNode = new AudioWorkletNode(this.ac, "stereo-shaper-processor", {
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
            console.error("StereoShaper worklet init failed:", err)
        }
    }

    private applyParams() {
        if (!this.workletNode || this.isDisposed) return
        const t = this.ac.currentTime
        const tc = 0.015
        const p = this.workletNode.parameters

        p.get("width")?.setTargetAtTime(this.config.width, t, tc)
        p.get("enabled")?.setTargetAtTime(this.config.enabled ? 1 : 0, t, tc)
    }

    updateConfig(config: Partial<StereoShaperConfig>) {
        this.config = { ...this.config, ...config }
        this.applyParams()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): StereoShaperConfig {
        return { ...this.config }
    }

    dispose() {
        this.isDisposed = true
        safelyDisconnect(this.input, this.workletNode, this.passthrough, this.output)
    }
}

const integration = createEffectIntegration("stereoShaper", DEFAULT_STEREO_SHAPER_CONFIG, AudioStereoShaper)
export const initializeStereoShaper = integration.initialize
export const updateStereoShaperConfig = integration.updateConfig
export const setStereoShaperEnabled = integration.setEnabled
