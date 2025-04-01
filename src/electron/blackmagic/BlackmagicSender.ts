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

// const FPS = 30
export class BlackmagicSender {
    static playbackData: {
        [key: string]: {
            playback: PlaybackChannel;
            scheduledFrames: number;
            pixelFormat: string;
            displayMode: string;
            isStarted: boolean;
            targetDimensions?: {
                width: number;
                height: number;
            };
            // New properties for simplified converter
            sourceWidth?: number;
            sourceHeight?: number;
            converter?: (buffer: Buffer) => Buffer;
            // Existing optional properties
            conversionCache?: {
                sourceWidth: number;
                sourceHeight: number;
                converter: (frame: Buffer) => Buffer;
            };
            monitoringInterval?: NodeJS.Timeout;
            lastLogTime: number;
            audioChannels?: number;
            emptyBufferCount?: number;
            scheduleFailCount?: number;
        }
    } = {}
    
    static devicePixelMode: "BGRA" | "ARGB" = os.endianness() === "BE" ? "ARGB" : "BGRA";
    static framePromises: { [key: string]: { [time: number]: Promise<any> } } = {};
    static isPaused: { [key: string]: boolean } = {};
    static frameSkipCounter: { [key: string]: number } = {};

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

        this.playbackData[outputId] = {
            playback: await macadam.playback({
                deviceIndex,
                displayMode: BlackmagicManager.getDisplayMode(displayModeName),
                pixelFormat: BlackmagicManager.getPixelFormat(pixelFormat),
                enableKeying: enableKeying ? BlackmagicManager.isAlphaSupported(pixelFormat) : false,
                channels: actualAudioChannels,
                sampleRate: macadam.bmdAudioSampleRate48kHz,
                sampleType: macadam.bmdAudioSampleType16bitInteger,
                startTimecode: "01:00:00:00",
            }),
            scheduledFrames: 0,
            pixelFormat: pixelFormat,
            displayMode: displayModeName,
            isStarted: false,
            targetDimensions,
            lastLogTime: 0,
            audioChannels: actualAudioChannels
        }

        this.framePromises[outputId] = {};
        
        console.log(`Sender initialized with target dimensions: ${targetDimensions.width}x${targetDimensions.height}`);
        return true;
    }

    static scheduleFrame(outputId: string, videoFrame: Buffer, audioFrame: Buffer | null, 
                     framerate: number = 1000, size: Size) {
    if (!this.playbackData[outputId]) return;
    
    const data = this.playbackData[outputId];
    
    // Skip empty frames
    if (videoFrame.length === 0 || size.width === 0 || size.height === 0) {
        return;
    }

    try {
        // Simple buffer check - we just want to know if we should start playback
        let bufferedFrames = 0;
        try {
            bufferedFrames = data.playback.bufferedFrames();
        } catch (err) {
            console.error(`Error checking buffer: ${err.message}`);
            return; // Skip this frame if we can't check buffer
        }
        
        // Use the existing convertVideoFrameFormat function for simplicity
        const convertedFrame = this.convertVideoFrameFormat(
            videoFrame, 
            data.pixelFormat, 
            size, 
            outputId
        );
        
        // Generate silent audio if needed
        const audioData = audioFrame || this.generateSilentAudio(2);  // Always use 2 channels for simplicity
        
        // Get current scheduled time
        const currentTime = data.scheduledFrames * framerate;
        
        // Schedule frame
        data.playback.schedule({
            video: convertedFrame,
            audio: audioData,
            sampleFrameCount: 1920,
            time: currentTime
        });
        
        // Increment frame counter
        data.scheduledFrames++;
        
        // Simple startup logic - start after buffering 10 frames
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
        console.error(`Error in scheduleFrame: ${err.message}`);
    }
}
    
