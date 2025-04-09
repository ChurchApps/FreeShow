import macadam, {
    PlaybackChannel
} from "macadam"
import os from "os"
import util from "../ndi/vingester-util"
import {
    BlackmagicManager
} from "./BlackmagicManager"
import {
    ImageBufferConverter,
    ImageBufferConverter10Bit
} from "./ImageBufferConverter"
import {
    Size
} from "electron"

interface PlaybackData {
    playback: PlaybackChannel;
    scheduledFrames: number;
    pixelFormat: string;
    displayMode: string;
    isStarted: boolean;
    targetDimensions?: {
        width: number;
        height: number;
    };
    sourceWidth?: number;
    sourceHeight?: number;
    conversionCache?: {
        sourceWidth: number;
        sourceHeight: number;
        lastFormat: string;
        converter: (frame: Buffer) => Buffer;
    };
    monitoringInterval?: NodeJS.Timeout;
    lastLogTime: number;
    audioChannels?: number;
    emptyBufferCount?: number;
    scheduleFailCount?: number;
    framesSinceLastCheck: number;
    lastPerformanceCheck: number;
    totalFramesDropped: number;
    hardwareTimeOffset?: number;
    targetBufferSize: number;
    // Add these new properties
    deviceIndex: number;
    enableKeying?: boolean;
    needsReinit?: boolean;
}

export class BlackmagicSender {
    static playbackData: {
        [key: string]: PlaybackData
    } = {}
    
    static devicePixelMode: "BGRA" | "ARGB" = os.endianness() === "BE" ? "ARGB" : "BGRA";
    static framePromises: { [key: string]: { [time: number]: Promise<any> } } = {};
    static isPaused: { [key: string]: boolean } = {};
    static frameSkipCounter: { [key: string]: number } = {};
    
    // Buffer for silent audio to avoid recreating it for each frame
    static silentAudioBuffers: { [channels: number]: Buffer } = {};

