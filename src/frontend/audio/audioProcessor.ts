import { SoundTouchNode } from "@soundtouchjs/audio-worklet"

// Pitch & Tempo

/**
 * Global manager for the SoundTouch AudioWorklet.
 * Handles lazy registration to ensure fast startup for standard playback.
 */
export class AudioProcessor {
    private static registeredContexts = new WeakSet<BaseAudioContext>()
    private static registeringPromise: Promise<boolean> | null = null

    /** Check if the worklet is already registered for this context (synchronous) */
    static isRegistered(context: BaseAudioContext): boolean {
        return this.registeredContexts.has(context)
    }

    /** Register the worklet with the context (idempotent, handling concurrent calls) */
    static async register(context: BaseAudioContext): Promise<boolean> {
        if (this.isRegistered(context)) return true

        if (!this.registeringPromise) {
            this.registeringPromise = (async () => {
                try {
                    await context.audioWorklet.addModule("./assets/soundtouch-processor.js")
                    this.registeredContexts.add(context)
                    return true
                } catch (err) {
                    console.error("SoundTouch registration failed:", err)
                    return false
                } finally {
                    this.registeringPromise = null
                }
            })()
        }

        return await this.registeringPromise
    }

    /** Create a new PitchShiftNode wrapper */
    static createNode(context: BaseAudioContext): PitchShiftNode {
        return new PitchShiftNode(context)
    }
}

/**
 * A composite AudioNode wrapper that enables real-time pitch and tempo shifting.
 * Uses a dry/wet architecture for zero-latency bypass and glitch-free initialization.
 */
export class PitchShiftNode {
    readonly input: GainNode
    readonly output: GainNode
    
    private soundTouch: SoundTouchNode | null = null
    private dryGain: GainNode
    private wetGain: GainNode

    private _pitch = 0
    private _tempo = 1
    private _isInitializing = false
    private _isFirstSync = true

    constructor(context: BaseAudioContext) {
        this.input = context.createGain()
        this.output = context.createGain()
        this.dryGain = context.createGain()
        this.wetGain = context.createGain()

        // Default path: Dry (Bypass) is active, Wet is silent
        this.input.connect(this.dryGain).connect(this.output)
        
        this.dryGain.gain.value = 1
        this.wetGain.gain.value = 0
    }

    get pitch() { return this._pitch }
    set pitch(value: number) {
        this._pitch = value
        this.apply()
    }

    get tempo() { return this._tempo }
    set tempo(value: number) {
        this._tempo = value
        this.apply()
    }

    /** 
     * Applies the current pitch/tempo settings.
     * Initializes the SoundTouch processor lazily if needed.
     */
    private apply() {
        const needsProcessing = this._pitch !== 0 || this._tempo !== 1
        
        if (needsProcessing && !this.soundTouch && !this._isInitializing) {
            if (AudioProcessor.isRegistered(this.input.context)) {
                this.initSoundTouch()
            } else {
                this.initAsync()
                return 
            }
        }

        if (this.soundTouch) {
            try {
                this.soundTouch.pitchSemitones.value = this._pitch
                this.soundTouch.tempo.value = this._tempo
            } catch { /* Stale worklet node */ }
        }

        this.sync()
    }

    private async initAsync() {
        if (this._isInitializing) return
        this._isInitializing = true
        
        try {
            if (await AudioProcessor.register(this.input.context)) {
                this.initSoundTouch()
                this.apply() // Re-run to set values and sync gain
            }
        } finally {
            this._isInitializing = false
        }
    }

    private initSoundTouch() {
        if (this.soundTouch) return
        try {
            this.soundTouch = new SoundTouchNode(this.input.context)
            this.input.connect(this.soundTouch).connect(this.wetGain).connect(this.output)
        } catch (e) {
            console.error("SoundTouch init failed:", e)
        }
    }

    /** Manages the crossfade between the dry and wet signals */
    private sync() {
        const isActive = !!this.soundTouch && (this._pitch !== 0 || this._tempo !== 1)
        const now = this.input.context.currentTime
        
        // Use instant gain jump on first application to avoid flanging artifacts
        if (this._isFirstSync) {
            this.dryGain.gain.cancelScheduledValues(now)
            this.wetGain.gain.setTargetAtTime(isActive ? 1 : 0, now, 0.001) // Near-instant 
            this.dryGain.gain.setTargetAtTime(isActive ? 0 : 1, now, 0.001)
            this._isFirstSync = false
        } else {
            // Smooth 50ms ramp for real-time adjustments (e.g. sliders)
            const rampTime = 0.05
            this.dryGain.gain.setTargetAtTime(isActive ? 0 : 1, now, rampTime)
            this.wetGain.gain.setTargetAtTime(isActive ? 1 : 0, now, rampTime)
        }
    }

    connect(dest: AudioNode | AudioParam) {
        return dest instanceof AudioNode ? this.output.connect(dest) : this.output.connect(dest)
    }

    disconnect(dest?: AudioNode | AudioParam) {
        try {
            if (dest instanceof AudioNode) this.output.disconnect(dest)
            else if (dest instanceof AudioParam) this.output.disconnect(dest)
            else this.output.disconnect()
        } catch { /* Already disconnected */ }
    }
}
