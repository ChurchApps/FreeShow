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
            monitoringInterval?: NodeJS.Timeout;
            forcedResolution?: {
                width: number;
                height: number;
            }
        }
    } = {}
    static devicePixelMode: "BGRA" | "ARGB" = "BGRA"
    
    static framePromises: { [key: string]: { [time: number]: Promise<any> } } = {};

    // set audioChannels to 0 to disable audio
    static async initialize(outputId: string, deviceIndex: number, displayModeName: string, pixelFormat: string, enableKeying: boolean, audioChannels: number = 2) {
        console.log("Blackmagic - creating sender: " + outputId)
        console.log(`Initializing Blackmagic sender with mode: ${displayModeName}, format: ${pixelFormat}`);

        if (this.playbackData[outputId]) this.stop(outputId);

        this.playbackData[outputId] = {
            playback: await macadam.playback({
                deviceIndex,
                displayMode: BlackmagicManager.getDisplayMode(displayModeName),
                pixelFormat: BlackmagicManager.getPixelFormat(pixelFormat),
                enableKeying: enableKeying ? BlackmagicManager.isAlphaSupported(pixelFormat) : false,
                channels: audioChannels ? 0 : 0, // WIP send audio!
                sampleRate: macadam.bmdAudioSampleRate48kHz,
                sampleType: macadam.bmdAudioSampleType16bitInteger,
                startTimecode: "01:00:00:00",
            }),
            scheduledFrames: 0,
            pixelFormat: pixelFormat,
            displayMode: displayModeName,
        }

        this.devicePixelMode = os.endianness() === "BE" ? "ARGB" : "BGRA";
    }

    //static scheduleFrame(outputId: string, videoFrame: Buffer, _audioFrame: Buffer | null, framerate: number = 1000, size: Size) {
    //    if (!this.playbackData[outputId]) return;
//
    //    if (videoFrame.length === 0 || size.width === 0 || size.height === 0) {
    //        console.warn("Skipping empty frame");
    //        return;
    //    }
//
    //    // Initialize promises tracking for this output if needed
    //    if (!this.framePromises[outputId]) {
    //        this.framePromises[outputId] = {};
    //    }
//
    //    // Check if we have too many pending frames (adjust buffer size as needed)
    //    const MAX_BUFFERED_FRAMES = 5;
    //    const pendingFrames = Object.keys(this.framePromises[outputId]).length;
//
    //    if (pendingFrames >= MAX_BUFFERED_FRAMES) {
    //        console.log(`Throttling: Already have ${pendingFrames} frames pending for output ${outputId}`);
    //        return; // Skip this frame to avoid building up too many
    //    }
//
    //    console.log(`Scheduling frame: Input buffer size: ${videoFrame.length}, Format: ${this.playbackData[outputId].pixelFormat}, Size: ${size.width}x${size.height}`);
//
    //    videoFrame = this.convertVideoFrameFormat(videoFrame, this.playbackData[outputId].pixelFormat, size, outputId);
//
    //    // Get current scheduled time
    //    const currentTime = this.playbackData[outputId].scheduledFrames * framerate;
//
    //    // Schedule the frame
    //    this.playbackData[outputId].playback.schedule({
    //        video: videoFrame,
    //        // audio: audioFrame,
    //        sampleFrameCount: 1920,
    //        time: currentTime
    //    });
//
    //    // Store the promise for this frame time
    //    this.framePromises[outputId][currentTime] = this.playbackData[outputId].playback.played(currentTime)
    //        .then(() => {
    //            // Clean up the promise when done
    //            delete this.framePromises[outputId][currentTime];
    //            console.log(`Frame at time ${currentTime} successfully played and cleaned up`);
    //        })
    //        .catch(err => {
    //            delete this.framePromises[outputId][currentTime];
    //            console.error(`Error with frame at time ${currentTime}:`, err);
    //        });
//
    //    this.playbackData[outputId].scheduledFrames++;
    //    this.sendFrame(outputId);
    //}
//
    //static async sendFrame(outputId: string) {
    //    if (!this.playbackData[outputId]) return;
//
    //    const data = this.playbackData[outputId];
//
    //    // Start playback when we have buffered 3 frames
    //    if (data.scheduledFrames === 3) {
    //        console.log("Starting BlackMagic playback");
    //        data.playback.start({ startTime: 0 });
    //    }
