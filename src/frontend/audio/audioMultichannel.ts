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
        try {
            // First 256 KB is enough for any codec header + initial frames
            const response = await fetch(filePath, { headers: { Range: "bytes=0-262143" } })
            if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`)

            const arrayBuffer = await response.arrayBuffer()
            const offlineCtx = new OfflineAudioContext(maxChannels, 1, 48000)
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)

            const channels = audioBuffer.numberOfChannels
            console.log(`File channel detection: "${filePath}" → ${channels} channels`)
            return Math.min(channels, maxChannels)
        } catch (err) {
            console.warn("Could not detect file channel count:", err)
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

    // DEBUG

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

    static async testMultichannelCapability(audioContext: AudioContext, channelCount: number): Promise<boolean> {
        try {
            const merger = this.createChannelMerger(audioContext, channelCount)

            for (let i = 0; i < channelCount; i++) {
                const osc = audioContext.createOscillator()
                const gain = audioContext.createGain()
                osc.frequency.value = 440 + i * 110
                gain.gain.value = 0.1
                osc.connect(gain)
                gain.connect(merger, 0, i)
                osc.start()
            }

            merger.connect(audioContext.destination)
            await new Promise((resolve) => setTimeout(resolve, 100))
            merger.disconnect()

            console.log(`✅ ${channelCount}-channel test successful`)
            return true
        } catch (err) {
            console.warn(`❌ ${channelCount}-channel test failed:`, err)
            return false
        }
    }
}
