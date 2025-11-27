/**
 * Multichannel Audio Support
 *
 * This module provides dynamic multichannel audio detection and configuration
 * for the FreeShow audio system. It handles up to 8 channels (7.1 surround sound)
 * and automatically detects system capabilities.
 */

export interface MultichannelInfo {
    currentChannels: number
    maxSupportedChannels: number
    systemMaxChannels: number
    supportsMultichannel: boolean
}

export class AudioMultichannel {
    static readonly DEFAULT_CHANNELS = 2
    static readonly MAX_CHANNELS = 8 // Support up to 8 channels (7.1 surround)

    /**
     * Detect channel count from audio source
     */
    static detectChannelCount(source: AudioNode, audio: HTMLMediaElement | MediaStream, maxChannels: number): number {
        // For MediaStream, try to get channel count from audio tracks
        if (audio instanceof MediaStream) {
            const audioTracks = audio.getAudioTracks()
            if (audioTracks.length > 0) {
                const settings = audioTracks[0].getSettings()
                if (settings.channelCount && settings.channelCount > 0) {
                    console.log(`MediaStream reports ${settings.channelCount} channels`)
                    return Math.min(settings.channelCount, maxChannels)
                }

                // Try constraints as fallback
                const constraints = audioTracks[0].getConstraints()
                if (constraints.channelCount && typeof constraints.channelCount === "number") {
                    console.log(`MediaStream constraints suggest ${constraints.channelCount} channels`)
                    return Math.min(constraints.channelCount, maxChannels)
                }
            }
        }

        // For HTMLAudioElement, we need to detect channels after the audio loads
        if (audio instanceof HTMLAudioElement) {
            try {
                const tempSource = source as MediaElementAudioSourceNode

                // The channelCount property might be available after connection
                if (tempSource.channelCount && tempSource.channelCount > 0) {
                    console.log(`HTMLAudioElement source reports ${tempSource.channelCount} channels`)
                    return Math.min(tempSource.channelCount, maxChannels)
                }

                // Try to use numberOfInputs/numberOfOutputs as hints
                if (tempSource.numberOfOutputs > 0) {
                    console.log(`HTMLAudioElement has ${tempSource.numberOfOutputs} outputs, assuming stereo for now`)
                }
            } catch (err) {
                console.warn("Could not detect channel count from HTMLAudioElement:", err)
            }
        }

        // Check if source has channelCount property
        if ((source as any).channelCount && (source as any).channelCount > 0) {
            console.log(`Generic source reports ${(source as any).channelCount} channels`)
            return Math.min((source as any).channelCount, maxChannels)
        }

        console.log(`Using default ${this.DEFAULT_CHANNELS} channels - will update dynamically`)
        // Default to stereo - we'll update this dynamically when audio starts playing
        return this.DEFAULT_CHANNELS
    }

