import { SoundTouchNode } from "@soundtouchjs/audio-worklet"
import soundtouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url"

// Pitch & Tempo

export class AudioProcessor {
    private static registeredContexts = new WeakSet<BaseAudioContext>()

    static async createNode(context: BaseAudioContext): Promise<PitchShiftNode> {
        if (!this.registeredContexts.has(context)) {
            await SoundTouchNode.register(context, soundtouchProcessorUrl)
            this.registeredContexts.add(context)
        }
        return await PitchShiftNode.create(context)
    }
}

export class PitchShiftNode {
    readonly input: GainNode
    readonly output: GainNode
    private soundTouch!: SoundTouchNode
    private dryGain: GainNode
    private wetGain: GainNode

    private _pitch = 0
    private _tempo = 1

    private constructor(context: BaseAudioContext) {
        this.input = context.createGain()
        this.output = context.createGain()
        this.dryGain = context.createGain()
        this.wetGain = context.createGain()
    }

    static async create(context: BaseAudioContext) {
        const node = new PitchShiftNode(context)
        node.soundTouch = new SoundTouchNode(context)

        // Path 1: Dry (Bypass)
        node.input.connect(node.dryGain).connect(node.output)

        // Path 2: Wet (Processed)
        node.input.connect(node.soundTouch).connect(node.wetGain).connect(node.output)

        // Default state: Bypassed
        node.dryGain.gain.value = 1
        node.wetGain.gain.value = 0

        return node
    }

    get pitch() {
        return this._pitch
    }
    set pitch(value: number) {
        this._pitch = value
        this.soundTouch.pitchSemitones.value = value
        this.sync()
    }

    get tempo() {
        return this._tempo
    }
    set tempo(value: number) {
        this._tempo = value
        this.soundTouch.tempo.value = value
        this.sync()
    }

    private sync() {
        const isActive = this._pitch !== 0 || this._tempo !== 1
        const now = this.input.context.currentTime
        const rampTime = 0.05

        this.dryGain.gain.setTargetAtTime(isActive ? 0 : 1, now, rampTime)
        this.wetGain.gain.setTargetAtTime(isActive ? 1 : 0, now, rampTime)
    }

    // Helper to treat as standard node in simple cases
    connect(dest: AudioNode | AudioParam) {
        return dest instanceof AudioNode ? this.output.connect(dest) : this.output.connect(dest)
    }

    disconnect(dest?: AudioNode | AudioParam) {
        if (dest instanceof AudioNode) this.output.disconnect(dest)
        else if (dest instanceof AudioParam) this.output.disconnect(dest)
        else this.output.disconnect()
    }
}
