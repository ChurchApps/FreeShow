// Audio Equalizer Engine & Integration
// Handles EQ band calculations, Web Audio API integration, and Svelte store management

import { get } from "svelte/store"
import { equalizerConfig } from "../stores"

export interface EQBand {
    frequency: number
    gain: number // in dB (-24 to +24)
    q: number // quality factor (steepness) (0.1 to 30)
    type: "highpass" | "lowpass" | "peaking"
    label: string
}

export interface EqualizerConfig {
    bands: EQBand[]
    enabled: boolean
}

export class AudioEqualizer {
    private audioContext: AudioContext | null = null
    private inputGainNode: GainNode | null = null
    private outputGainNode: GainNode | null = null
    private filterNodes: BiquadFilterNode[] = []
    private config: EqualizerConfig

    constructor(config?: EqualizerConfig) {
        this.config = config || {
            enabled: true,
            bands: AudioEqualizer.getDefaultBands()
        }
    }

    // Default 6-band EQ configuration
    static getDefaultBands(): EQBand[] {
        return [
            { frequency: 60, gain: 0, q: 0.7, type: "lowpass", label: "60Hz" },
            { frequency: 150, gain: 0, q: 0.7, type: "peaking", label: "150Hz" },
            { frequency: 400, gain: 0, q: 0.7, type: "peaking", label: "400Hz" },
            { frequency: 1000, gain: 0, q: 0.7, type: "peaking", label: "1kHz" },
            { frequency: 2500, gain: 0, q: 0.7, type: "peaking", label: "2.5kHz" },
            { frequency: 6300, gain: 0, q: 0.7, type: "highpass", label: "6.3kHz" }
        ]
    }

    // Initialize the equalizer with Web Audio API
    public initialize(ac: AudioContext) {
        this.audioContext = ac

        // Create input and output gain nodes
        this.inputGainNode = ac.createGain()
        this.outputGainNode = ac.createGain()

        // Create filter nodes for each band
        this.createFilterNodes()

        // Connect the filter chain
        this.connectFilters()
    }

    private createFilterNodes() {
        if (!this.audioContext) return

        this.filterNodes = []

        this.config.bands.forEach((band) => {
            const filter = this.audioContext!.createBiquadFilter()
            this.updateFilterFromBand(filter, band)
            this.filterNodes.push(filter)
        })
    }

    private updateFilterFromBand(filter: BiquadFilterNode, band: EQBand) {
        if (!this.audioContext) return

        const currentTime = this.audioContext.currentTime

        // Use peaking filters for all bands to allow proper gain control
        // For "highpass" and "lowpass" bands, we'll use peaking with adjusted Q
        filter.type = "peaking"

        // Set frequency
        filter.frequency.setValueAtTime(band.frequency, currentTime)

        // Adjust Q factor based on filter type for different characteristics
        let qValue = band.q
        if (band.type === "highpass" || band.type === "lowpass") {
            // Lower Q for shelf-like behavior on extreme bands
            qValue = Math.max(0.5, band.q * 0.8)
        }
        filter.Q.setValueAtTime(qValue, currentTime)

        // Set gain for all filter types - respect enabled state
        const effectiveGain = this.config.enabled ? band.gain : 0
        filter.gain.setValueAtTime(effectiveGain, currentTime)
    }

    private connectFilters() {
        if (!this.inputGainNode || !this.outputGainNode || this.filterNodes.length === 0) return

        // Connect input -> first filter
        this.inputGainNode.connect(this.filterNodes[0])

        // Connect filters in series
        for (let i = 0; i < this.filterNodes.length - 1; i++) {
            this.filterNodes[i].connect(this.filterNodes[i + 1])
        }

        // Connect last filter -> output
        this.filterNodes[this.filterNodes.length - 1].connect(this.outputGainNode)
    }

    // Connect an audio source through the equalizer
    public connectSource(source: AudioNode): AudioNode {
        if (!this.inputGainNode || !this.outputGainNode) {
            throw new Error("Equalizer not initialized")
        }

        try {
            // Always connect source -> input -> filters -> output
            source.connect(this.inputGainNode)
            return this.outputGainNode
        } catch (err) {
            console.error("Failed to connect source to equalizer:", err)
            return source // Return original source on failure
        }
    }

    // Update EQ bands configuration
    public updateBands(bands: EQBand[]) {
        this.config.bands = [...bands]

        // Update existing filter nodes
        if (this.audioContext) {
            const currentTime = this.audioContext.currentTime

            bands.forEach((band, index) => {
                if (this.filterNodes[index]) {
                    const filter = this.filterNodes[index]

                    // Cancel any scheduled changes to avoid conflicts
                    filter.frequency.cancelScheduledValues(currentTime)
                    filter.Q.cancelScheduledValues(currentTime)
                    filter.gain.cancelScheduledValues(currentTime)

                    // Update the filter with new band settings
                    this.updateFilterFromBand(filter, band)
                }
            })

            console.log('EQ bands updated - all filters refreshed')
        }
    }