    // set audioChannels to 0 to disable audio
   static async initialize(outputId: string, deviceIndex: number, displayModeName: string, 
                       pixelFormat: string, enableKeying: boolean, audioChannels: number = 2) {
    console.log(`Initializing Blackmagic sender [${outputId}] - Mode: ${displayModeName}, Format: ${pixelFormat}`);

    if (this.playbackData[outputId]) this.stop(outputId);

    // Get target dimensions and cache them
    const targetDimensions = this.getTargetDimensions(displayModeName);
    
    this.frameSkipCounter[outputId] = 0;
    this.isPaused[outputId] = false;
    
    // Always use at least 2 audio channels to ensure proper audio support
    const actualAudioChannels = Math.max(2, audioChannels || 2);

    try {
        const playback = await macadam.playback({
            deviceIndex,
            displayMode: BlackmagicManager.getDisplayMode(displayModeName),
            pixelFormat: BlackmagicManager.getPixelFormat(pixelFormat),
            enableKeying: enableKeying ? BlackmagicManager.isAlphaSupported(pixelFormat) : false,
            channels: actualAudioChannels,
            sampleRate: macadam.bmdAudioSampleRate48kHz,
            sampleType: macadam.bmdAudioSampleType16bitInteger,
            startTimecode: "01:00:00:00",
        });

        // Calculate appropriate buffer size based on display mode
        let targetBufferSize = 20; // Default
        if (displayModeName.includes("50") || displayModeName.includes("60") || 
            displayModeName.includes("59.94")) {
            targetBufferSize = 30; // Higher for high frame rates
        }

        this.playbackData[outputId] = {
            playback,
            scheduledFrames: 0,
            pixelFormat,
            displayMode: displayModeName,
            isStarted: false,
            targetDimensions,
            lastLogTime: 0,
            audioChannels: actualAudioChannels,
            framesSinceLastCheck: 0,
            lastPerformanceCheck: Date.now(),
            totalFramesDropped: 0,
            targetBufferSize,
            // Store device parameters for reinitialization
            deviceIndex,
            enableKeying,
            needsReinit: false
        };

        this.framePromises[outputId] = {};
        
        console.log(`Sender initialized with target dimensions: ${targetDimensions.width}x${targetDimensions.height}`);
        return true;
    } catch (err) {
        console.error(`Failed to initialize playback: ${err.message}`);
        return false;
    }
}
   static scheduleFrame(outputId: string, videoFrame: Buffer, audioFrame: Buffer | null, 
                     framerate: number = 1000, size: Size) {
    // First, check if we need to reinitialize
    if (this.playbackData[outputId]?.needsReinit) {
        return; // Skip frame scheduling while waiting for reinit
    }
    
    if (!this.playbackData[outputId] || this.isPaused[outputId]) return;
    
    const data = this.playbackData[outputId];
    
    // Skip empty frames
    if (!videoFrame || videoFrame.length === 0 || size.width === 0 || size.height === 0) {
        return;
    }
    
    try {
        // Check buffer status
        let bufferedFrames = 0;
        
        try {
            bufferedFrames = data.playback.bufferedFrames();
        } catch (err) {
            // Handle "Already stopped" error specifically
            if (err.message === "Already stopped") {
                console.log(`Output ${outputId} playback stopped, attempting to reinitialize`);
                data.needsReinit = true;
                
                // Schedule reinitialization
                setTimeout(() => {
                    this.reinitializePlayback(outputId, data.deviceIndex, data.displayMode, 
                                             data.pixelFormat, data.enableKeying || false, 
                                             data.audioChannels || 2);
                }, 500);
                return;
            }
            
            console.error(`Error checking buffer: ${err.message}`);
            return;
        }
        
        // If we get here, the device is working, so continue with normal flow
        try {
            // Convert frame
            const convertedFrame = this.convertVideoFrameFormat(videoFrame, data.pixelFormat, size, outputId);
            
            // Get audio
            const audioData = audioFrame || this.getSilentAudio(data.audioChannels || 2);
            
            // Schedule frame
            const currentTime = data.scheduledFrames * framerate;
            data.playback.schedule({
                video: convertedFrame,
                audio: audioData,
                sampleFrameCount: 1920,
                time: currentTime
            });
            
            // Increment frame counter
            data.scheduledFrames++;
            
            // Start if not started
            if (!data.isStarted && bufferedFrames >= 15) {
                try {
                    console.log("Starting BlackMagic playback");
                    data.playback.start({ startTime: 0 });
                    data.isStarted = true;
                } catch (err) {
                    if (err.message !== "Already started") {
                        console.error(`Error starting playback: ${err.message}`);
                    } else {
                        data.isStarted = true;
                    }
                }
            }
            
        } catch (err) {
            console.error(`Error in frame processing: ${err.message}`);
            
            // If we get "Already stopped" during schedule, also reinitialize
            if (err.message.includes("Already stopped")) {
                data.needsReinit = true;
                setTimeout(() => {
                    this.reinitializePlayback(outputId, data.deviceIndex, data.displayMode, 
                                             data.pixelFormat, data.enableKeying || false, 
                                             data.audioChannels || 2);
                }, 500);
            }
        }
        
    } catch (err) {
        console.error(`Error in scheduleFrame: ${err.message}`);
    }
}
   
    
// New helper method to handle playback reinitialization
static async handlePlaybackReinitialization(outputId: string) {
    if (!this.playbackData[outputId]) return;
    
    console.log(`Attempting to reinitialize playback for ${outputId}`);
    
    // Pause output temporarily
    this.isPaused[outputId] = true;
    
    try {
        const data = this.playbackData[outputId];
        
        // Save current state
        const currentState = {
            deviceIndex: data.deviceIndex,
            pixelFormat: data.pixelFormat,
            displayMode: data.displayMode,
            audioChannels: data.audioChannels,
            enableKeying: data.enableKeying
        };
        
        // Stop existing playback (ignore errors)
        try {
            if (data.playback) {
                data.playback.stop();
            }
        } catch (err) {
            // Ignore stop errors
        }
        
        // Wait a bit to let hardware settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if we still have the output
        if (!this.playbackData[outputId]) return;
        
        // Create new playback object
        try {
            // If you have access to BlackmagicManager and the original parameters:
            this.playbackData[outputId].playback = await macadam.playback({
                deviceIndex: currentState.deviceIndex,
                displayMode: BlackmagicManager.getDisplayMode(currentState.displayMode),
                pixelFormat: BlackmagicManager.getPixelFormat(currentState.pixelFormat),
                enableKeying: currentState.enableKeying || false,
                channels: currentState.audioChannels || 2,
                sampleRate: macadam.bmdAudioSampleRate48kHz,
                sampleType: macadam.bmdAudioSampleType16bitInteger,
                startTimecode: "01:00:00:00",
            });
            
            // Reset state but keep high frame number to prevent timing issues
            this.playbackData[outputId].isStarted = false;
            this.playbackData[outputId].needsReinit = false;
            
            console.log(`Successfully reinitialized playback for ${outputId}`);
            
            // Resume after a small delay
            setTimeout(() => {
                if (this.playbackData[outputId]) {
                    this.isPaused[outputId] = false;
                }
            }, 100);
            
        } catch (err) {
            console.error(`Failed to create new playback: ${err.message}`);
            
            // If we failed to reinitialize, we should clean up
            this.stop(outputId);
        }
        
    } catch (err) {
        console.error(`Error during reinitialization: ${err.message}`);
        
        // Clean up on failure
        this.stop(outputId);
    }
}
    