static async sendFrame(outputId: string) {
    if (!this.playbackData[outputId]) return;

    const data = this.playbackData[outputId];
    
    // Start playback with an even larger initial buffer
    if (data.scheduledFrames === 30) { // Further increased initial buffer
        console.log("Starting BlackMagic playback");
        data.playback.start({ startTime: 0 });
        this.startPerformanceMonitoring(outputId);
    }
}

   static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, outputId: string) {
        // Get target dimensions from display mode
        const currentMode = this.playbackData[outputId];
        const targetDims = currentMode?.displayMode ?
            this.getTargetDimensions(currentMode.displayMode) : undefined;

        // Reduced logging - only log significant dimension changes
        if (targetDims && (targetDims.width !== size.width || targetDims.height !== size.height)) {
            //console.log(`Converting format: ${format}, from ${size.width}x${size.height} to ${targetDims.width}x${targetDims.height}`);
        }


        //console.log(`Converting format: ${format}, from ${size.width}x${size.height} to ${targetDims?.width}x${targetDims?.height}`);

        // bmdPixelFormats: YUV, ARGB, BGRA, RGB, RGBLE, RGBXLE, RGBX
        if (format.includes("ARGB")) {
            if (this.devicePixelMode === "BGRA") ImageBufferConverter.BGRAtoARGB(frame)
            // do nothing if it's already ARGB
        } else if (format.includes("YUV")) {
            if (format.includes("10")) {
                if (this.devicePixelMode === "BGRA")
                    frame = ImageBufferConverter10Bit.BGRAtoYUV(frame, size, targetDims)
                else
                    frame = ImageBufferConverter10Bit.ARGBtoYUV(frame, size, targetDims)
            } else {
                if (this.devicePixelMode === "BGRA")
                    frame = ImageBufferConverter.BGRAtoYUV(frame, size, targetDims)
                else
                    frame = ImageBufferConverter.ARGBtoYUV(frame, size, targetDims)
            }
        } else if (format.includes("BGRA")) {
            if (this.devicePixelMode === "ARGB") util.ImageBufferAdjustment.ARGBtoBGRA(frame)
            // do nothing if it's already BGRA
        } else if (format.includes("RGBXLE")) {
            if (this.devicePixelMode === "BGRA") ImageBufferConverter.BGRAtoRGBXLE(frame)
            else ImageBufferConverter.ARGBtoRGBXLE(frame)
        } else if (format.includes("RGBLE")) {
            if (this.devicePixelMode === "BGRA") frame = ImageBufferConverter.BGRAtoRGBLE(frame)
            else ImageBufferConverter.ARGBtoRGBLE(frame)
        } else if (format.includes("RGBX")) {
            if (this.devicePixelMode === "BGRA") util.ImageBufferAdjustment.BGRAtoBGRX(frame)
            else ImageBufferConverter.ARGBtoRGBX(frame)
        } else if (format.includes("RGB")) {
            if (this.devicePixelMode === "BGRA") frame = ImageBufferConverter.BGRAtoRGB(frame)
            else frame = ImageBufferConverter.ARGBtoRGB(frame)
        }

        return frame
    }
    
   static startPerformanceMonitoring(outputId: string) {
    if (!this.playbackData[outputId]) return;

    // Monitor every 10 seconds to reduce overhead
    const monitoringInterval = setInterval(() => {
        if (!this.playbackData[outputId]) {
            clearInterval(monitoringInterval);
            return;
        }

        try {
            const bufferedFrames = this.playbackData[outputId].playback.bufferedFrames();
            const hwTime = this.playbackData[outputId].playback.hardwareTime();
            const scheduledTime = this.playbackData[outputId].playback.scheduledTime();

            console.log("--- Performance Status ---");
            console.log(`Buffered frames: ${bufferedFrames}`);
            console.log(`Hardware time: ${JSON.stringify(hwTime)}`);
            console.log(`Scheduled time: ${JSON.stringify(scheduledTime)}`);
            console.log(`Pending promises: ${Object.keys(this.framePromises[outputId] || {}).length}`);
            console.log(`Total scheduled frames: ${this.playbackData[outputId].scheduledFrames}`);
            
            // Check for drift and implement recovery if needed
            if (hwTime && scheduledTime) {
                const hwFrameTime = hwTime.hardwareTime;
                const scheduledFrameTime = scheduledTime.streamTime;
                const drift = Math.abs(hwFrameTime - scheduledFrameTime);
                
                // More aggressive drift threshold (reduced from 10000 to 5000)
                //if (drift > 5000) {
                //    console.warn(`Significant timing drift detected: ${drift} units`);
                //    
                //    // For extreme drift (over 1 million), perform a hard reset
                //    if (drift > 1000000) {
                //        this.performHardReset(outputId, hwFrameTime);
                //    } else {
                //        this.recoverFromDrift(outputId, hwFrameTime);
                //    }
                //}
                if (drift > 5000) {
                    console.warn(`Timing drift detected: ${drift} units`);
                    this.recoverPlayback(outputId, hwFrameTime);
                }
            }
            
            // Check for persistently empty buffer and take action if needed
            if (bufferedFrames === 0) {
                this.playbackData[outputId].emptyBufferCount = 
                    (this.playbackData[outputId].emptyBufferCount || 0) + 1;

                if ((this.playbackData[outputId].emptyBufferCount || 0) >= 2) {
                    console.warn("Empty buffer detected, attempting recovery");
                    this.recoverPlayback(outputId, hwTime?.hardwareTime || 0);
                }
            } else {
                // Reset empty buffer counter
                this.playbackData[outputId].emptyBufferCount = 0;
            }
            
            console.log("-------------------------");
        } catch (err) {
            console.error("Error in performance monitoring:", err);
        }
    }, 10000);  // Extended interval to 10 seconds

    this.playbackData[outputId].monitoringInterval = monitoringInterval;
}
    
    
    
    static recoverFromDrift(outputId: string, currentHwTime: number) {
        if (!this.playbackData[outputId]) return;

        console.log("Attempting drift recovery...");

        try {
            // Temporarily pause frame scheduling
            this.isPaused[outputId] = true;

            // Clear existing frame promises
            this.framePromises[outputId] = {};

            // Reset scheduling counter to current hardware time
            this.playbackData[outputId].scheduledFrames = Math.floor(currentHwTime / 1000) + 5;

            // Reset the start flag to rebuild buffer
            this.playbackData[outputId].isStarted = false;

            console.log(`Scheduling reset to frame: ${this.playbackData[outputId].scheduledFrames}`);

            // Resume after short delay
            setTimeout(() => {
                this.isPaused[outputId] = false;
                console.log("Frame scheduling resumed after drift recovery");
            }, 500);
        } catch (err) {
            console.error("Error during drift recovery:", err);
            // Ensure we don't leave scheduling paused
            this.isPaused[outputId] = false;
        }
    }
    
    // Generate silent audio buffer (16-bit stereo)
    static generateSilentAudio(channels: number = 2): Buffer {
        // 1920 samples is a common buffer size for 48kHz audio at various framerates
        // Each sample is 2 bytes (16-bit) per channel
        const sampleCount = 1920;
        const bufferSize = sampleCount * 2 * channels;
        
        // Create buffer filled with zeros (silence)
        return Buffer.alloc(bufferSize);
    }

    // Add this helper method to get dimensions from display mode
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
        //console.warn(`Unrecognized display mode: ${displayMode}, defaulting to 1080p`);
        return {
            width: 1920,
            height: 1080
        };
    }
    
    static pauseOutput(outputId: string) {
        if (!this.playbackData[outputId]) return;
        //console.log(`Pausing output: ${outputId}`);
        this.isPaused[outputId] = true;
    }
    
    static resumeOutput(outputId: string) {
        if (!this.playbackData[outputId]) return;
        //console.log(`Resuming output: ${outputId}`);
        this.isPaused[outputId] = false;
    }
    
    static recoverPlayback(outputId: string, currentHwTime: number) {
    if (!this.playbackData[outputId]) return;
    
    //console.log("Performing soft recovery...");
    
    // Pause scheduling temporarily
    this.isPaused[outputId] = true;
    
    // Clear existing frame promises
    this.framePromises[outputId] = {};
    
    try {
        const data = this.playbackData[outputId];
        
        // Reset counters and state
        data.scheduledFrames = Math.floor(currentHwTime / 1000) + 5;
        data.isStarted = false;
        data.emptyBufferCount = 0;
        
        // Try to restart playback after a brief delay
        setTimeout(() => {
            try {
                if (this.playbackData[outputId]) {
                    // Resume scheduling
                    this.isPaused[outputId] = false;
                    console.log("Soft recovery completed, scheduling resumed");
                }
            } catch (err) {
                console.error("Error resuming after recovery:", err);
                this.isPaused[outputId] = false;
            }
        }, 500);
    } catch (err) {
        console.error("Error during soft recovery:", err);
        this.isPaused[outputId] = false;
    }
}

  static stop(outputId: string) {
    if (!this.playbackData[outputId]) return;

    console.log(`Stopping Blackmagic sender: ${outputId}`);

    // Set paused flag first to prevent new frames being scheduled
    this.isPaused[outputId] = true;

    // Clear monitoring interval
    if (this.playbackData[outputId].monitoringInterval) {
        clearInterval(this.playbackData[outputId].monitoringInterval);
    }

    try {
        // Stop playback with safe check
        try {
            this.playbackData[outputId].playback.stop();
        } catch (err) {
            // Already stopped is an expected condition, not a true error
            if (err.message !== "Already stopped") {
                console.error(`Error stopping playback: ${err.message}`);
            }
        }
        
        // Clean up frame promises
        if (this.framePromises[outputId]) {
            delete this.framePromises[outputId];
        }
        
        // Clean up counters
        delete this.frameSkipCounter[outputId];
        
        // Finally remove the playback data
        delete this.playbackData[outputId];
        
        console.log(`Sender ${outputId} successfully stopped and cleaned up`);
    } catch (err) {
        console.error(`Error stopping sender ${outputId}:`, err);
        // Still clean up even if there's an error
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