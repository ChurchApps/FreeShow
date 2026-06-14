import type { Size } from "electron"
import type { PlaybackChannel } from "macadam"
import os from "os"
import util from "../ndi/vingester-util"
import { wait } from "../utils/helpers"
import { BlackmagicManager } from "./BlackmagicManager"
import { BufferManager } from "./BufferManager"
import { ImageBufferConverter, ImageBufferConverter10Bit, ImageBufferConverter10BitRGB, ImageBufferConverter12BitRGB } from "./ImageBufferConverter"
import { getMacadam } from "./macadamLoader"

const SEGFAULT_PRONE_DEVICES: Set<string> = new Set()

interface PlaybackData {
    playback: PlaybackChannel
    scheduledFrames: number
    pixelFormat: string
    displayMode: string
    targetSize: Size
    expectedVideoFrameSize: number
    expectedAudioSampleCount: number
    lastVideoSizeWarningTime?: number
    lastAudioSizeWarningTime?: number
    isStarted: boolean
    lastFrameTime?: number
    audioChannels?: number
    scheduleFailCount?: number
    totalFramesDropped: number
    targetBufferSize: number
    deviceIndex: number
    enableKeying?: boolean
    needsReinit?: boolean
    recoveryAttempts?: number
    frameProcessing?: boolean
    conversionBackoffUntil?: number
    conversionErrorCount?: number
}

interface AudioQueueState {
    queue: Buffer[]
    offset: number
    length: number
}

/**
 * Manages Blackmagic Design video output devices using the macadam library
 */
export class BlackmagicSender {
    // Track used device indices globally, to prevent multiple outputs from trying to use the same device
    private static usedDeviceIndices: Set<number> = new Set()
    // Global mutex: ensures only one macadam.playback() init runs at a time.
    // Simultaneous inits on different ports of the same physical card (e.g. DeckLink Duo 2 Mini)
    // can crash the DeckLink SDK native layer.
    private static macadamInitMutex: Promise<void> = Promise.resolve()
    // Core state
    static playbackData: { [key: string]: PlaybackData } = {}
    static initializationInProgress: { [key: string]: Promise<boolean> | undefined } = {}

    // Audio buffers cache
    static silentAudioBuffers: { [key: string]: Buffer } = {}

    // Audio state tracking (always enabled for Blackmagic)
    // Keep independent read cursors per output to avoid cross-output audio starvation.
    static audioQueuesByOutput: { [outputId: string]: AudioQueueState } = {}

    // Device configuration
    static devicePixelMode: "BGRA" | "ARGB" = os.endianness() === "BE" ? "ARGB" : "BGRA"

    // Control state
    static isPaused: { [key: string]: boolean } = {}
    private static readonly EMPTY_BUFFER = Buffer.alloc(0)
    private static readonly MAX_CONVERSION_BUFFER_BYTES = 128 * 1024 * 1024
    private static readonly CONVERSION_BUFFER_POOL_SIZE = 6
    private static conversionBufferPools: {
        [outputId: string]: {
            size: number
            buffers: Buffer[]
            index: number
        }
    } = {}
    // Caches for parsing repeated display mode strings
    private static frameRateCache: { [displayMode: string]: { nominal: number; accurate: number } } = {}

    // Configuration constants
    private static readonly CLEANUP_INTERVAL = 30 * 1000 // 30 seconds

    // Global cleanup timer
    private static globalCleanupTimer?: NodeJS.Timeout

    static get audioQueueLength(): number {
        return Object.values(this.audioQueuesByOutput).reduce((sum, q) => sum + q.length, 0)
    }

    static initialize(outputId?: string, deviceIndex?: number, displayModeName?: string, pixelFormat?: string, enableKeying?: boolean, audioChannels = 2) {
        // Start global memory cleanup
        if (!this.globalCleanupTimer) {
            this.globalCleanupTimer = setInterval(() => {
                this.performGlobalCleanup()
            }, this.CLEANUP_INTERVAL)
        }

        // If parameters are provided, handle the old initialization logic
        if (outputId && deviceIndex !== undefined && displayModeName && pixelFormat) {
            return this.initializeDevice(outputId, deviceIndex, displayModeName, pixelFormat, enableKeying || false, audioChannels)
        }

        // Return undefined if no device-specific initialization
        return Promise.resolve(undefined)
    }

    static async initializeDevice(outputId: string, deviceIndex: number, displayModeName: string, pixelFormat: string, enableKeying: boolean, audioChannels = 2) {
        const currentOutputDeviceIndex = this.playbackData[outputId]?.deviceIndex
        // prevent using a device if already in use by another output
        if (this.usedDeviceIndices.has(deviceIndex) && currentOutputDeviceIndex !== deviceIndex) {
            console.error(`Device index ${deviceIndex} is already in use by another output. Initialization aborted.`)
            return false
        }

        // Check if initialization is already in progress for this device
        if (this.initializationInProgress[outputId]) {
            console.log(`Initialization already in progress for ${outputId}, waiting for completion...`)
            return this.initializationInProgress[outputId]
        }

        this.usedDeviceIndices.add(deviceIndex)

        // Create a promise that tracks this initialization
        const initPromise = this._performInitializeDevice(outputId, deviceIndex, displayModeName, pixelFormat, enableKeying, audioChannels)

        // Store the promise to prevent concurrent attempts
        this.initializationInProgress[outputId] = initPromise

        try {
            const result = await initPromise
            if (!result) this.usedDeviceIndices.delete(deviceIndex)
            return result
        } finally {
            // Clean up the promise when done
            delete this.initializationInProgress[outputId]
        }
    }