    // Update a single band
    public updateBand(bandIndex: number, band: EQBand) {
        if (bandIndex < 0 || bandIndex >= this.config.bands.length) return

        this.config.bands[bandIndex] = { ...band }

        if (this.filterNodes[bandIndex]) {
            this.updateFilterFromBand(this.filterNodes[bandIndex], band)
        }
    }

    // Update a specific band's gain setting (for real-time adjustments)
    public setBandGain(bandIndex: number, gain: number) {
        if (bandIndex < 0 || bandIndex >= this.config.bands.length || !this.audioContext) return

        this.config.bands[bandIndex].gain = gain

        // Apply to audio filters - respect enabled state
        if (this.filterNodes[bandIndex]) {
            const effectiveGain = this.config.enabled ? gain : 0
            const currentTime = this.audioContext.currentTime
            this.filterNodes[bandIndex].gain.setValueAtTime(effectiveGain, currentTime)
        }
    }

    // Enable/disable the equalizer
    public setEnabled(enabled: boolean) {
        const wasEnabled = this.config.enabled
        this.config.enabled = enabled

        // If state changed, update all filter gains immediately
        if (wasEnabled !== enabled && this.audioContext) {
            const currentTime = this.audioContext.currentTime
            this.filterNodes.forEach((filter, index) => {
                if (filter && this.config.bands[index]) {
                    const effectiveGain = enabled ? this.config.bands[index].gain : 0
                    // Cancel any scheduled changes and set immediately
                    filter.gain.cancelScheduledValues(currentTime)
                    filter.gain.setValueAtTime(effectiveGain, currentTime)
                }
            })

            console.log(`Equalizer ${enabled ? 'enabled' : 'disabled'} - filters updated immediately`)
        }
    }

    // Get current configuration
    public getConfig(): EqualizerConfig {
        return { ...this.config }
    }

    // Reset to default values
    public reset() {
        this.config.bands = AudioEqualizer.getDefaultBands()
        this.updateBands(this.config.bands)
    }

    // Cleanup
    public dispose() {
        this.filterNodes.forEach(node => {
            try {
                node.disconnect()
            } catch (err) {
                // Node was already disconnected, ignore the error
            }
        })

        if (this.inputGainNode) {
            try {
                this.inputGainNode.disconnect()
            } catch (err) {
                // Node was already disconnected, ignore the error
            }
        }

        if (this.outputGainNode) {
            try {
                this.outputGainNode.disconnect()
            } catch (err) {
                // Node was already disconnected, ignore the error
            }
        }

        this.filterNodes = []
        this.inputGainNode = null
        this.outputGainNode = null
        this.audioContext = null
    }
}

// Utility functions for EQ calculations (for visualization)
export class EqualizerCalculations {
    // Calculate individual band frequency response
    static calculateBandResponse(band: EQBand, frequency: number): number {
        const centerFreq = band.frequency
        const gain = band.gain
        const q = band.q

        if (band.type === "peaking") {
            // Proper peaking/bell filter
            const ratio = frequency / centerFreq
            const logRatio = Math.log2(ratio)
            const bandwidth = 1 / q
            return gain / (1 + Math.pow((2 * logRatio) / bandwidth, 2))
        } else if (band.type === "highpass") {
            // High-pass filter response
            const ratio = frequency / centerFreq
            const order = Math.max(1, q)
            const filterResponse = 1 / (1 + Math.pow(ratio, 2 * order))
            return gain * (1 - filterResponse)
        } else if (band.type === "lowpass") {
            // Low-pass filter response
            const ratio = frequency / centerFreq
            const order = Math.max(1, q)
            const filterResponse = Math.pow(ratio, 2 * order) / (1 + Math.pow(ratio, 2 * order))
            return gain * (1 - filterResponse)
        }

        return 0
    }

    // Calculate combined frequency response of all bands
    static calculateCombinedResponse(bands: EQBand[], frequency: number): number {
        let totalGain = 0

        bands.forEach((band) => {
            totalGain += this.calculateBandResponse(band, frequency)
        })

        // Clamp total gain to reasonable range
        return Math.max(-30, Math.min(30, totalGain))
    }

    // Generate frequency response curve data points
    static generateResponseCurve(bands: EQBand[], numPoints = 300, minFreq = 20, maxFreq = 20000): { frequency: number, response: number }[] {
        const points: { frequency: number, response: number }[] = []

        for (let i = 0; i <= numPoints; i++) {
            // Logarithmic frequency scale
            const logMin = Math.log10(minFreq)
            const logMax = Math.log10(maxFreq)
            const logFreq = logMin + (i / numPoints) * (logMax - logMin)
            const frequency = Math.pow(10, logFreq)

            const response = this.calculateCombinedResponse(bands, frequency)
            points.push({ frequency, response })
        }

        return points
    }
}

