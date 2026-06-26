export interface MultichannelInfo {
    currentChannels: number
    maxSupportedChannels: number
    systemMaxChannels: number
    supportsMultichannel: boolean
}

export class AudioMultichannel {
    static readonly DEFAULT_CHANNELS = 2
    static readonly MAX_CHANNELS = 8 // 7.1 surround

    // DETECTION

    /**
     * Detect the true number of channels encoded in an audio file.
     * MediaElementAudioSourceNode always reports 2 in Chromium, so we fetch a small
     * slice of the file and decode it with OfflineAudioContext to read AudioBuffer.numberOfChannels.
     * Returns DEFAULT_CHANNELS on any failure.
     */
    static async detectFileChannelCount(filePath: string, maxChannels: number): Promise<number> {
        if (!filePath || filePath.startsWith("blob:") || filePath.startsWith("data:")) return this.DEFAULT_CHANNELS

        try {
            // Use a short timeout for network files to avoid hanging
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3000)

            // First 256 KB is enough for any codec header + initial frames
            const response = await fetch(filePath, {
                headers: { Range: "bytes=0-262143" },
                signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (!response.ok && response.status !== 206) {
                // If Range is not supported, we don't want to download the whole file
                // for detection, so we just return default
                return this.DEFAULT_CHANNELS
            }

            const arrayBuffer = await response.arrayBuffer()
            if (arrayBuffer.byteLength === 0) return this.DEFAULT_CHANNELS

            const offlineCtx = new OfflineAudioContext(maxChannels, 1, 48000)
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)

            const channels = audioBuffer.numberOfChannels

            return Math.min(channels, maxChannels)
        } catch (err) {
            // AggregateError or AbortError are possible here
            console.warn(`Channel detection for "${filePath}" failed:`, err instanceof Error ? err.message : err)
            return this.DEFAULT_CHANNELS
        }
    }

    // SYSTEM

    static supportsMultichannel(audioContext: AudioContext): boolean {
        return audioContext.destination.maxChannelCount > 2
    }

    static getMaxSupportedChannels(audioContext: AudioContext, maxChannels: number): number {
        return Math.min(audioContext.destination.maxChannelCount, maxChannels)
    }

    static getChannelInfo(audioContext: AudioContext, currentChannels: number, maxChannels: number): MultichannelInfo {
        return {
            currentChannels,
            maxSupportedChannels: this.getMaxSupportedChannels(audioContext, maxChannels),
            systemMaxChannels: audioContext.destination.maxChannelCount,
            supportsMultichannel: this.supportsMultichannel(audioContext)
        }
    }

    // NODE HELPERS

    static configureNodeForMultichannel(node: AudioNode, channelCount: number) {
        if (node.channelCount !== channelCount) {
            node.channelCount = channelCount
            node.channelCountMode = "explicit"
            node.channelInterpretation = "speakers"
        }
    }

    static createChannelSplitter(audioContext: AudioContext, channelCount: number): ChannelSplitterNode {
        return audioContext.createChannelSplitter(channelCount)
    }

    static createChannelMerger(audioContext: AudioContext, channelCount: number): ChannelMergerNode {
        return audioContext.createChannelMerger(channelCount)
    }

    static createMultichannelGainNode(audioContext: AudioContext, channelCount: number): GainNode {
        const gainNode = audioContext.createGain()
        this.configureNodeForMultichannel(gainNode, channelCount)
        return gainNode
    }

    static createMultichannelDestination(audioContext: AudioContext, channelCount: number): MediaStreamAudioDestinationNode {
        const destNode = audioContext.createMediaStreamDestination()
        this.configureNodeForMultichannel(destNode, channelCount)
        return destNode
    }

    // VALIDATION

    static shouldUpdateChannelCount(currentChannels: number, newChannelCount: number): boolean {
        return newChannelCount > currentChannels && newChannelCount <= this.MAX_CHANNELS
    }

    static validateChannelCount(channelCount: number): number {
        return Math.max(this.DEFAULT_CHANNELS, Math.min(channelCount, this.MAX_CHANNELS))
    }
}