    // Start playback with proper error handling
    static startPlayback(outputId: string) {
        if (!this.playbackData[outputId]) return;
        
        const data = this.playbackData[outputId];
        
        try {
            console.log(`Starting BlackMagic playback with buffer of ${data.playback.bufferedFrames()} frames`);
            data.playback.start({ startTime: 0 });
            data.isStarted = true;
            
            // Capture hardware time offset for drift correction
            const hwTime = data.playback.hardwareTime();
            if (hwTime) {
                data.hardwareTimeOffset = hwTime.hardwareTime - (data.scheduledFrames * 1000);
                console.log(`Captured hardware time offset: ${data.hardwareTimeOffset}`);
            }
            
            // Start performance monitoring
            this.startPerformanceMonitoring(outputId);
            
        } catch (err) {
            if (err.message !== "Already started") {
                console.error(`Error starting playback: ${err.message}`);
            } else {
                data.isStarted = true;
            }
        }
    }
    
    // Optimized conversion with caching
    static convertVideoFrameOptimized(frame: Buffer, format: string, size: Size, outputId: string) {
        const data = this.playbackData[outputId];
        
        // Use conversion cache if dimensions and format match
        if (data.conversionCache && 
            data.conversionCache.sourceWidth === size.width &&
            data.conversionCache.sourceHeight === size.height &&
            data.conversionCache.lastFormat === format) {
            
            // Reuse the converter function from cache
            return data.conversionCache.converter(frame);
        }
        
        // Otherwise, perform the conversion and cache the converter
        const targetDims = data.targetDimensions;
        
        // For YUV conversions, create a specialized converter function
        if (format.includes("YUV")) {
            // Create converter function based on bit depth and device pixel mode
            const converter = (inputFrame: Buffer) => {
                if (format.includes("10")) {
                    // 10-bit YUV
                    if (this.devicePixelMode === "BGRA") {
                        return ImageBufferConverter10Bit.BGRAtoYUV(inputFrame, size, targetDims);
                    } else {
                        return ImageBufferConverter10Bit.ARGBtoYUV(inputFrame, size, targetDims);
                    }
                } else {
                    // 8-bit YUV
                    if (this.devicePixelMode === "BGRA") {
                        return ImageBufferConverter.BGRAtoYUV(inputFrame, size, targetDims);
                    } else {
                        return ImageBufferConverter.ARGBtoYUV(inputFrame, size, targetDims);
                    }
                }
            };
            
            // Cache the converter for future frames
            data.conversionCache = {
                sourceWidth: size.width,
                sourceHeight: size.height,
                lastFormat: format,
                converter
            };
            
            // Apply the converter
            return converter(frame);
        }
        
        // For other format conversions, just use the existing method
        return this.convertVideoFrameFormat(frame, format, size, outputId);
    }
    