// ============================================================================
// INTEGRATION LAYER - Global state management and audio system integration
// ============================================================================

// Global equalizer instance
let globalEqualizer: AudioEqualizer | null = null
let audioContext: AudioContext | null = null

// Connected audio sources
const connectedSources = new Map<string, {
    source: AudioNode,
    outputNode: AudioNode
}>()

// Initialize the audio equalizer system
export async function initializeEqualizer(externalAudioContext?: AudioContext, onEqualizerReinitialized?: () => void): Promise<void> {
    try {
        // Use external context if provided, otherwise create our own
        if (externalAudioContext) {
            audioContext = externalAudioContext
        } else if (!audioContext) {
            audioContext = new AudioContext({
                latencyHint: "interactive",
                sampleRate: 48000
            })
        }

        // Resume context if it's suspended (required by some browsers)
        if (audioContext.state === 'suspended') {
            await audioContext.resume()
        }

        // If equalizer already exists, we're re-initializing
        const isReinitializing = !!globalEqualizer
        const oldEqualizer = globalEqualizer

        // Create new equalizer instance first (before disposing old one)
        const newEqualizer = new AudioEqualizer(getEqualizerConfig())
        newEqualizer.initialize(audioContext)

        // Now seamlessly switch to the new equalizer
        globalEqualizer = newEqualizer

        // If we're re-initializing, notify that connections need to be refreshed
        if (isReinitializing && onEqualizerReinitialized) {
            // Call immediately since new equalizer is ready
            onEqualizerReinitialized()
        }

        // Dispose old equalizer after connections are switched
        if (oldEqualizer) {
            console.log("Disposing old equalizer instance after seamless switch")
            // Small delay to ensure all connections are switched
            setTimeout(() => {
                oldEqualizer.dispose()
            }, 100)
        }

        console.log("Audio equalizer initialized successfully")
    } catch (err) {
        console.error("Failed to initialize audio equalizer:", err)
    }
}

// Callback for auto-initialization - set by AudioAnalyser to avoid circular dependency
let autoInitializeCallback: (() => Promise<void>) | null = null

export function setAutoInitializeCallback(callback: () => Promise<void>) {
    autoInitializeCallback = callback
}

// Connect an audio source node to the equalizer (for integration with existing audio systems)
export async function connectAudioSourceToEqualizer(id: string, source: AudioNode): Promise<AudioNode | null> {
    if (!audioContext || !globalEqualizer) {
        console.log("Equalizer not initialized, attempting auto-initialization...")

        if (autoInitializeCallback) {
            try {
                await autoInitializeCallback()
                console.log("Equalizer initialized successfully for audio connection")
            } catch (err) {
                console.error("Failed to auto-initialize equalizer:", err)
                return source // Return original source for bypass
            }
        } else {
            console.warn("Auto-initialization not available, audio will play without EQ")
            return source // Return original source for bypass
        }
    }

    try {
        // Connect the existing source through equalizer
        const outputNode = globalEqualizer!.connectSource(source)

        // Store the connection
        connectedSources.set(id, { source, outputNode })

        console.log(`Audio source ${id} connected to equalizer`)
        return outputNode
    } catch (err) {
        console.error(`Failed to connect audio source ${id} to equalizer:`, err)
        return source // Return original source for bypass
    }
}

// Connect an audio element to the equalizer (deprecated - use connectAudioSourceToEqualizer for existing sources)
export function connectAudioToEqualizer(id: string, audio: HTMLAudioElement | MediaStream): AudioNode | null {
    if (!audioContext || !globalEqualizer) {
        console.warn("Equalizer not initialized, audio will play without EQ")
        return null
    }

    try {
        // Create audio source
        let source: AudioNode
        if (audio instanceof MediaStream) {
            source = audioContext.createMediaStreamSource(audio)
        } else {
            source = audioContext.createMediaElementSource(audio)
        }

        // Connect through equalizer
        const outputNode = globalEqualizer.connectSource(source)

        // Store the connection
        connectedSources.set(id, { source, outputNode })

        console.log(`Audio ${id} connected to equalizer`)
        return outputNode
    } catch (err) {
        console.error(`Failed to connect audio ${id} to equalizer:`, err)
        return null
    }
}// Disconnect audio from equalizer
export function disconnectAudioFromEqualizer(id: string) {
    const connection = connectedSources.get(id)
    if (connection) {
        try {
            connection.source.disconnect()
            connectedSources.delete(id)
            console.log(`Audio ${id} disconnected from equalizer`)
        } catch (err) {
            // Source was already disconnected, just clean up tracking
            connectedSources.delete(id)
            console.log(`Audio ${id} disconnected from equalizer (was already disconnected)`)
        }
    }
}