    static async _performInitializeDevice(outputId: string, deviceIndex: number, displayModeName: string, pixelFormat: string, enableKeying: boolean, audioChannels = 2) {
        const macadam = getMacadam()
        if (!macadam) {
            console.error("Cannot initialize Blackmagic device: macadam module not available")
            return false
        }

        // Skip immediately if this device is known to cause segfaults
        if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
            console.warn(`Skipping initialization of problematic device ${outputId}`)
            return false
        }

        console.log(`Initializing Blackmagic sender [${outputId}] - Mode: ${displayModeName}, Format: ${pixelFormat}`)

        // Proper cleanup if sender already exists
        if (this.playbackData[outputId]) {
            try {
                const prevDeviceIndex = this.playbackData[outputId].deviceIndex
                if (typeof prevDeviceIndex === "number") this.usedDeviceIndices.delete(prevDeviceIndex)

                this.stop(outputId)
                // Add a small delay to ensure hardware has time to reset
                await wait(2000) // Extra long delay
            } catch (err) {
                console.error(`Error stopping existing sender: ${err instanceof Error ? err.message : String(err)}`)
            }
        }

        this.isPaused[outputId] = false

        // Always use at least 2 audio channels to ensure proper audio support
        const actualAudioChannels = Math.max(2, audioChannels || 2)

        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts) {
            try {
                // Use completely isolated promise with timeout for macadam initialization
                // This is critical to prevent segfaults during hardware initialization
                const playback = await new Promise<PlaybackChannel>((resolve, reject) => {
                    // Timeout after 10 seconds
                    const timeoutId = setTimeout(() => {
                        reject(new Error("Playback initialization timed out after 10 seconds"))
                    }, 10000)

                    // Wrap in try-catch to ensure cleanup of timeout
                    try {
                        // Get display mode and pixel format objects
                        const displayMode = BlackmagicManager.getDisplayMode(displayModeName)
                        const pixelFormatValue = BlackmagicManager.getPixelFormat(pixelFormat)

                        if (!displayMode) {
                            clearTimeout(timeoutId)
                            return reject(new Error(`Invalid display mode: ${displayModeName}`))
                        }

                        if (!pixelFormatValue) {
                            clearTimeout(timeoutId)
                            return reject(new Error(`Invalid pixel format: ${pixelFormat}`))
                        }

                        // Serialize macadam.playback() calls globally to prevent
                        // simultaneous inits on the same physical card from crashing the native SDK.
                        let mutexRelease: () => void
                        const prevMutex = BlackmagicSender.macadamInitMutex
                        BlackmagicSender.macadamInitMutex = new Promise<void>((res) => {
                            mutexRelease = res
                        })

                        prevMutex
                            .then(() => {
                                // Pause active senders while the DeckLink SDK initializes a new device.
                                // Active frame scheduling on other ports of the same physical card can crash the native SDK.
                                const pausedOthers = Object.keys(BlackmagicSender.playbackData).filter((id) => id !== outputId && !BlackmagicSender.isPaused[id])
                                for (const otherId of pausedOthers) BlackmagicSender.isPaused[otherId] = true

                                const actualEnableKeying = enableKeying ? BlackmagicManager.isAlphaSupported(pixelFormat) : false

                                const playbackOptions: any = {
                                    deviceIndex,
                                    displayMode,
                                    pixelFormat: pixelFormatValue,
                                    channels: actualAudioChannels,
                                    sampleRate: macadam.bmdAudioSampleRate48kHz,
                                    sampleType: macadam.bmdAudioSampleType16bitInteger
                                }

                                if (actualEnableKeying) {
                                    playbackOptions.enableKeying = true
                                    const devices = BlackmagicManager.getDevices()
                                    const device = devices[deviceIndex]
                                    playbackOptions.isExternal = device?.supportsExternalKeying ?? true
                                }

                                return macadam.playback(playbackOptions).finally(() => {
                                    for (const otherId of pausedOthers) {
                                        if (BlackmagicSender.playbackData[otherId]) BlackmagicSender.isPaused[otherId] = false
                                    }
                                })
                            })
                            .then((result: any) => {
                                mutexRelease()
                                clearTimeout(timeoutId)
                                resolve(result as PlaybackChannel)
                            })
                            .catch((error: any) => {
                                mutexRelease()
                                clearTimeout(timeoutId)
                                reject(error)
                            })
                    } catch (err) {
                        clearTimeout(timeoutId)
                        reject(err)
                    }
                })

                // Use BufferManager for optimal buffer size calculation
                const targetBufferSize = BufferManager.calculateOptimalBufferSize(displayModeName, pixelFormat)
                const targetSize = this.getDimensionsForDisplayMode(displayModeName)
                const expectedVideoFrameSize = this.getExpectedVideoFrameSize(targetSize, pixelFormat)
                const expectedAudioSampleCount = Math.round(48000 / BlackmagicSender.getAccurateFrameRate(displayModeName))

                // Clear conversion buffer pool for this output to handle resolution changes
                delete this.conversionBufferPools[outputId]

                // Clear device from problematic list if it initializes successfully
                SEGFAULT_PRONE_DEVICES.delete(outputId)

                // Setup playback data
                this.playbackData[outputId] = {
                    playback,
                    scheduledFrames: 0,
                    pixelFormat,
                    displayMode: displayModeName,
                    targetSize,
                    expectedVideoFrameSize,
                    expectedAudioSampleCount,
                    lastVideoSizeWarningTime: 0,
                    lastAudioSizeWarningTime: 0,
                    isStarted: false,
                    audioChannels: actualAudioChannels,
                    totalFramesDropped: 0,
                    targetBufferSize,
                    deviceIndex,
                    enableKeying,
                    needsReinit: false,
                    recoveryAttempts: 0,
                    lastFrameTime: Date.now()
                }

                this.audioQueuesByOutput[outputId] = { queue: [], offset: 0, length: 0 }

                // CRITICAL: Disable frame callback immediately to prevent debug spam
                if (typeof (playback as any).onFramePlayed === "function") {
                    ;(playback as any).onFramePlayed(() => {
                        // Do nothing - completely disable frame callbacks
                    })
                }

                return true
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err)
                attempts++
                console.error(`Failed to initialize playback (attempt ${attempts}): ${errorMessage}`)

                // If keying is not supported, retry without keying
                if (enableKeying && (errorMessage.toLowerCase().includes("keying") || errorMessage.toLowerCase().includes("keyer"))) {
                    console.warn(`Blackmagic initialization failed due to keying issues. Retrying with keying disabled. Error: ${errorMessage}`)
                    enableKeying = false
                    attempts-- // Don't count this as a full attempt
                }

                if (attempts < maxAttempts) {
                    // Wait longer between each attempt
                    const waitTime = 2000 * attempts // Longer delays between attempts
                    console.log(`Waiting ${waitTime / 1000} seconds before retrying...`)
                    await wait(waitTime)
                    console.log(`Retrying initialization for ${outputId}...`)
                }
            }
        }

        console.error(`Failed to initialize ${outputId} after ${maxAttempts} attempts`)

        // Mark this device as problematic temporarily (will be cleared on successful init or manual reset)
        SEGFAULT_PRONE_DEVICES.add(outputId)
        console.warn(`Blackmagic device ${outputId} has been temporarily disabled due to initialization failures. Try changing resolution or restarting.`)

        return false
    }

    static performGlobalCleanup() {
        // Clean up unused silent audio buffers
        this.cleanupSilentAudioBuffers()
    }

    static cleanupSilentAudioBuffers() {
        // Keep only commonly used channel configurations
        const commonChannels = [1, 2, 6, 8]
        const activeDisplayModes = new Set(Object.values(this.playbackData).map((d) => d.displayMode))

        for (const bufferKey in this.silentAudioBuffers) {
            const separatorIndex = bufferKey.indexOf("_")
            const channels = parseInt(separatorIndex === -1 ? bufferKey : bufferKey.slice(0, separatorIndex), 10)
            const displayMode = separatorIndex === -1 ? "default" : bufferKey.slice(separatorIndex + 1)

            if (!commonChannels.includes(channels) || (displayMode !== "default" && !activeDisplayModes.has(displayMode))) {
                delete this.silentAudioBuffers[bufferKey]
            }
        }
    }

    static isDeviceStable(outputId: string): boolean {
        return !SEGFAULT_PRONE_DEVICES.has(outputId)
    }

    static resetProblematicDevice(outputId: string): boolean {
        if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
            SEGFAULT_PRONE_DEVICES.delete(outputId)
            return true
        }
        return false
    }

    private static resolveFrameRates(displayMode: string): { nominal: number; accurate: number } {
        const cached = this.frameRateCache[displayMode]
        if (cached) return cached

        let result: { nominal: number; accurate: number }
        if (displayMode.includes("59.94") || displayMode.includes("5994")) result = { nominal: 60, accurate: 59.94 }
        else if (displayMode.includes("29.97") || displayMode.includes("2997")) result = { nominal: 30, accurate: 29.97 }
        else if (displayMode.includes("23.98") || displayMode.includes("2398")) result = { nominal: 24, accurate: 23.976 }
        else if (displayMode.includes("60")) result = { nominal: 60, accurate: 60 }
        else if (displayMode.includes("50")) result = { nominal: 50, accurate: 50 }
        else if (displayMode.includes("30")) result = { nominal: 30, accurate: 30 }
        else if (displayMode.includes("25")) result = { nominal: 25, accurate: 25 }
        else if (displayMode.includes("24")) result = { nominal: 24, accurate: 24 }
        else result = { nominal: 30, accurate: 30 } // Default fallback

        this.frameRateCache[displayMode] = result
        return result
    }

    // Parse nominal frame rate for FPS expectations and health checks.
    static getExpectedFrameRate(displayMode: string): number {
        return this.resolveFrameRates(displayMode).nominal
    }

    // Get accurate fractional frame rate for audio sample count calculations.
    static getAccurateFrameRate(displayMode: string): number {
        return this.resolveFrameRates(displayMode).accurate
    }

    // Calculate expected video frame size for validation
    static getExpectedVideoFrameSize(size: Size, pixelFormat: string): number {
        const { width, height } = size

        if (pixelFormat.includes("YUV")) {
            // 10-bit YUV uses v210 format: 8/3 bytes per pixel (16 bytes per 6 pixels)
            if (pixelFormat.includes("10")) {
                // This converter packs/pads in 6-pixel groups per row.
                // Each group occupies 16 bytes in v210.
                const groupsPerRow = Math.ceil(width / 6)
                return groupsPerRow * height * 16
            }
            // YUV420 planar: Y full res + U/V at quarter res
            if (pixelFormat.includes("420")) {
                return width * height + (width / 2) * (height / 2) * 2 // Y + U + V
            }
            // YUV422 packed (8-bit): 2 bytes per pixel for UYVY
            if (pixelFormat.includes("422")) {
                return width * height * 2
            }
            // Default YUV (assume 8-bit 422)
            return width * height * 2
        }

        if (pixelFormat.includes("12-bit RGB") || pixelFormat.includes("12BitRGB")) {
            // 12-bit RGB: 36 bits per pixel packed in 4.5 bytes
            return Math.ceil(width * height * 4.5)
        }

        if (pixelFormat.includes("10-bit RGB") || pixelFormat.includes("10BitRGB")) {
            // 10-bit RGB: 30 bits per pixel = 3.75 bytes per pixel (packed in 32-bit words = 4 bytes)
            return width * height * 4
        }

        if (pixelFormat.includes("ARGB") || pixelFormat.includes("BGRA")) {
            return width * height * 4 // 4 bytes per pixel
        }

        if (pixelFormat.includes("RGB")) {
            return width * height * 3 // 3 bytes per pixel
        }

        // Default estimate
        return width * height * 2
    }

    private static getDimensionsForDisplayMode(displayMode: string): { width: number; height: number } {
        const normalized = displayMode.toLowerCase().replace(/\s+/g, "")

        // Check for 8K resolutions
        if (normalized.includes("8k") && normalized.includes("4320")) return { width: 7680, height: 4320 }
        if (normalized.includes("8kdci")) return { width: 8192, height: 4320 }

        // Check for 4K resolutions
        if (normalized.includes("4k") && normalized.includes("2160")) return { width: 3840, height: 2160 }
        if (normalized.includes("4kdci")) return { width: 4096, height: 2160 }

        // Check for 2K resolutions
        if (normalized.includes("2kdci")) return { width: 2048, height: 1080 }
        if (normalized.includes("2k")) return { width: 2048, height: 1080 }

        // Check for HD resolutions
        if (normalized.includes("1080")) return { width: 1920, height: 1080 }
        if (normalized.includes("720")) return { width: 1280, height: 720 }

        // Check for SD resolutions
        if (normalized.includes("525") || normalized.includes("ntsc")) return { width: 720, height: 486 }
        if (normalized.includes("625") || normalized.includes("pal")) return { width: 720, height: 576 }

        // default to 1080p if mode is not recognized
        console.warn(`Unrecognized display mode: ${displayMode}, defaulting to 1080p`)
        return { width: 1920, height: 1080 }
    }

    // get dimensions from display mode
    static getTargetDimensions(captureId: string): { width: number; height: number } {
        const displayMode = this.playbackData[captureId]?.displayMode || "1080p30"
        return this.getDimensionsForDisplayMode(displayMode)
    }

    private static getReusableConversionBuffer(outputId: string, byteSize: number): Buffer {
        let pool = this.conversionBufferPools[outputId]

        if (!pool || pool.size !== byteSize) {
            // Log when we're recreating the pool (indicates resolution change)
            if (pool && pool.size !== byteSize) {
                console.log(`Resolution change detected for ${outputId}: ${pool.size} -> ${byteSize} bytes`)
            }

            pool = {
                size: byteSize,
                buffers: Array.from({ length: this.CONVERSION_BUFFER_POOL_SIZE }, () => Buffer.allocUnsafe(byteSize)),
                index: 0
            }
            this.conversionBufferPools[outputId] = pool
        }

        const buffer = pool.buffers[pool.index]
        pool.index = (pool.index + 1) % pool.buffers.length
        return buffer
    }

    static canAcceptFrame(outputId: string): boolean {
        if (SEGFAULT_PRONE_DEVICES.has(outputId)) return false

        const data = this.playbackData[outputId]
        if (!data || !data.playback || data.needsReinit || this.isPaused[outputId]) return false
        if (data.frameProcessing) return false

        const now = Date.now()
        if (data.conversionBackoffUntil && now < data.conversionBackoffUntil) return false

        try {
            const bufferedFrames = data.playback.bufferedFrames()
            // Keep buffer at 1 frame once started for lowest latency
            // During startup, allow small buffer (max 3 frames) for smooth start
            const maxBuffer = data.isStarted ? 1 : Math.min(3, data.targetBufferSize)
            if (bufferedFrames > maxBuffer) return false
        } catch {
            return false
        }

        return true
    }

    static scheduleFrame(outputId: string, videoFrame: Buffer, audioFrame: Buffer | null, framerate = 0) {
        // Skip immediately if this device is known to cause segfaults
        if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
            return
        }

        // Skip processing entirely if the device is paused or being reinitialized
        if (!this.playbackData[outputId] || this.playbackData[outputId]?.needsReinit || this.isPaused[outputId]) {
            return
        }

        // Verify we have valid data
        const data = this.playbackData[outputId]
        if (!data || !data.playback) {
            return
        }

        // Never allow conversion/scheduling work to queue up for this output.
        // If one frame is still processing, drop the incoming frame.
        if (data.frameProcessing) {
            data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
            return
        }

        const now = Date.now()

        // Back off briefly after conversion allocation failures.
        if (data.conversionBackoffUntil && now < data.conversionBackoffUntil) {
            data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
            return
        }

        // Lightweight guard against accidentally flooding schedule() calls.
        // Keep this tied to target FPS so 59.94/60 outputs are not artificially slowed.
        const targetFps = Math.max(1, Number.isFinite(framerate) && framerate > 0 ? framerate : this.getExpectedFrameRate(data.displayMode))
        const frameDurationMs = 1000 / targetFps
        const minInterval = Math.max(1, Math.floor(frameDurationMs * 0.75))
        if (data.lastFrameTime && now - data.lastFrameTime < minInterval) {
            return // Skip this frame - coming too fast
        }
        data.lastFrameTime = now

        const size = data.targetSize

        // Avoid huge accidental allocations in converters.
        if (videoFrame.length > this.MAX_CONVERSION_BUFFER_BYTES || data.expectedVideoFrameSize > this.MAX_CONVERSION_BUFFER_BYTES) {
            if (now - (data.lastVideoSizeWarningTime || 0) > 5000) {
                data.lastVideoSizeWarningTime = now
                console.error(`Skipping oversized frame conversion: input=${videoFrame.length} bytes, expectedOutput=${data.expectedVideoFrameSize} bytes, limit=${this.MAX_CONVERSION_BUFFER_BYTES} bytes`)
            }
            data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
            return
        }

        data.frameProcessing = true

        // Use setTimeout to completely isolate each frame scheduling operation
        // This prevents a crash in one frame from affecting others
        setTimeout(() => {
            try {
                // Skip empty frames
                if (!videoFrame || videoFrame.length === 0) {
                    return
                }

                // Check buffer status
                let bufferedFrames = 0
                try {
                    bufferedFrames = data.playback.bufferedFrames()

                    // Keep buffer minimal once started to prevent accumulation
                    const maxBuffer = data.isStarted ? Math.min(2, Math.max(1, Math.ceil(data.targetBufferSize / 4))) : data.targetBufferSize
                    if (bufferedFrames > maxBuffer) {
                        data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
                        return // Buffer too full, skip frame
                    }
                } catch (err) {
                    console.log(`Buffer check error: ${err instanceof Error ? err.message : String(err)}`)
                    return // Skip frame on any error
                }

                try {
                    // Log frame info and detect actual resolution
                    const now = Date.now()
                    const expectedBytesForDeclaredSize = size.width * size.height * 4
                    const maxAllowedInputBytes = expectedBytesForDeclaredSize * 4 // More lenient for HiDPI

                    // Guard against HiDPI/invalid frame payloads before conversion allocates.
                    if (videoFrame.length !== expectedBytesForDeclaredSize) {
                        const actualPixels = videoFrame.length / 4
                        const actualHeight = Math.round(actualPixels / size.width)

                        // Only reject truly invalid frames (negative/zero height or extremely oversized)
                        if (videoFrame.length > maxAllowedInputBytes || actualHeight <= 0 || !Number.isFinite(actualHeight)) {
                            if (now - (data.lastVideoSizeWarningTime || 0) > 5000) {
                                data.lastVideoSizeWarningTime = now
                                console.warn(`Skipping invalid source frame: got ${videoFrame.length} bytes (~${size.width}x${actualHeight}), expected ${expectedBytesForDeclaredSize} bytes (${size.width}x${size.height})`)
                            }
                            data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
                            return
                        }

                        // Log size mismatch but continue processing (might be valid HiDPI or scaling issue)
                        if (now - (data.lastVideoSizeWarningTime || 0) > 10000) {
                            data.lastVideoSizeWarningTime = now
                            console.log(`Processing frame with size mismatch: got ${videoFrame.length} bytes (~${size.width}x${actualHeight}), expected ${expectedBytesForDeclaredSize} bytes (${size.width}x${size.height})`)
                        }
                    }

                    // Convert frame format
                    let convertedFrame
                    try {
                        const reusableOutputBuffer = this.getReusableConversionBuffer(outputId, data.expectedVideoFrameSize)
                        convertedFrame = this.convertVideoFrameFormat(videoFrame, data.pixelFormat, size, reusableOutputBuffer, data.enableKeying === true)
                        data.conversionErrorCount = 0
                    } catch (err) {
                        console.error(`Frame conversion error: ${err instanceof Error ? err.message : String(err)}`)

                        const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
                        if (message.includes("allocation failed") || message.includes("out of memory")) {
                            const failCount = (data.conversionErrorCount || 0) + 1
                            data.conversionErrorCount = failCount
                            const backoffMs = Math.min(2000, 100 * 2 ** Math.min(5, failCount))
                            data.conversionBackoffUntil = Date.now() + backoffMs
                            data.totalFramesDropped = (data.totalFramesDropped || 0) + 1
                        }
                        return
                    }

                    // Validate frame sizes
                    if (convertedFrame.length !== data.expectedVideoFrameSize && now - (data.lastVideoSizeWarningTime || 0) > 5000) {
                        data.lastVideoSizeWarningTime = now
                        console.warn(`Video frame size mismatch: got ${convertedFrame.length} bytes, expected ${data.expectedVideoFrameSize} bytes for ${size.width}x${size.height} in ${data.pixelFormat}`)
                    }

                    // Get audio safely with correct sample count for the display mode
                    // Use queued audio to get exactly the right amount for this frame
                    const audioChannels = data.audioChannels || 2
                    const outputAudioQueue = this.audioQueuesByOutput[outputId]
                    const audioData = outputAudioQueue && outputAudioQueue.length > 0 && audioFrame !== null ? this.getAudioForFrame(outputId, audioChannels, data.displayMode) : this.getSilentAudio(audioChannels, data.displayMode)

                    // Validate audio buffer size
                    const expectedSampleCount = data.expectedAudioSampleCount
                    const expectedAudioSize = expectedSampleCount * 2 * audioChannels
                    if (audioData.length !== expectedAudioSize && now - (data.lastAudioSizeWarningTime || 0) > 5000) {
                        data.lastAudioSizeWarningTime = now
                        console.warn(`Audio buffer size mismatch: got ${audioData.length} bytes, expected ${expectedAudioSize} bytes (samples: ${expectedSampleCount}, channels: ${data.audioChannels})`)
                    }

                    // Calculate stream time in milliseconds for this frame.
                    // NOTE: `framerate` is frames-per-second, not milliseconds-per-frame.
                    // Using FPS directly here causes slow playback (e.g. 60 -> 16.7fps timing).
                    const currentTime = Math.round(data.scheduledFrames * frameDurationMs)

                    // Calculate correct sample frame count based on actual frame rate
                    // For 48kHz audio: sampleFrameCount = 48000 / frameRate
                    // Use accurate fractional frame rate for precise audio sizing
                    const correctSampleFrameCount = expectedSampleCount

                    // Schedule the frame directly with playback.schedule()
                    const frameDataToSchedule = {
                        video: convertedFrame,
                        audio: audioData,
                        sampleFrameCount: correctSampleFrameCount,
                        time: currentTime
                    }

                    // Use the original schedule method but with BufferManager backpressure check
                    try {
                        // Schedule the frame using the original method
                        data.playback.schedule(frameDataToSchedule)

                        // Assume scheduling was successful if no error was thrown
                        data.scheduledFrames++

                        try {
                            data.playback.hardwareTime()
                            data.playback.scheduledTime()
                        } catch {
                            // Ignore timing errors
                        }

                        // Start playback if needed - use smaller buffer for faster start and lower latency
                        if (!data.isStarted && bufferedFrames >= Math.min(2, data.targetBufferSize)) {
                            try {
                                console.log(`Starting BlackMagic playback with ${bufferedFrames} buffered frames`)
                                data.playback.start({ startTime: 0 })
                                data.isStarted = true
                            } catch (err) {
                                if (err instanceof Error && err.message !== "Already started") {
                                    console.error(`Error starting playback: ${err.message}`)
                                } else {
                                    data.isStarted = true
                                }
                            }
                        }
                    } catch (scheduleErr) {
                        console.error(`Frame scheduling error: ${scheduleErr instanceof Error ? scheduleErr.message : String(scheduleErr)}`)

                        // Handle schedule failures
                        data.scheduleFailCount = (data.scheduleFailCount || 0) + 1

                        // If we're failing too often, reduce buffer target
                        if (data.scheduleFailCount > 5) {
                            data.targetBufferSize = Math.max(3, data.targetBufferSize - 1)
                            data.scheduleFailCount = 0
                            console.log(`Reduced buffer target to ${data.targetBufferSize} due to schedule failures`)
                        }
                    }
                } catch (err) {
                    console.error(`Schedule error: ${err instanceof Error ? err.message : String(err)}`)

                    // If schedule fails completely, mark device as problematic
                    if (err instanceof Error && (err.message.includes("Already stopped") || err.message.includes("Failed") || err.message.includes("Error"))) {
                        // Mark for reinitialization
                        data.needsReinit = true
                        this.isPaused[outputId] = true

                        // Schedule recovery with longer delay
                        setTimeout(() => {
                            this.reinitializePlayback(outputId, data.deviceIndex, data.displayMode, data.pixelFormat, data.enableKeying || false, data.audioChannels || 2)
                        }, 2000)
                    }
                }
            } catch (err) {
                console.error(`General error in frame processing: ${err instanceof Error ? err.message : String(err)}`)
            } finally {
                data.frameProcessing = false
            }
        }, 0) // End setTimeout - this executes the frame scheduling in a separate tick
    }

    static async reinitializePlayback(outputId: string, deviceIndex: number, displayMode: string, pixelFormat: string, enableKeying: boolean, audioChannels = 2) {
        console.log(`Reinitializing playback for ${outputId}`)

        this.isPaused[outputId] = true

        if (this.playbackData[outputId]) {
            const current = this.playbackData[outputId]
            current.recoveryAttempts = (current.recoveryAttempts || 0) + 1

            if (current.recoveryAttempts > 5) {
                console.warn(`Warning: Multiple recovery attempts (${current.recoveryAttempts}) for ${outputId}`)
            }
        }

        // Clean up old playback data with defensive error handling
        if (this.playbackData[outputId]) {
            try {
                // Try to stop the playback, but ignore any errors
                try {
                    this.playbackData[outputId].playback.stop()
                } catch (err) {
                    // Ignore errors during stop
                }
            } catch (err) {
                console.error(`Error cleaning up old playback: ${(err as Error).message}`)
            }
        }

        try {
            await wait(1000)

            // Release the device index before deleting playbackData so initializeDevice
            // doesn't see it as still-in-use and refuse to reinitialize.
            this.usedDeviceIndices.delete(deviceIndex)
            delete this.playbackData[outputId]

            const success = await this.initializeDevice(outputId, deviceIndex, displayMode, pixelFormat, enableKeying, audioChannels)

            if (success) {
                console.log(`Successfully reinitialized playback for ${outputId}`)
                this.isPaused[outputId] = false
            } else {
                console.error(`Failed to reinitialize playback for ${outputId}`)
            }
        } catch (err) {
            console.error(`Error during reinitialization: ${(err as Error).message}`)

            setTimeout(() => {
                this.initializeDevice(outputId, deviceIndex, displayMode, pixelFormat, enableKeying, audioChannels).then((success) => {
                    if (success) {
                        this.isPaused[outputId] = false
                    }
                })
            }, 3000)
        }
    }

    static ensureSilentAudioBuffer(channels: number, displayMode?: string) {
        // Create a unique key for this buffer configuration
        const bufferKey = displayMode ? `${channels}_${displayMode}` : `${channels}_default`

        if (!this.silentAudioBuffers[bufferKey]) {
            // Calculate sample count based on display mode (48kHz audio / frame rate)
            let sampleCount = 1920 // Default for 25fps

            if (displayMode) {
                // Use accurate fractional frame rate for precise audio buffer sizing
                const accurateFrameRate = BlackmagicSender.getAccurateFrameRate(displayMode)
                sampleCount = Math.round(48000 / accurateFrameRate)
            }

            const bufferSize = sampleCount * 2 * channels
            this.silentAudioBuffers[bufferKey] = Buffer.alloc(bufferSize)
        }
    }

    static getSilentAudio(channels = 2, displayMode?: string): Buffer {
        this.ensureSilentAudioBuffer(channels, displayMode)
        const bufferKey = displayMode ? `${channels}_${displayMode}` : `${channels}_default`
        return this.silentAudioBuffers[bufferKey]
    }

    static sendAudioBuffer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        // Queue incoming audio chunks for slicing exact frame amounts per output frame.
        // Blackmagic expects PCM 16-bit integer audio, which is the same format we receive
        const outputIds = Object.keys(this.playbackData)
        if (buffer.length > 0 && outputIds.length > 0) {
            for (const outputId of outputIds) {
                if (!this.audioQueuesByOutput[outputId]) {
                    this.audioQueuesByOutput[outputId] = { queue: [], offset: 0, length: 0 }
                }

                const outputQueue = this.audioQueuesByOutput[outputId]
                outputQueue.queue.push(buffer)
                outputQueue.length += buffer.length
            }
        }

        // Keep buffered audio size reasonable (max 2 seconds of audio)
        const maxBufferSize = sampleRate * 2 * channelCount * 2 // 2 seconds
        for (const outputId of outputIds) {
            const outputQueue = this.audioQueuesByOutput[outputId]
            if (outputQueue && outputQueue.length > maxBufferSize) {
                // Remove oldest audio while preserving chunked structure.
                this.dropOldestAudioBytes(outputQueue, outputQueue.length - maxBufferSize)
            }
        }
    }

    static getAudioForFrame(outputId: string, channelCount: number, displayMode: string): Buffer {
        // Calculate exact audio samples needed for this frame
        const accurateFrameRate = this.getAccurateFrameRate(displayMode)
        const expectedSampleCount = Math.round(48000 / accurateFrameRate)
        const expectedAudioSize = expectedSampleCount * 2 * channelCount // 2 bytes per sample (16-bit)

        const outputQueue = this.audioQueuesByOutput[outputId]
        if (!outputQueue) {
            return this.getSilentAudio(channelCount, displayMode)
        }

        // If we don't have enough audio yet, return silent audio
        if (outputQueue.length < expectedAudioSize) {
            return this.getSilentAudio(channelCount, displayMode)
        }

        // Extract exact amount needed for this frame.
        return this.readAudioBytes(outputQueue, expectedAudioSize)
    }

    private static readAudioBytes(outputQueue: AudioQueueState, byteCount: number): Buffer {
        if (byteCount <= 0 || outputQueue.length < byteCount) {
            return this.EMPTY_BUFFER
        }

        const result = Buffer.allocUnsafe(byteCount)
        let writeOffset = 0
        let remaining = byteCount

        while (remaining > 0 && outputQueue.queue.length > 0) {
            const head = outputQueue.queue[0]
            const availableInHead = head.length - outputQueue.offset
            const take = Math.min(remaining, availableInHead)

            head.copy(result, writeOffset, outputQueue.offset, outputQueue.offset + take)

            writeOffset += take
            remaining -= take
            outputQueue.offset += take
            outputQueue.length -= take

            if (outputQueue.offset >= head.length) {
                outputQueue.queue.shift()
                outputQueue.offset = 0
            }
        }

        return result
    }

    private static dropOldestAudioBytes(outputQueue: AudioQueueState, byteCount: number): void {
        let remaining = byteCount
        while (remaining > 0 && outputQueue.queue.length > 0) {
            const head = outputQueue.queue[0]
            const availableInHead = head.length - outputQueue.offset
            const drop = Math.min(remaining, availableInHead)

            outputQueue.offset += drop
            outputQueue.length -= drop
            remaining -= drop

            if (outputQueue.offset >= head.length) {
                outputQueue.queue.shift()
                outputQueue.offset = 0
            }
        }
    }

    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, reusableOutputBuffer?: Buffer, enableKeying = false) {
        // Check specific bit-depth RGB formats FIRST before generic checks
        if (format.includes("12Bit") || format.includes("12-bit") || format.includes("12 bit")) {
            const isLE = format.includes("RGBLE") || format.includes("RGB LE")
            if (isLE) {
                if (this.devicePixelMode === "BGRA") return ImageBufferConverter12BitRGB.BGRAtoRGBLE(frame, size, reusableOutputBuffer)
                else return ImageBufferConverter12BitRGB.ARGBtoRGBLE(frame, size, reusableOutputBuffer)
            }
            // Compatibility fallback:
            // Some setups show severe vertical artifacts with R12B packing,
            // while R12L packing is stable. Use LE packing for 12-bit RGB too.
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter12BitRGB.BGRAtoRGBLE(frame, size, reusableOutputBuffer)
            else return ImageBufferConverter12BitRGB.ARGBtoRGBLE(frame, size, reusableOutputBuffer)
        } else if (format.includes("RGBXLE") && (format.includes("10Bit") || format.includes("10-bit") || format.includes("10 bit"))) {
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter10BitRGB.BGRAtoRGBXLE(frame, size, reusableOutputBuffer)
            else return ImageBufferConverter10BitRGB.ARGBtoRGBXLE(frame, size, reusableOutputBuffer)
        } else if (format.includes("RGBX") && !format.includes("RGBXLE") && (format.includes("10Bit") || format.includes("10-bit") || format.includes("10 bit"))) {
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter10BitRGB.BGRAtoRGBX(frame, size, reusableOutputBuffer)
            else return ImageBufferConverter10BitRGB.ARGBtoRGBX(frame, size, reusableOutputBuffer)
        } else if ((format.includes("10Bit") || format.includes("10-bit") || format.includes("10 bit")) && format.includes("RGB")) {
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter10BitRGB.BGRAtoRGB(frame, size, reusableOutputBuffer)
            else return ImageBufferConverter10BitRGB.ARGBtoRGB(frame, size, reusableOutputBuffer)
        } else if (format.includes("YUV")) {
            if (format.includes("10")) {
                if (this.devicePixelMode === "BGRA") return ImageBufferConverter10Bit.BGRAtoYUV(frame, size, reusableOutputBuffer)
                else return ImageBufferConverter10Bit.ARGBtoYUV(frame, size, reusableOutputBuffer)
            } else {
                if (this.devicePixelMode === "BGRA") return ImageBufferConverter.BGRAtoYUV(frame, size, reusableOutputBuffer)
                else return ImageBufferConverter.ARGBtoYUV(frame, size, reusableOutputBuffer)
            }
        } else if (format.includes("RGBXLE")) {
            const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
            frame.copy(result, 0, 0, frame.length)
            if (this.devicePixelMode === "BGRA") ImageBufferConverter.BGRAtoRGBXLE(result)
            else ImageBufferConverter.ARGBtoRGBXLE(result)
            return result
        } else if (format.includes("RGBLE")) {
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter.BGRAtoRGBLE(frame, reusableOutputBuffer)
            else return ImageBufferConverter.ARGBtoRGBLE(frame, reusableOutputBuffer)
        } else if (format.includes("RGBX")) {
            const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
            frame.copy(result, 0, 0, frame.length)
            if (this.devicePixelMode === "BGRA") util.ImageBufferAdjustment.BGRAtoBGRX(result)
            else ImageBufferConverter.ARGBtoRGBX(result)
            return result
        } else if (format.includes("ARGB")) {
            if (this.devicePixelMode === "BGRA") {
                const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
                frame.copy(result, 0, 0, frame.length)
                // Un-premultiply BGRA before swizzling to ARGB for straight-alpha DeckLink keyer
                if (enableKeying) ImageBufferConverter.unpremultiplyBGRA(result)
                ImageBufferConverter.BGRAtoARGB(result)
                return result
            }
            // devicePixelMode === "ARGB": un-premultiply in-place on a copy
            if (enableKeying) {
                const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
                frame.copy(result, 0, 0, frame.length)
                ImageBufferConverter.unpremultiplyARGB(result)
                return result
            }
            return frame
        } else if (format.includes("BGRA")) {
            if (this.devicePixelMode === "ARGB") {
                const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
                frame.copy(result, 0, 0, frame.length)
                // Un-premultiply ARGB before swizzling to BGRA for straight-alpha DeckLink keyer
                if (enableKeying) ImageBufferConverter.unpremultiplyARGB(result)
                util.ImageBufferAdjustment.ARGBtoBGRA(result)
                return result
            }
            // devicePixelMode === "BGRA": un-premultiply in-place on a copy
            if (enableKeying) {
                const result = reusableOutputBuffer && reusableOutputBuffer.length >= frame.length ? reusableOutputBuffer : Buffer.allocUnsafe(frame.length)
                frame.copy(result, 0, 0, frame.length)
                ImageBufferConverter.unpremultiplyBGRA(result)
                return result
            }
            return frame
        } else if (format.includes("RGB")) {
            if (this.devicePixelMode === "BGRA") return ImageBufferConverter.BGRAtoRGB(frame, reusableOutputBuffer)
            else return ImageBufferConverter.ARGBtoRGB(frame, reusableOutputBuffer)
        }

        return frame
    }

    static stop(outputId: string): boolean {
        const data = this.playbackData[outputId]
        if (!data) return false

        if (typeof data.deviceIndex === "number") this.usedDeviceIndices.delete(data.deviceIndex)

        console.log(`Stopping Blackmagic output: ${outputId}`)

        try {
            // Stop all timers immediately

            // Stop the actual playback
            if (data.playback) {
                try {
                    data.playback.stop()
                } catch (stopErr) {
                    const stopMessage = stopErr instanceof Error ? stopErr.message : String(stopErr)
                    const ignorableStopError = stopMessage.includes("Failed to stop scheduled playback") || stopMessage.includes("Already stopped")

                    if (ignorableStopError) console.warn(`Blackmagic output ${outputId} already stopping/stopped: ${stopMessage}`)
                    else console.error(`Error stopping Blackmagic output: ${stopMessage}`)
                }
            }

            // Set paused flag
            this.isPaused[outputId] = true

            // Remove from tracking
            delete this.playbackData[outputId]
            delete this.initializationInProgress[outputId]
            delete this.conversionBufferPools[outputId]

            // Clear per-output queued audio
            delete this.audioQueuesByOutput[outputId]

            console.log(`Successfully stopped output ${outputId}`)
            return true
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`Error stopping output ${outputId}: ${message}`)

            // Force cleanup even if there was an error
            delete this.playbackData[outputId]
            delete this.initializationInProgress[outputId]
            delete this.conversionBufferPools[outputId]
            delete this.audioQueuesByOutput[outputId]

            return false
        }
    }

    static stopAll(): void {
        console.log("Stopping all Blackmagic outputs...")

        // Stop global cleanup timer
        if (this.globalCleanupTimer) {
            clearInterval(this.globalCleanupTimer)
            this.globalCleanupTimer = undefined
        }

        // Stop all outputs
        const outputIds = Object.keys(this.playbackData)
        outputIds.forEach((outputId) => {
            this.stop(outputId)
        })

        // Force clear all tracking data
        this.playbackData = {}
        this.isPaused = {}
        this.silentAudioBuffers = {}
        this.initializationInProgress = {}
        this.conversionBufferPools = {}
        this.audioQueuesByOutput = {}

        console.log(`Stopped ${outputIds.length} outputs`)
    }

    // Shutdown method for application exit
    static shutdown(): void {
        console.log("Shutting down BlackmagicSender...")
        this.stopAll()
    }
}
