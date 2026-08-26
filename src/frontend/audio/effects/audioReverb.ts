import { createEffectIntegration, safelyDisconnect } from "./audioEffectsHelpers"

export interface ReverbConfig {
    enabled: boolean
    roomSize: number
    dampening: number
    wet: number
}

export const DEFAULT_REVERB_CONFIG: ReverbConfig = { enabled: false, roomSize: 0.5, dampening: 0.5, wet: 0.25 }

function generateIR(ac: AudioContext, roomSize: number, dampening: number): AudioBuffer {
    const duration = 0.1 + roomSize * 3.9
    const length = Math.floor(ac.sampleRate * duration)
    const buffer = ac.createBuffer(2, length, ac.sampleRate)
    const decay = 1 + dampening * 7

    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel)
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
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

        this.input.connect(this.dryGain).connect(this.output)
        this.input.connect(this.convolver).connect(this.wetGain).connect(this.output)

        this.updateIR()
        this.applyGains()
    }

    private updateIR() {
        this.convolver.buffer = generateIR(this.ac, this.config.roomSize, this.config.dampening)
    }

    private applyGains() {
        const t = this.ac.currentTime
        const tc = 0.015
        this.dryGain.gain.setTargetAtTime(1, t, tc)
        this.wetGain.gain.setTargetAtTime(this.config.enabled ? this.config.wet : 0, t, tc)
    }

    updateConfig(config: Partial<ReverbConfig>) {
        const irChanged = (config.roomSize !== undefined && config.roomSize !== this.config.roomSize) || (config.dampening !== undefined && config.dampening !== this.config.dampening)

        this.config = { ...this.config, ...config }
        if (irChanged) this.updateIR()
        this.applyGains()
    }

    setEnabled(enabled: boolean) {
        this.updateConfig({ enabled })
    }

    getConfig(): ReverbConfig {
        return { ...this.config }
    }

    dispose() {
        safelyDisconnect(this.input, this.convolver, this.dryGain, this.wetGain, this.output)
    }
}

const integration = createEffectIntegration("reverb", DEFAULT_REVERB_CONFIG, AudioReverb)
export const initializeReverb = integration.initialize
export const updateReverbConfig = integration.updateConfig
export const setReverbEnabled = integration.setEnabled