    // Check performance periodically during playback
    static checkPerformance(outputId: string) {
        if (!this.playbackData[outputId]) return;
        
        const data = this.playbackData[outputId];
        const now = Date.now();
        const checkInterval = 5000; // Check every 5 seconds
        
        // Only check periodically to reduce overhead
        if (now - data.lastPerformanceCheck < checkInterval) return;
        
        try {
            const bufferedFrames = data.playback.bufferedFrames();
            const framesPerSecond = data.framesSinceLastCheck / ((now - data.lastPerformanceCheck) / 1000);
            
            // Log performance metrics
            console.log(`Performance: ${framesPerSecond.toFixed(1)} fps, buffer: ${bufferedFrames}/${data.targetBufferSize} frames`);
            
            // Reset counters
            data.framesSinceLastCheck = 0;
            data.lastPerformanceCheck = now;
            
            // Check for buffer health
            if (bufferedFrames < data.targetBufferSize / 4) {
                // Buffer is getting low, we might need to adjust timing
                console.warn(`Buffer running low (${bufferedFrames} frames), may need recovery`);
                
                // If buffer is critically low, trigger recovery
                if (bufferedFrames < 3) {
                    const hwTime = data.playback.hardwareTime();
                    if (hwTime) {
                        this.recoverPlayback(outputId, hwTime.hardwareTime);
                    }
                }
            }
            
        } catch (err) {
            console.error(`Error checking performance: ${err.message}`);
        }
    }

    static startPerformanceMonitoring(outputId: string) {
        if (!this.playbackData[outputId]) return;

        // Monitor every 10 seconds
        const monitoringInterval = setInterval(() => {
            if (!this.playbackData[outputId]) {
                clearInterval(monitoringInterval);
                return;
            }

            try {
                const data = this.playbackData[outputId];
                const bufferedFrames = data.playback.bufferedFrames();
                const hwTime = data.playback.hardwareTime();
                const scheduledTime = data.playback.scheduledTime();

                // Only log full status when there might be issues
                if (bufferedFrames < 5 || bufferedFrames > data.targetBufferSize * 1.5) {
                    console.log("--- Performance Status ---");
                    console.log(`Buffered frames: ${bufferedFrames}`);
                    console.log(`Hardware time: ${JSON.stringify(hwTime)}`);
                    console.log(`Scheduled time: ${JSON.stringify(scheduledTime)}`);
                    console.log(`Total frames scheduled: ${data.scheduledFrames}`);
                    console.log(`Total frames dropped: ${data.totalFramesDropped}`);
                    console.log("-------------------------");
                }
                
                // Check for significant timing drift
                if (hwTime && scheduledTime) {
                    const hwFrameTime = hwTime.hardwareTime;
                    const scheduledFrameTime = scheduledTime.streamTime;
                    const drift = Math.abs(hwFrameTime - scheduledFrameTime);
                    
                    // Use a more reasonable drift threshold
                    if (drift > 3000) {
                        console.warn(`Timing drift detected: ${drift} units`);
                        this.recoverPlayback(outputId, hwFrameTime);
                    }
                }
                
                // Check for persistently empty buffer
                if (bufferedFrames === 0) {
                    data.emptyBufferCount = (data.emptyBufferCount || 0) + 1;

                    if ((data.emptyBufferCount || 0) >= 2) {
                        console.warn("Empty buffer detected, attempting recovery");
                        
                        // Use the hardware time if available, or calculate from scheduled frames
                        const recoveryTime = hwTime ? hwTime.hardwareTime : (data.scheduledFrames * 1000);
                        this.recoverPlayback(outputId, recoveryTime);
                    }
                } else {
                    // Reset empty buffer counter
                    data.emptyBufferCount = 0;
                }
                
            } catch (err) {
                console.error("Error in performance monitoring:", err);
            }
        }, 10000);

        this.playbackData[outputId].monitoringInterval = monitoringInterval;
    }
    
