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
                    return Math.min(settings.channelCount, maxChannels)
                }
            }
        }

        // For HTMLAudioElement, we need to detect channels after the audio loads
        if (audio instanceof HTMLAudioElement) {
            try {
                const tempSource = source as MediaElementAudioSourceNode

                // The channelCount property might be available
                if (tempSource.channelCount && tempSource.channelCount > 0) {
                    return Math.min(tempSource.channelCount, maxChannels)
                }
            } catch (err) {
                console.warn("Could not detect channel count from HTMLAudioElement:", err)
            }
        }

        // Check if source has channelCount property
        if ((source as any).channelCount && (source as any).channelCount > 0) {
            return Math.min((source as any).channelCount, maxChannels)
        }

        // Default to stereo - we'll update this dynamically when audio starts playing
        return this.DEFAULT_CHANNELS
    }

    /**
     * Enhanced channel detection that works after audio starts playing
     */
    static detectActiveChannelCount(
        audioContext: AudioContext,
        source: AudioNode,
        sourceId: string,
        maxChannels: number
    ): number {
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
    static getChannelInfo(
        audioContext: AudioContext,
        currentChannels: number,
        maxChannels: number
    ): MultichannelInfo {
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
    static configureNodeForMultichannel(node: AudioNode, channelCount: number): void {
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
}