//
    //    // Don't need additional waiting logic here since we're managing each frame individually
    //}

   static scheduleFrame(outputId: string, videoFrame: Buffer, _audioFrame: Buffer | null, framerate: number = 1000, size: Size) {
    if (!this.playbackData[outputId]) return;

    if (videoFrame.length === 0 || size.width === 0 || size.height === 0) {
        console.warn("Skipping empty frame");
        return;
    }

    // Initialize promises tracking for this output if needed
    if (!this.framePromises[outputId]) {
        this.framePromises[outputId] = {};
    }

    // Check buffer health
    try {
        const bufferedFrames = this.playbackData[outputId].playback.bufferedFrames();
        
        // Optimize buffer parameters even more
        const TARGET_BUFFER = 60; // Increase target buffer for extra smoothness
        const MIN_BUFFER = 10;     // Raise minimum buffer to prevent jitter
        
        // Critical buffer management
        if (bufferedFrames < MIN_BUFFER) {
            console.log(`CRITICAL: Buffer low (${bufferedFrames}), prioritizing frame`);
            // When critically low, process every frame at highest priority
        } else if (bufferedFrames >= TARGET_BUFFER) {
            // If buffer is very healthy, we can be more aggressive about skipping frames
            // Skip frames based on buffer level to maintain balance
            if (this.playbackData[outputId].scheduledFrames % 2 === 1) {
                return;
            }
        } else if (bufferedFrames >= TARGET_BUFFER * 0.75) {
            // If buffer is fairly healthy, skip occasional frames
            if (this.playbackData[outputId].scheduledFrames % 3 === 1) {
                return;
            }
        }
        
        // Less frequent logging to reduce overhead
        if (this.playbackData[outputId].scheduledFrames % 10 === 0) {
            console.log(`Buffer health: ${bufferedFrames}/${TARGET_BUFFER} frames`);
        }
    } catch (err) {
        console.error("Error checking buffer:", err);
    }

    // Get current scheduled time
    const currentTime = this.playbackData[outputId].scheduledFrames * framerate;
    
    // Convert the frame - minimize logging for better performance
    videoFrame = this.convertVideoFrameFormat(videoFrame, this.playbackData[outputId].pixelFormat, size, outputId);

    // Schedule the frame
    this.playbackData[outputId].playback.schedule({
        video: videoFrame,
        // audio: audioFrame,
        sampleFrameCount: 1920,
        time: currentTime
    });

    // Store the promise for this frame time
    this.framePromises[outputId][currentTime] = this.playbackData[outputId].playback.played(currentTime)
        .then(() => {
            // Clean up the promise when done
            delete this.framePromises[outputId][currentTime];
            
            // Extremely minimal logging - only once every ~10 seconds
            if (currentTime % (framerate * 60) === 0) {
                console.log(`Frame at time ${currentTime} successfully played`);
            }
        })
        .catch((err: Error) => {
            delete this.framePromises[outputId][currentTime];
            console.error(`Error with frame at time ${currentTime}:`, err);
            console.error(`Error with frame at time ${currentTime}:`, err);
        });

    this.playbackData[outputId].scheduledFrames++;
    this.sendFrame(outputId);
}

static async sendFrame(outputId: string) {
    if (!this.playbackData[outputId]) return;

    const data = this.playbackData[outputId];
    
    // Start playback with an even larger initial buffer
    if (data.scheduledFrames === 15) { // Further increased initial buffer
        console.log("Starting BlackMagic playback");
        data.playback.start({ startTime: 0 });
        this.startPerformanceMonitoring(outputId);
    }
}

   

    static startPerformanceMonitoring(outputId: string) {
        if (!this.playbackData[outputId]) return;

        // Monitor every 5 seconds
        const monitoringInterval = setInterval(() => {
            if (!this.playbackData[outputId]) {
                clearInterval(monitoringInterval);
                return;
            }

            try {
                // Use synchronous calls for these methods
                const bufferedFrames = this.playbackData[outputId].playback.bufferedFrames();
                const hwTime = this.playbackData[outputId].playback.hardwareTime();
                const scheduledTime = this.playbackData[outputId].playback.scheduledTime();

                console.log("--- Performance Status ---");
                console.log(`Buffered frames: ${bufferedFrames}`);
                console.log(`Hardware time: ${JSON.stringify(hwTime)}`);
                console.log(`Scheduled time: ${JSON.stringify(scheduledTime)}`);
                console.log(`Pending promises: ${Object.keys(this.framePromises[outputId] || {}).length}`);
                console.log(`Total scheduled frames: ${this.playbackData[outputId].scheduledFrames}`);
                console.log("-------------------------");
            } catch (err) {
                console.error("Error in performance monitoring:", err);
            }
        }, 5000);

        // Store the interval for cleanup
        this.playbackData[outputId].monitoringInterval = monitoringInterval;
    }
    
    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, outputId: string) {
        // Get target dimensions from display mode
        const currentMode = this.playbackData[outputId];
        const targetDims = currentMode?.displayMode ?
            this.getTargetDimensions(currentMode.displayMode) : undefined;

        // Reduced logging - only log significant dimension changes
        if (targetDims && (targetDims.width !== size.width || targetDims.height !== size.height)) {
            console.log(`Converting format: ${format}, from ${size.width}x${size.height} to ${targetDims.width}x${targetDims.height}`);
        }


        console.log(`Converting format: ${format}, from ${size.width}x${size.height} to ${targetDims?.width}x${targetDims?.height}`);

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
        console.warn(`Unrecognized display mode: ${displayMode}, defaulting to 1080p`);
        return {
            width: 1920,
            height: 1080
        };
    }
    
    // And update stop method for cleanup:
    static stop(outputId: string) {
        if (!this.playbackData[outputId]) return;

        console.log("Blackmagic - stopping sender: " + outputId);

        // Clear monitoring interval if it exists
        if (this.playbackData[outputId].monitoringInterval) {
            clearInterval(this.playbackData[outputId].monitoringInterval);
        }

        this.playbackData[outputId].playback.stop();

        // Clean up frame promises
        if (this.framePromises[outputId]) {
            delete this.framePromises[outputId];
        }

        delete this.playbackData[outputId];
    }

    //static stop(outputId: string) {
    //    if (!this.playbackData[outputId]) return;
//
    //    console.log("Blackmagic - stopping sender: " + outputId);
    //    this.playbackData[outputId].playback.stop();
//
    //    // Clean up frame promises
    //    if (this.framePromises[outputId]) {
    //        delete this.framePromises[outputId];
    //    }
//
    //    delete this.playbackData[outputId];
    //}
    
    static stopAll() {
        Object.keys(this.playbackData).forEach(stop)
    }
}