    static recoverPlayback(outputId: string, currentHwTime: number) {
    if (!this.playbackData[outputId]) {
        console.log(`Cannot recover playback for ${outputId} - no playback data exists`);
        return;
    }
    
    // If already paused, don't try to recover again
    if (this.isPaused[outputId]) {
        console.log(`Recovery already in progress for ${outputId}, skipping`);
        return;
    }
    
    console.log("Performing playback recovery...");
    
    // Pause scheduling temporarily
    this.isPaused[outputId] = true;
    
    try {
        const data = this.playbackData[outputId];
        
        // Track recovery attempts for metrics
        data.totalFramesDropped = (data.totalFramesDropped || 0) + 
            (data.playback ? data.playback.bufferedFrames() : 0);
        
        // Clear existing promises
        this.framePromises[outputId] = {};
        
        // Calculate new frame time point - add buffer ahead of current hardware time
        const newStartFrame = Math.floor(currentHwTime / 1000) + 15;
        
        // Reset state
        data.scheduledFrames = newStartFrame;
        data.isStarted = false;
        data.needsReinit = true;
        
        // Use stored parameters to call reinitializePlayback
        this.reinitializePlayback(
            outputId,
            data.deviceIndex,
            data.displayMode,
            data.pixelFormat,
            data.enableKeying || false,
            data.audioChannels || 2
        ).catch(err => {
            console.error(`Error during recovery: ${err.message}`);
            
            // Ensure we don't leave output in paused state
            setTimeout(() => {
                this.isPaused[outputId] = false;
            }, 500);
        });
        
    } catch (err) {
        console.error("Error during recovery:", err);
        
        // Ensure we don't leave output in paused state
        setTimeout(() => {
            this.isPaused[outputId] = false;
        }, 500);
    }
}

static async reinitializePlayback(outputId: string, deviceIndex: number, 
                                 displayMode: string, pixelFormat: string,
                                 enableKeying: boolean, audioChannels: number = 2) {
    console.log(`Reinitializing playback for ${outputId}`);
    
    // Clean up old playback data
    if (this.playbackData[outputId]) {
        try {
            // Stop the existing playback (ignore errors)
            try {
                this.playbackData[outputId].playback.stop();
            } catch (err) {
                // Ignore "Already stopped" errors
            }
            
            // Clear up any monitoring
            if (this.playbackData[outputId].monitoringInterval) {
                clearInterval(this.playbackData[outputId].monitoringInterval);
            }
        } catch (err) {
            console.error(`Error cleaning up old playback: ${err}`);
        }
    }
    
    // Create new playback object
    try {
        // Wait a short time to let hardware settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Initialize with same parameters as before
        const success = await this.initialize(outputId, deviceIndex, displayMode, 
                                             pixelFormat, enableKeying, audioChannels);
        
        if (success) {
            console.log(`Successfully reinitialized playback for ${outputId}`);
        } else {
            console.error(`Failed to reinitialize playback for ${outputId}`);
        }
    } catch (err) {
        console.error(`Error during reinitialization: ${err.message}`);
    }
}
    
    // Ensure we have a pre-generated silent audio buffer
    static ensureSilentAudioBuffer(channels: number) {
        if (!this.silentAudioBuffers[channels]) {
            // 1920 samples is a common buffer size for 48kHz audio at various framerates
            // Each sample is 2 bytes (16-bit) per channel
            const sampleCount = 1920;
            const bufferSize = sampleCount * 2 * channels;
            
            // Create buffer filled with zeros (silence)
            this.silentAudioBuffers[channels] = Buffer.alloc(bufferSize);
        }
    }
    
    // Get a pre-generated silent audio buffer
    static getSilentAudio(channels: number = 2): Buffer {
        this.ensureSilentAudioBuffer(channels);
        return this.silentAudioBuffers[channels];
    }

    // Get target dimensions from display mode
    static getTargetDimensions(displayMode: string): {
        width: number,
        height: number
    } {
        if (displayMode.includes('1080')) {
            return {
                width: 1920,
                height: 1080
            };
        } else if (displayMode.includes('720')) {
            return {
                width: 1280,
                height: 720
            };
        } else if (displayMode.includes('2k')) {
            return {
                width: 2048,
                height: 1080
            };
        } else if (displayMode.includes('4K') || displayMode.includes('4k')) {
            return {
                width: 3840,
                height: 2160
            };
        } else if (displayMode.includes('525i') || displayMode.includes('NTSC')) {
            return {
                width: 720,
                height: 486
            };
        } else if (displayMode.includes('625i') || displayMode.includes('PAL')) {
            return {
                width: 720,
                height: 576
            };
        }

        // Default to 1080p if mode is not recognized
        return {
            width: 1920,
            height: 1080
        };
    }
    