    /**
     * Enhanced channel detection that works after audio starts playing
     * Uses an AnalyserNode to detect actual audio content
     */
    static detectActiveChannelCount(audioContext: AudioContext, source: AudioNode, sourceId: string, maxChannels: number): Promise<number> {
        return new Promise(resolve => {
            if (!source) {
                resolve(this.DEFAULT_CHANNELS)
                return
            }

            try {
                // Create a temporary analyser to detect actual channel content
                const analyser = audioContext.createAnalyser()
                analyser.fftSize = 256
                analyser.smoothingTimeConstant = 0.3

                // Create a temporary splitter to analyze individual channels
                const tempSplitter = audioContext.createChannelSplitter(maxChannels)
                const tempAnalysers: AnalyserNode[] = []

                // Set up analysers for each potential channel
                for (let i = 0; i < maxChannels; i++) {
                    const channelAnalyser = audioContext.createAnalyser()
                    channelAnalyser.fftSize = 256
                    channelAnalyser.smoothingTimeConstant = 0.3
                    tempAnalysers.push(channelAnalyser)
                    tempSplitter.connect(channelAnalyser, i)
                }

                // Connect source to splitter
                source.connect(tempSplitter)

                // Give audio time to stabilize and analyze
                setTimeout(() => {
                    let detectedChannels = this.DEFAULT_CHANNELS

                    for (let i = 0; i < maxChannels; i++) {
                        const analyser = tempAnalysers[i]
                        const dataArray = new Uint8Array(analyser.frequencyBinCount)
                        analyser.getByteFrequencyData(dataArray)

                        // Check if this channel has significant audio content
                        let hasContent = false
                        for (let j = 0; j < dataArray.length; j++) {
                            if (dataArray[j] > 10) {
                                // Threshold for "significant" audio
                                hasContent = true
                                break
                            }
                        }

                        if (hasContent) {
                            detectedChannels = i + 1
                        }
                    }

                    // Clean up temporary nodes
                    try {
                        source.disconnect(tempSplitter)
                        tempSplitter.disconnect()
                        tempAnalysers.forEach(a => a.disconnect())
                    } catch (err) {
                        // Ignore cleanup errors
                    }

                    console.log(`Runtime analysis detected ${detectedChannels} active channels in source ${sourceId}`)
                    resolve(Math.min(detectedChannels, maxChannels))
                }, 1000) // Wait 1 second for audio to stabilize
            } catch (err) {
                console.warn("Could not perform runtime channel detection:", err)
                resolve(this.DEFAULT_CHANNELS)
            }
        })
    }

    /**
     * Legacy method - kept for compatibility but now returns a Promise
     */
    static detectActiveChannelCountLegacy(audioContext: AudioContext, source: AudioNode, sourceId: string, maxChannels: number): number {
        if (!source) return this.DEFAULT_CHANNELS

        try {
            // For Web Audio API, the actual channel count is determined by the audio content
            // Check the channelCount and channelCountMode properties
            if ((source as any).channelCount) {
                const detectedChannels = (source as any).channelCount
                console.log(`Source ${sourceId} reports ${detectedChannels} channels`)
                return Math.min(detectedChannels, maxChannels)
            }

            // Alternative approach: Use the context's destination to determine output channels
            const contextChannels = audioContext.destination.channelCount
            if (contextChannels > 2) {
                console.log(`Audio context supports ${contextChannels} channels`)
                return Math.min(contextChannels, maxChannels)
            }

            // If we can't determine the exact count, check if the browser/system supports multichannel
            if (audioContext.destination.maxChannelCount > 2) {
                console.log(`System supports up to ${audioContext.destination.maxChannelCount} channels`)
                // For now, we'll assume the source could be multichannel if system supports it
                // This is a conservative approach - in real use, we'd need more sophisticated detection
                return Math.min(audioContext.destination.maxChannelCount, maxChannels)
            }
        } catch (err) {
            console.warn("Could not detect active channel count:", err)
        }

        return this.DEFAULT_CHANNELS // Default to stereo
    }

    /**
     * Check if the audio system supports multichannel output
     */
    static supportsMultichannel(audioContext: AudioContext): boolean {
        return audioContext.destination.maxChannelCount > 2
    }

    /**
     * Get the maximum supported channels by the system
     */
    static getMaxSupportedChannels(audioContext: AudioContext, maxChannels: number): number {
        return Math.min(audioContext.destination.maxChannelCount, maxChannels)
    }

    /**
     * Get current channel information
     */
    static getChannelInfo(audioContext: AudioContext, currentChannels: number, maxChannels: number): MultichannelInfo {
        return {
            currentChannels,
            maxSupportedChannels: this.getMaxSupportedChannels(audioContext, maxChannels),
            systemMaxChannels: audioContext.destination.maxChannelCount,
            supportsMultichannel: this.supportsMultichannel(audioContext)
        }
    }

