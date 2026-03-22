import type { PlaybackChannel } from "macadam"

interface PlaybackData {
    playback: PlaybackChannel
    scheduledFrames: number
    pixelFormat: string
    displayMode: string
    isStarted: boolean
    framesSinceLastCheck: number
    lastPerformanceCheck: number
    totalFramesDropped: number
    targetBufferSize: number
    scheduleFailCount?: number
}

/**
 * Manages buffer sizes and health monitoring for Blackmagic playback
 */
export class BufferManager {
    private static readonly MIN_BUFFER_SIZE = 3
    private static readonly MAX_BUFFER_SIZE = 15

    /**
     * Calculates optimal buffer size based on display mode and pixel format
     */
    static calculateOptimalBufferSize(displayMode: string, pixelFormat: string): number {
        let baseSize = 5 // Conservative starting point

        // Adjust based on resolution
        if (displayMode.includes("4K") || displayMode.includes("4k")) {
            baseSize = 8
        } else if (displayMode.includes("1080")) {
            baseSize = 6
        } else if (displayMode.includes("720")) {
            baseSize = 4
        }

        // Adjust for format complexity
        if (pixelFormat.includes("10-bit")) {
            baseSize += 2
        } else if (pixelFormat.includes("RGB") || pixelFormat.includes("ARGB")) {
            baseSize += 1
        }

        // Consider interlaced content
        if (displayMode.includes("i")) {
            baseSize += 1
        }

        return Math.min(Math.max(baseSize, this.MIN_BUFFER_SIZE), this.MAX_BUFFER_SIZE)
    }

    /**
     * Monitors buffer health and adjusts target buffer size
     */
    static monitorBufferHealth(outputId: string, playbackData: { [key: string]: PlaybackData }, getExpectedFrameRate: (displayMode: string) => number) {
        if (!playbackData[outputId]) return

        const data = playbackData[outputId]

        try {
            const bufferedFrames = data.playback.bufferedFrames()
            const now = Date.now()

            // Only check periodically to reduce overhead
            if (now - data.lastPerformanceCheck < 2000) return // Check every 2 seconds

            const timeDiff = (now - data.lastPerformanceCheck) / 1000
            const currentFPS = data.framesSinceLastCheck / timeDiff
            const expectedFps = getExpectedFrameRate(data.displayMode)

            // Conservative buffer adjustments
            if (currentFPS < expectedFps * 0.8 && bufferedFrames < 3) {
                data.targetBufferSize = Math.min(this.MAX_BUFFER_SIZE, data.targetBufferSize + 1)
                console.log(`Increasing buffer size to ${data.targetBufferSize} due to low FPS`)
            }

            // Reduce buffer when too large
            if (bufferedFrames > data.targetBufferSize * 0.8 && data.targetBufferSize > this.MIN_BUFFER_SIZE) {
                data.targetBufferSize = Math.max(this.MIN_BUFFER_SIZE, data.targetBufferSize - 1)
                console.log(`Reducing buffer size to ${data.targetBufferSize}`)
            }

            // Emergency reduction if buffer gets too large
            if (data.targetBufferSize > this.MAX_BUFFER_SIZE) {
                data.targetBufferSize = this.MAX_BUFFER_SIZE
                console.warn(`Capping buffer size at ${this.MAX_BUFFER_SIZE}`)
            }

            // Reset counters
            data.framesSinceLastCheck = 0
            data.lastPerformanceCheck = now
        } catch (err) {
            console.error(`Error monitoring buffer: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    /**
     * Schedules frame with backpressure handling
     */
    static scheduleFrameWithBackpressure(outputId: string, frameData: any, playbackData: { [key: string]: PlaybackData }): boolean {
        const data = playbackData[outputId]
        if (!data) return false

        try {
            const bufferedFrames = data.playback.bufferedFrames()

            // Implement backpressure - drop frames if buffer is too full
            if (bufferedFrames > data.targetBufferSize * 1.2) {
                console.warn(`Dropping frame due to buffer overflow (${bufferedFrames}/${data.targetBufferSize})`)
                data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
                return false
            }

            // Schedule the frame
            data.playback.schedule(frameData)
            data.scheduledFrames++
            data.framesSinceLastCheck++

            return true
        } catch (err) {
            console.error(`Error scheduling frame: ${err instanceof Error ? err.message : String(err)}`)
            data.scheduleFailCount = (data.scheduleFailCount || 0) + 1

            // If we're failing too often, reduce buffer target
            if (data.scheduleFailCount > 5) {
                data.targetBufferSize = Math.max(this.MIN_BUFFER_SIZE, data.targetBufferSize - 1)
                data.scheduleFailCount = 0
                console.log(`Reduced buffer target to ${data.targetBufferSize} due to schedule failures`)
            }

            return false
        }
    }
}