// Disconnect audio source from equalizer (for integration with existing audio systems)
export function disconnectAudioSourceFromEqualizer(id: string) {
    const connection = connectedSources.get(id)
    if (connection) {
        try {
            // Don't disconnect the source here since AudioAnalyser manages it
            // Just clean up our tracking
            connectedSources.delete(id)
            console.log(`Audio source ${id} disconnected from equalizer`)
        } catch (err) {
            console.error(`Failed to disconnect audio source ${id} from equalizer:`, err)
        }
    }
}

// Update equalizer bands configuration
// Update all equalizer bands
export function updateEqualizerBands(bands: EQBand[]) {
    // Update store immediately (this ensures UI changes are reflected)
    equalizerConfig.update(config => ({
        ...config,
        bands: [...bands]
    }))

    // Apply to equalizer if it's initialized
    if (globalEqualizer) {
        globalEqualizer.updateBands(bands)
    }
}

// Update individual band gain (for real-time adjustments)
export function updateEqualizerBandGain(bandIndex: number, gain: number) {
    // Update store immediately (this ensures UI changes are reflected)
    equalizerConfig.update(config => {
        const newBands = [...config.bands]
        if (newBands[bandIndex]) {
            newBands[bandIndex].gain = gain
        }
        return {
            ...config,
            bands: newBands
        }
    })

    // Apply to equalizer if it's initialized
    if (globalEqualizer) {
        globalEqualizer.setBandGain(bandIndex, gain)
    }
}

// Update a single equalizer band
export function updateEqualizerBand(bandIndex: number, band: EQBand) {
    // Update store immediately (this ensures UI changes are reflected)
    equalizerConfig.update(config => {
        const newBands = [...config.bands]
        if (bandIndex >= 0 && bandIndex < newBands.length) {
            newBands[bandIndex] = { ...band }
        }
        return {
            ...config,
            bands: newBands
        }
    })

    // Apply to equalizer if it's initialized
    if (globalEqualizer) {
        globalEqualizer.updateBand(bandIndex, band)
    }
}

// Enable/disable equalizer
export function setEqualizerEnabled(enabled: boolean) {
    // Update store immediately (this ensures UI changes are reflected)
    equalizerConfig.update(config => ({
        ...config,
        enabled
    }))

    // Apply to equalizer if it's initialized
    if (globalEqualizer) {
        globalEqualizer.setEnabled(enabled)
    }
}

// Get current equalizer configuration
function getEqualizerConfig(): EqualizerConfig {
    const config = get(equalizerConfig)
    if (!config.bands?.length) config.bands = AudioEqualizer.getDefaultBands()
    // importing clone here breaks startup file reading order
    return JSON.parse(JSON.stringify(config))
}

// Connect output to destination (speakers/headphones)
export function connectEqualizerToDestination(outputNode: AudioNode) {
    if (audioContext && outputNode) {
        try {
            outputNode.connect(audioContext.destination)
        } catch (err) {
            console.error("Failed to connect equalizer to audio destination:", err)
        }
    }
}

// Get the audio context for other audio modules
export function getAudioContext(): AudioContext | null {
    return audioContext
}

// Get all connected source IDs (for debugging)
export function getConnectedSourceIds(): string[] {
    return Array.from(connectedSources.keys())
}

// Get a connected source's output node (for connection management)
export function getConnectedSourceOutput(id: string): AudioNode | null {
    const connection = connectedSources.get(id)
    return connection ? connection.outputNode : null
}

// Check if equalizer is properly initialized
export function isEqualizerReady(): boolean {
    return !!(globalEqualizer && audioContext)
}

// Reconnect all active audio sources (for enable/disable functionality)
export function reconnectAllAudioSources() {
    console.log("EQ enable/disable state changed - audio reconnection needed")
    console.warn("Note: For full effect, restart audio playback after changing EQ enable/disable state")

    // For a complete solution, we would need to:
    // 1. Track original audio elements/streams  
    // 2. Disconnect all current connections
    // 3. Reconnect through the EQ with new enabled state
    // This is complex due to integration with AudioAnalyser

    // For now, log the state change for debugging
    if (globalEqualizer) {
        console.log(`EQ is now ${globalEqualizer.getConfig().enabled ? 'enabled' : 'disabled'}`)
    }
}

// Cleanup function
export function disposeEqualizer() {
    // Disconnect all sources
    for (const [id] of connectedSources) {
        disconnectAudioFromEqualizer(id)
    }

    // Dispose equalizer
    if (globalEqualizer) {
        globalEqualizer.dispose()
        globalEqualizer = null
    }

    // Close audio context if we created it
    if (audioContext) {
        audioContext.close()
        audioContext = null
    }

    console.log("Audio equalizer disposed")
}