    // Legacy method for compatibility - now calls the optimized version
    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, outputId: string) {
        // Get target dimensions from display mode
        const currentMode = this.playbackData[outputId];
        const targetDims = currentMode?.targetDimensions;

        // bmdPixelFormats: YUV, ARGB, BGRA, RGB, RGBLE, RGBXLE, RGBX
        if (format.includes("ARGB")) {
            if (this.devicePixelMode === "BGRA") {
                const result = Buffer.from(frame);
                ImageBufferConverter.BGRAtoARGB(result);
                return result;
            }
            // do nothing if it's already ARGB
            return frame;
        } else if (format.includes("YUV")) {
            if (format.includes("10")) {
                if (this.devicePixelMode === "BGRA")
                    return ImageBufferConverter10Bit.BGRAtoYUV(frame, size, targetDims);
                else
                    return ImageBufferConverter10Bit.ARGBtoYUV(frame, size, targetDims);
            } else {
                if (this.devicePixelMode === "BGRA")
                    return ImageBufferConverter.BGRAtoYUV(frame, size, targetDims);
                else
                    return ImageBufferConverter.ARGBtoYUV(frame, size, targetDims);
            }
        } else if (format.includes("BGRA")) {
            if (this.devicePixelMode === "ARGB") {
                const result = Buffer.from(frame);
                util.ImageBufferAdjustment.ARGBtoBGRA(result);
                return result;
            }
            // do nothing if it's already BGRA
            return frame;
        } else if (format.includes("RGBXLE")) {
            const result = Buffer.from(frame);
            if (this.devicePixelMode === "BGRA") 
                ImageBufferConverter.BGRAtoRGBXLE(result);
            else 
                ImageBufferConverter.ARGBtoRGBXLE(result);
            return result;
        } else if (format.includes("RGBLE")) {
            if (this.devicePixelMode === "BGRA") 
                return ImageBufferConverter.BGRAtoRGBLE(frame);
            else 
                return ImageBufferConverter.ARGBtoRGBLE(frame);
        } else if (format.includes("RGBX")) {
            const result = Buffer.from(frame);
            if (this.devicePixelMode === "BGRA") 
                util.ImageBufferAdjustment.BGRAtoBGRX(result);
            else 
                ImageBufferConverter.ARGBtoRGBX(result);
            return result;
        } else if (format.includes("RGB")) {
            if (this.devicePixelMode === "BGRA") 
                return ImageBufferConverter.BGRAtoRGB(frame);
            else 
                return ImageBufferConverter.ARGBtoRGB(frame);
        }

        return frame;
    }
    
    static stop(outputId: string) {
        if (!this.playbackData[outputId]) return;

        console.log(`Stopping Blackmagic sender: ${outputId}`);

        // Set paused flag first to prevent new frames
        this.isPaused[outputId] = true;

        // Clear monitoring interval
        if (this.playbackData[outputId].monitoringInterval) {
            clearInterval(this.playbackData[outputId].monitoringInterval);
        }

        try {
            // Stop playback with proper error handling
            try {
                this.playbackData[outputId].playback.stop();
            } catch (err) {
                if (err.message !== "Already stopped") {
                    console.error(`Error stopping playback: ${err.message}`);
                }
            }
            
            // Clean up resources
            delete this.framePromises[outputId];
            delete this.frameSkipCounter[outputId];
            delete this.playbackData[outputId];
            
            console.log(`Sender ${outputId} successfully stopped and cleaned up`);
        } catch (err) {
            console.error(`Error stopping sender ${outputId}:`, err);
            // Clean up anyway
            delete this.playbackData[outputId];
            delete this.framePromises[outputId];
            delete this.frameSkipCounter[outputId];
        }
    }
    
    static stopAll() {
        Object.keys(this.playbackData).forEach(id => this.stop(id));
        console.log("All Blackmagic senders stopped");
    }
}