    /**
     * Configure audio node for multichannel output
     */
    static configureNodeForMultichannel(node: AudioNode, channelCount: number) {
        if (node.channelCount !== channelCount) {
            node.channelCount = channelCount
            node.channelCountMode = "explicit"
            node.channelInterpretation = "speakers"
        }
    }

    /**
     * Create a properly configured channel splitter
     */
    static createChannelSplitter(audioContext: AudioContext, channelCount: number): ChannelSplitterNode {
        return audioContext.createChannelSplitter(channelCount)
    }

    /**
     * Create a properly configured channel merger
     */
    static createChannelMerger(audioContext: AudioContext, channelCount: number): ChannelMergerNode {
        return audioContext.createChannelMerger(channelCount)
    }

    /**
     * Create a properly configured gain node for multichannel
     */
    static createMultichannelGainNode(audioContext: AudioContext, channelCount: number): GainNode {
        const gainNode = audioContext.createGain()
        this.configureNodeForMultichannel(gainNode, channelCount)
        return gainNode
    }

    /**
     * Create a properly configured destination node for multichannel
     */
    static createMultichannelDestination(audioContext: AudioContext, channelCount: number): MediaStreamAudioDestinationNode {
        const destNode = audioContext.createMediaStreamDestination()
        this.configureNodeForMultichannel(destNode, channelCount)
        return destNode
    }

    /**
     * Check if a channel count update is beneficial
     */
    static shouldUpdateChannelCount(currentChannels: number, newChannelCount: number): boolean {
        return newChannelCount > currentChannels && newChannelCount <= this.MAX_CHANNELS
    }

    /**
     * Validate channel count is within acceptable range
     */
    static validateChannelCount(channelCount: number): number {
        return Math.max(this.DEFAULT_CHANNELS, Math.min(channelCount, this.MAX_CHANNELS))
    }

    // DEBUG

    /**
     * Debug function to log current multichannel status
     */
    static debugChannelInfo(audioContext: AudioContext, currentChannels: number, maxChannels: number) {
        console.group("🎵 Multichannel Audio Debug Info")
        console.log(`Current channels: ${currentChannels}`)
        console.log(`Max supported by system: ${audioContext.destination.maxChannelCount}`)
        console.log(`Max configured: ${maxChannels}`)
        console.log(`Supports multichannel: ${this.supportsMultichannel(audioContext)}`)
        console.log(`Audio context destination channels: ${audioContext.destination.channelCount}`)
        console.log(`Audio context sample rate: ${audioContext.sampleRate}`)
        console.log(`Audio context state: ${audioContext.state}`)
        console.groupEnd()
    }

    /**
     * Test multichannel capability with a sine wave generator
     */
    static async testMultichannelCapability(audioContext: AudioContext, channelCount: number): Promise<boolean> {
        try {
            console.log(`Testing ${channelCount}-channel audio capability...`)

            // Create oscillators for each channel
            const oscillators: OscillatorNode[] = []
            const gains: GainNode[] = []
            const merger = this.createChannelMerger(audioContext, channelCount)

            for (let i = 0; i < channelCount; i++) {
                const osc = audioContext.createOscillator()
                const gain = audioContext.createGain()

                osc.frequency.value = 440 + i * 110 // Different frequency per channel
                gain.gain.value = 0.1 // Low volume

                osc.connect(gain)
                gain.connect(merger, 0, i)

                oscillators.push(osc)
                gains.push(gain)
            }

            // Test connection to destination
            merger.connect(audioContext.destination)

            // Start and stop quickly to test
            oscillators.forEach(osc => osc.start())

            await new Promise(resolve => setTimeout(resolve, 100))

            oscillators.forEach(osc => osc.stop())
            merger.disconnect()

            console.log(`✅ ${channelCount}-channel test successful`)
            return true
        } catch (err) {
            console.warn(`❌ ${channelCount}-channel test failed:`, err)
            return false
        }
    }
}
