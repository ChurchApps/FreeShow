import macadam, { PlaybackChannel } from "macadam";
import os from "os";
import util from "../ndi/vingester-util";
import { BlackmagicManager } from "./BlackmagicManager";
import {
  ImageBufferConverter,
  ImageBufferConverter10Bit,
} from "./ImageBufferConverter";
import { Size } from "electron";

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
    lastUsed: number; // Added timestamp
  };
  monitoringInterval?: NodeJS.Timeout;
  bufferCheckInterval?: NodeJS.Timeout;
  frameCallbackInterval?: NodeJS.Timeout;
  lastLogTime: number;
  lastFrameTime?: number;
  audioChannels?: number;
  emptyBufferCount?: number;
  scheduleFailCount?: number;
  framesSinceLastCheck: number;
  lastPerformanceCheck: number;
  totalFramesDropped: number;
  hardwareTimeOffset?: number;
  targetBufferSize: number;
  deviceIndex: number;
  enableKeying?: boolean;
  needsReinit?: boolean;
  recoveryAttempts?: number;
  startTime?: number;
}

interface PerformanceMetrics {
  timestamp: number;
  outputId: string;
  bufferedFrames: number;
  frameRate: number;
  droppedFrames: number;
  timingDrift?: number;
  memoryUsage?: number;
  recoveryAttempts: number;
}

interface FramePromiseData {
  promise: Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

const originalConsoleLog = console.log;
console.log = function(...args) {
  // Check if this is a "No promise to resolve" message - be more specific
  if (args.length > 0 && 
      typeof args[0] === 'string' && 
      (args[0].includes('No promise to resolve for played frame') || 
       args[0].includes('DEBUG: No promise to resolve'))) {
    // Skip logging this message completely
    return;
  }
  
  // Call the original console.log for all other messages
  originalConsoleLog.apply(console, args);
};

const USE_FRAME_PROMISES = false;
const SEGFAULT_PRONE_DEVICES: Set<string> = new Set();

// BufferManager class for memory-efficient buffer management
export class BufferManager {
  private static readonly MIN_BUFFER_SIZE = 3;
  private static readonly MAX_BUFFER_SIZE = 15; // Reduced from 60
  
  static calculateOptimalBufferSize(displayMode: string, pixelFormat: string): number {
    let baseSize = 5; // Conservative starting point
    
    // Adjust based on resolution
    if (displayMode.includes("4K") || displayMode.includes("4k")) {
      baseSize = 8;  // Reduced from higher values
    } else if (displayMode.includes("1080")) {
      baseSize = 6;
    } else if (displayMode.includes("720")) {
      baseSize = 4;
    }
    
    // Adjust for format complexity (but keep it reasonable)
    if (pixelFormat.includes("10-bit")) {
      baseSize += 2;  // Reduced increase
    } else if (pixelFormat.includes("RGB") || pixelFormat.includes("ARGB")) {
      baseSize += 1;
    }
    
    // Consider interlaced content
    if (displayMode.includes("i")) {
      baseSize += 1;  // Minimal increase
    }
    
    return Math.min(Math.max(baseSize, this.MIN_BUFFER_SIZE), this.MAX_BUFFER_SIZE);
  }
  
  static monitorBufferHealth(outputId: string, playbackData: any) {
    if (!playbackData[outputId]) return;
    
    const data = playbackData[outputId];
    
    try {
      const bufferedFrames = data.playback.bufferedFrames();
      const now = Date.now();
      
      // Only check periodically to reduce overhead
      if (now - data.lastPerformanceCheck < 2000) return; // Check every 2 seconds
      
      const timeDiff = (now - data.lastPerformanceCheck) / 1000;
      const currentFPS = data.framesSinceLastCheck / timeDiff;
      const expectedFps = BlackmagicSender.getExpectedFrameRate(data.displayMode);
      
      // Conservative buffer adjustments
      if (currentFPS < expectedFps * 0.8 && bufferedFrames < 3) {
        // Modest increase only when really needed
        data.targetBufferSize = Math.min(this.MAX_BUFFER_SIZE, data.targetBufferSize + 1);
        console.log(`Increasing buffer size to ${data.targetBufferSize} due to low FPS`);
      }
      
      // Aggressive reduction when buffer is too large
      if (bufferedFrames > data.targetBufferSize * 0.8 && data.targetBufferSize > this.MIN_BUFFER_SIZE) {
        data.targetBufferSize = Math.max(this.MIN_BUFFER_SIZE, data.targetBufferSize - 1);
        console.log(`Reducing buffer size to ${data.targetBufferSize}`);
      }
      
      // Emergency reduction if buffer gets too large
      if (data.targetBufferSize > this.MAX_BUFFER_SIZE) {
        data.targetBufferSize = this.MAX_BUFFER_SIZE;
        console.warn(`Capping buffer size at ${this.MAX_BUFFER_SIZE}`);
      }
      
      // Reset counters
      data.framesSinceLastCheck = 0;
      data.lastPerformanceCheck = now;
      
    } catch (err) {
      console.error(`Error monitoring buffer: ${err.message}`);
    }
  }
  
  // Memory-efficient frame scheduling
  static scheduleFrameWithBackpressure(
    outputId: string,
    frameData: Buffer,
    playbackData: any
  ): boolean {
    const data = playbackData[outputId];
    if (!data) return false;
    
    try {
      const bufferedFrames = data.playback.bufferedFrames();
      
      // Implement backpressure - drop frames if buffer is too full
      if (bufferedFrames > data.targetBufferSize * 1.2) {
        console.warn(`Dropping frame due to buffer overflow (${bufferedFrames}/${data.targetBufferSize})`);
        data.totalFramesDropped = (data.totalFramesDropped || 0) + 1;
        return false;
      }
      
      // Schedule the frame
      const result = data.playback.schedule(frameData);
      
      if (result) {
        data.scheduledFrames++;
        data.framesSinceLastCheck++;
      } else {
        data.scheduleFailCount = (data.scheduleFailCount || 0) + 1;
        
        // If we're failing too often, reduce buffer target
        if (data.scheduleFailCount > 5) {
          data.targetBufferSize = Math.max(
            this.MIN_BUFFER_SIZE,
            data.targetBufferSize - 1
          );
          data.scheduleFailCount = 0;
          console.log(`Reduced buffer target to ${data.targetBufferSize} due to schedule failures`);
        }
      }
      
      return result;
      
    } catch (err) {
      console.error(`Error scheduling frame: ${err.message}`);
      return false;
    }
  }
}

export class BlackmagicSender {
  static playbackData: { [key: string]: PlaybackData } = {};
  static framePromises: { [outputId: string]: { [time: number]: FramePromiseData } } = {};
  static silentAudioBuffers: { [channels: number]: Buffer } = {};
  static devicePixelMode: "BGRA" | "ARGB" = os.endianness() === "BE" ? "ARGB" : "BGRA";
  static isPaused: { [key: string]: boolean } = {};
  static frameSkipCounter: { [key: string]: number } = {};
  static safetyCircuitBreaker: {
    [outputId: string]: {
      lastErrorTime: number;
      errorCount: number;
      isBroken: boolean;
      breakUntil: number;
    }
  } = {};
  static performanceLog: PerformanceMetrics[] = [];

  // Maximum number of frame promises to keep at once
  private static readonly MAX_FRAME_PROMISES = 100;
  
  // Maximum age for cached conversion functions (5 minutes)
  private static readonly MAX_CACHE_AGE = 5 * 60 * 1000;
  
  // Memory cleanup interval (every 30 seconds)
  private static readonly CLEANUP_INTERVAL = 30 * 1000;
  
  // Global cleanup timer
  private static globalCleanupTimer?: NodeJS.Timeout;

  static initialize(outputId?: string, deviceIndex?: number, displayModeName?: string, 
                   pixelFormat?: string, enableKeying?: boolean, audioChannels: number = 2) {
    // Start global memory cleanup
    if (!this.globalCleanupTimer) {
      this.globalCleanupTimer = setInterval(() => {
        this.performGlobalCleanup();
      }, this.CLEANUP_INTERVAL);
    }
    
    // If parameters are provided, handle the old initialization logic
    if (outputId && deviceIndex !== undefined && displayModeName && pixelFormat) {
      return this.initializeDevice(outputId, deviceIndex, displayModeName, pixelFormat, enableKeying || false, audioChannels);
    }
    
    // Return undefined if no device-specific initialization
    return Promise.resolve(undefined);
  }

  static async initializeDevice(outputId: string, deviceIndex: number, displayModeName: string, 
                               pixelFormat: string, enableKeying: boolean, audioChannels: number = 2) {
    
    // Skip immediately if this device is known to cause segfaults
    if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
      console.warn(`Skipping initialization of problematic device ${outputId}`);
      return false;
    }
    
    console.log(`Initializing Blackmagic sender [${outputId}] - Mode: ${displayModeName}, Format: ${pixelFormat}`);

    // Proper cleanup if sender already exists
    if (this.playbackData[outputId]) {
      try {
        this.stop(outputId);
        // Add a small delay to ensure hardware has time to reset
        await new Promise(resolve => setTimeout(resolve, 2000)); // Extra long delay
      } catch (err) {
        console.error(`Error stopping existing sender: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Get target dimensions and cache them
    const targetDimensions = this.getTargetDimensions(displayModeName);
    
    this.frameSkipCounter[outputId] = 0;
    this.isPaused[outputId] = false;
    
    // Always use at least 2 audio channels to ensure proper audio support
    const actualAudioChannels = Math.max(2, audioChannels || 2);

    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Use completely isolated promise with timeout for macadam initialization
        // This is critical to prevent segfaults during hardware initialization
        const playback = await new Promise<PlaybackChannel>((resolve, reject) => {
          // Timeout after 10 seconds
          const timeoutId = setTimeout(() => {
            reject(new Error('Playback initialization timed out after 10 seconds'));
          }, 10000);
          
          // Wrap in try-catch to ensure cleanup of timeout
          try {
            // Get display mode and pixel format objects
            const displayMode = BlackmagicManager.getDisplayMode(displayModeName);
            const pixelFormatValue = BlackmagicManager.getPixelFormat(pixelFormat);
            
            if (!displayMode) {
              clearTimeout(timeoutId);
              return reject(new Error(`Invalid display mode: ${displayModeName}`));
            }
            
            if (!pixelFormatValue) {
              clearTimeout(timeoutId);
              return reject(new Error(`Invalid pixel format: ${pixelFormat}`));
            }
            
            // Initialize macadam playback
            macadam.playback({
              deviceIndex,
              displayMode,
              pixelFormat: pixelFormatValue,
              enableKeying: enableKeying ? BlackmagicManager.isAlphaSupported(pixelFormat) : false,
              channels: actualAudioChannels,
              sampleRate: macadam.bmdAudioSampleRate48kHz,
              sampleType: macadam.bmdAudioSampleType16bitInteger,
              startTimecode: "01:00:00:00",
            }).then(result => {
              clearTimeout(timeoutId);
              resolve(result as PlaybackChannel);
            }).catch(error => {
              clearTimeout(timeoutId);
              reject(error);
            });
          } catch (err) {
            clearTimeout(timeoutId);
            reject(err);
          }
        });

        // Use BufferManager for optimal buffer size calculation
        const targetBufferSize = BufferManager.calculateOptimalBufferSize(displayModeName, pixelFormat);

        // Setup playback data
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
          deviceIndex,
          enableKeying,
          needsReinit: false,
          recoveryAttempts: 0,
          lastFrameTime: Date.now()
        };

        // CRITICAL: Disable frame callback immediately to prevent debug spam
        if (typeof playback.onFramePlayed === 'function') {
          playback.onFramePlayed(() => {
            // Do nothing - completely disable frame callbacks
          });
        }

        console.log(`Sender initialized with target dimensions: ${targetDimensions.width}x${targetDimensions.height}, buffer size: ${targetBufferSize}`);
        return true;
      } catch (err) {
        attempts++;
        console.error(`Failed to initialize playback (attempt ${attempts}): ${err instanceof Error ? err.message : String(err)}`);
        
        if (attempts < maxAttempts) {
          // Wait longer between each attempt
          const waitTime = 2000 * attempts; // Longer delays between attempts
          console.log(`Waiting ${waitTime/1000} seconds before retrying...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          console.log(`Retrying initialization for ${outputId}...`);
        }
      }
    }
    
    console.error(`Failed to initialize ${outputId} after ${maxAttempts} attempts`);
    
    // Mark this device as problematic if we couldn't initialize it after multiple attempts
    SEGFAULT_PRONE_DEVICES.add(outputId);
    console.warn(`Blackmagic device ${outputId} has been marked as unstable and will be disabled`);
    
    return false;
  }

  static performGlobalCleanup() {
    const now = Date.now();
    
    // Clean up frame promises
    Object.keys(this.framePromises).forEach(outputId => {
      this.cleanupFramePromises(outputId, now);
    });
    
    // Clean up conversion caches
    Object.keys(this.playbackData).forEach(outputId => {
      this.cleanupConversionCache(outputId, now);
    });
    
    // Clean up unused silent audio buffers
    this.cleanupSilentAudioBuffers();
  }

  static cleanupFramePromises(outputId: string, currentTime?: number) {
    if (!this.framePromises[outputId]) return;
    
    const now = currentTime || Date.now();
    const maxAge = 10000; // 10 seconds max age for promises
    const promises = this.framePromises[outputId];
    const promiseKeys = Object.keys(promises).map(Number).sort((a, b) => a - b);
    
    // Remove old promises first
    promiseKeys.forEach(time => {
      if (now - time > maxAge) {
        const promise = promises[time];
        if (promise) {
          promise.resolve({ status: 'timeout', time });
          delete promises[time];
        }
      }
    });
    
    // If we still have too many promises, remove the oldest ones
    const remainingKeys = Object.keys(promises).map(Number).sort((a, b) => a - b);
    while (remainingKeys.length > this.MAX_FRAME_PROMISES) {
      const oldestTime = remainingKeys.shift()!;
      const promise = promises[oldestTime];
      if (promise) {
        promise.resolve({ status: 'overflow', time: oldestTime });
        delete promises[oldestTime];
      }
    }
  }

  static cleanupConversionCache(outputId: string, currentTime?: number) {
    const data = this.playbackData[outputId];
    if (!data?.conversionCache) return;
    
    const now = currentTime || Date.now();
    const cache = data.conversionCache;
    
    // Check if cache is too old
    if (cache.lastUsed && (now - cache.lastUsed > this.MAX_CACHE_AGE)) {
      delete data.conversionCache;
      console.log(`Cleared stale conversion cache for ${outputId}`);
    }
  }

  static cleanupSilentAudioBuffers() {
    // Keep only commonly used channel configurations
    const commonChannels = [1, 2, 6, 8];
    
    Object.keys(this.silentAudioBuffers).forEach(channelStr => {
      const channels = parseInt(channelStr);
      if (!commonChannels.includes(channels)) {
        delete this.silentAudioBuffers[channels];
      }
    });
  }

  static isDeviceStable(outputId: string): boolean {
    return !SEGFAULT_PRONE_DEVICES.has(outputId);
  }

  static resetProblematicDevice(outputId: string): boolean {
    if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
      SEGFAULT_PRONE_DEVICES.delete(outputId);
      console.log(`Reset problematic device flag for ${outputId}`);
      return true;
    }
    return false;
  }

  static logPerformanceMetrics(outputId: string) {
    if (!this.playbackData[outputId]) return;

    try {
      const data = this.playbackData[outputId];
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        outputId,
        bufferedFrames: data.playback.bufferedFrames(),
        frameRate:
          data.framesSinceLastCheck /
          ((Date.now() - data.lastPerformanceCheck) / 1000),
        droppedFrames: data.totalFramesDropped || 0,
        recoveryAttempts: data.recoveryAttempts || 0,
      };

      // Try to get timing information
      const hwTime = data.playback.hardwareTime();
      const scheduledTime = data.playback.scheduledTime();
      if (hwTime && scheduledTime) {
        metrics.timingDrift = hwTime.hardwareTime - scheduledTime.streamTime;
      }

      // Limit log size
      this.performanceLog.push(metrics);
      if (this.performanceLog.length > 1000) {
        this.performanceLog.shift();
      }

      // Reset counters
      data.framesSinceLastCheck = 0;
      data.lastPerformanceCheck = Date.now();
    } catch (err) {
      console.error(`Error logging metrics: ${err.message}`);
    }
  }

  static getExpectedFrameRate(displayMode: string): number {
    // Parse frame rate from display mode string
    if (displayMode.includes("23.98") || displayMode.includes("2398")) {
      return 24;
    } else if (displayMode.includes("24")) {
      return 24;
    } else if (displayMode.includes("25")) {
      return 25;
    } else if (displayMode.includes("29.97") || displayMode.includes("2997")) {
      return 30;
    } else if (displayMode.includes("30")) {
      return 30;
    } else if (displayMode.includes("50")) {
      return 50;
    } else if (displayMode.includes("59.94") || displayMode.includes("5994")) {
      return 60;
    } else if (displayMode.includes("60")) {
      return 60;
    }

    // Default fallback
    return 30;
  }

  static scheduleFrame(
    outputId: string,
    videoFrame: Buffer,
    audioFrame: Buffer | null,
    framerate: number = 1000,
    size: Size
  ) {
    // Skip immediately if this device is known to cause segfaults
    if (SEGFAULT_PRONE_DEVICES.has(outputId)) {
      return;
    }

    // Skip processing entirely if the device is paused or being reinitialized
    if (!this.playbackData[outputId] || 
        this.playbackData[outputId]?.needsReinit || 
        this.isPaused[outputId]) {
      return;
    }

    // Verify we have valid data
    const data = this.playbackData[outputId];
    if (!data || !data.playback) {
      return;
    }

    // IMPORTANT: Only schedule a frame every X milliseconds to prevent hardware overload
    // This dramatically reduces the frame rate but should prevent segfaults
    const now = Date.now();
    const minInterval = 100; // Only process frames every 100ms (10fps max)
    if (data.lastFrameTime && (now - data.lastFrameTime) < minInterval) {
      return; // Skip this frame - coming too fast
    }
    data.lastFrameTime = now;

    // Use setTimeout to completely isolate each frame scheduling operation
    // This prevents a crash in one frame from affecting others
    setTimeout(() => {
      try {
        // Skip empty frames
        if (!videoFrame || videoFrame.length === 0 || !size || size.width === 0 || size.height === 0) {
          return;
        }

        // Check buffer status
        let bufferedFrames = 0;
        try {
          bufferedFrames = data.playback.bufferedFrames();
          
          // Use BufferManager for backpressure checking
          if (bufferedFrames > data.targetBufferSize * 1.2) {
            return; // Buffer too full, skip frame
          }
        } catch (err) {
          console.log(`Buffer check error: ${err instanceof Error ? err.message : String(err)}`);
          return; // Skip frame on any error
        }

        try {
          // Clone video frame for safety
          const clonedVideoFrame = Buffer.from(videoFrame);
          
          // Convert with safety using cached conversion
          let convertedFrame;
          try {
            convertedFrame = this.convertVideoFrameFormatCached(
              clonedVideoFrame,
              data.pixelFormat,
              size,
              outputId
            );
          } catch (err) {
            console.error(`Frame conversion error: ${err instanceof Error ? err.message : String(err)}`);
            return;
          }

          // Get audio safely
          const audioData = audioFrame ? Buffer.from(audioFrame) : this.getSilentAudio(data.audioChannels || 2);

          // Calculate current time
          const currentTime = data.scheduledFrames * framerate;
          
          // Schedule the frame directly with playback.schedule()
          const frameDataToSchedule = {
            video: convertedFrame,
            audio: audioData,
            sampleFrameCount: 1920,
            time: currentTime,
          };
          
          // Use the original schedule method but with BufferManager backpressure check
          try {
            const bufferedFrames = data.playback.bufferedFrames();
            
            // Check backpressure before scheduling
            if (bufferedFrames > data.targetBufferSize * 1.2) {
              console.warn(`Dropping frame due to buffer overflow (${bufferedFrames}/${data.targetBufferSize})`);
              data.totalFramesDropped = (data.totalFramesDropped || 0) + 1;
              return;
            }
            
            // Schedule the frame using the original method
            data.playback.schedule(frameDataToSchedule);
            
            // Assume scheduling was successful if no error was thrown
            data.scheduledFrames++;
            data.framesSinceLastCheck++;
            
            // Start playback if needed
            if (!data.isStarted && bufferedFrames >= Math.min(10, data.targetBufferSize)) {
              try {
                console.log("Starting BlackMagic playback");
                data.playback.start({ startTime: 0 });
                data.isStarted = true;
              } catch (err) {
                if (err instanceof Error && err.message !== "Already started") {
                  console.error(`Error starting playback: ${err.message}`);
                } else {
                  data.isStarted = true;
                }
              }
            }
          } catch (scheduleErr) {
            console.error(`Frame scheduling error: ${scheduleErr instanceof Error ? scheduleErr.message : String(scheduleErr)}`);
            
            // Handle schedule failures
            data.scheduleFailCount = (data.scheduleFailCount || 0) + 1;
            
            // If we're failing too often, reduce buffer target
            if (data.scheduleFailCount > 5) {
              data.targetBufferSize = Math.max(3, data.targetBufferSize - 1);
              data.scheduleFailCount = 0;
              console.log(`Reduced buffer target to ${data.targetBufferSize} due to schedule failures`);
            }
          }
        } catch (err) {
          console.error(`Schedule error: ${err instanceof Error ? err.message : String(err)}`);
          
          // If schedule fails completely, mark device as problematic
          if (err instanceof Error && 
              (err.message.includes("Already stopped") || 
               err.message.includes("Failed") || 
               err.message.includes("Error"))) {
            
            // Mark for reinitialization
            data.needsReinit = true;
            this.isPaused[outputId] = true;
            
            // Schedule recovery with longer delay
            setTimeout(() => {
              this.reinitializePlayback(
                outputId,
                data.deviceIndex,
                data.displayMode,
                data.pixelFormat,
                data.enableKeying || false,
                data.audioChannels || 2
              );
            }, 2000);
          }
        }
      } catch (err) {
        console.error(`General error in frame processing: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 0); // End setTimeout - this executes the frame scheduling in a separate tick
  }

  // Enhanced conversion function with proper cache management
  static convertVideoFrameFormatCached(
    frame: Buffer,
    format: string,
    size: Size,
    outputId: string
  ): Buffer {
    const data = this.playbackData[outputId];
    if (!data) return frame;

    // Check if we can reuse cached converter
    if (
      data.conversionCache &&
      data.conversionCache.sourceWidth === size.width &&
      data.conversionCache.sourceHeight === size.height &&
      data.conversionCache.lastFormat === format
    ) {
      // Update last used time
      data.conversionCache.lastUsed = Date.now();
      return data.conversionCache.converter(frame);
    }

    // Clear old cache before creating new one
    if (data.conversionCache) {
      delete data.conversionCache;
    }

    const targetDims = data.targetDimensions;
    if (!targetDims) return frame;

    // Create new converter function
    let converter: (inputFrame: Buffer) => Buffer;

    if (format.includes("YUV")) {
      converter = (inputFrame: Buffer) => {
        if (format.includes("10")) {
          return this.devicePixelMode === "BGRA"
            ? ImageBufferConverter10Bit.BGRAtoYUV(inputFrame, size, targetDims)
            : ImageBufferConverter10Bit.ARGBtoYUV(inputFrame, size, targetDims);
        } else {
          return this.devicePixelMode === "BGRA"
            ? ImageBufferConverter.BGRAtoYUV(inputFrame, size, targetDims)
            : ImageBufferConverter.ARGBtoYUV(inputFrame, size, targetDims);
        }
      };
    } else if (format.includes("ARGB")) {
      converter = (inputFrame: Buffer) => {
        if (this.devicePixelMode === "BGRA") {
          const result = Buffer.from(inputFrame);
          ImageBufferConverter.BGRAtoARGB(result);
          return result;
        }
        return inputFrame;
      };
    } else {
      // Default: return original frame
      converter = (inputFrame: Buffer) => inputFrame;
    }

    // Cache the new converter with timestamp
    data.conversionCache = {
      sourceWidth: size.width,
      sourceHeight: size.height,
      lastFormat: format,
      converter,
      lastUsed: Date.now()
    };

    return converter(frame);
  }

  static startFrameCallbackHandler(outputId: string) {
    // COMPLETELY DISABLE frame callback handling since USE_FRAME_PROMISES = false
    // This prevents the "No promise to resolve" debug messages
    // Note: outputId parameter kept for compatibility with existing calls
    void outputId; // Explicitly mark as unused
    return;
  }

  static monitorOutputHealth(outputId: string): {
    healthy: boolean;
    issues: string[];
  } {
    if (!this.playbackData[outputId])
      return { healthy: false, issues: ["Output not found"] };

    const data = this.playbackData[outputId];
    const issues: string[] = [];
    let healthy = true;

    try {
      // Check buffer health
      const bufferedFrames = data.playback.bufferedFrames();
      if (bufferedFrames < 3) {
        issues.push("Critical buffer underrun");
        healthy = false;
      } else if (bufferedFrames < data.targetBufferSize / 4) {
        issues.push("Buffer running low");
      }

      // Check timing drift
      const hwTime = data.playback.hardwareTime();
      const scheduledTime = data.playback.scheduledTime();

      if (hwTime && scheduledTime) {
        const drift = Math.abs(hwTime.hardwareTime - scheduledTime.streamTime);
        if (drift > 5000) {
          issues.push(`Severe timing drift: ${drift}`);
          healthy = false;
        } else if (drift > 2000) {
          issues.push(`Timing drift detected: ${drift}`);
        }
      }

      // Check frame rate stability
      if (data.framesSinceLastCheck > 0) {
        const timeSinceLastCheck = Date.now() - data.lastPerformanceCheck;
        const calculatedFps =
          data.framesSinceLastCheck / (timeSinceLastCheck / 1000);
        const expectedFps = this.getExpectedFrameRate(data.displayMode);

        if (calculatedFps < expectedFps * 0.7) {
          issues.push(
            `Frame rate too low: ${calculatedFps.toFixed(
              1
            )}fps vs expected ${expectedFps}fps`
          );
          healthy = false;
        }
      }
    } catch (err) {
      issues.push(`Health check error: ${err.message}`);
      healthy = false;
    }

    return { healthy, issues };
  }

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
        enableKeying: data.enableKeying,
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
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if we still have the output
      if (!this.playbackData[outputId]) return;

      // Create new playback object
      try {
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

        // CRITICAL: Disable frame callback immediately to prevent debug spam
        const newPlayback = this.playbackData[outputId].playback;
        if (typeof newPlayback.onFramePlayed === 'function') {
          newPlayback.onFramePlayed(() => {
            // Do nothing - completely disable frame callbacks
          });
        }

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
        this.stop(outputId);
      }
    } catch (err) {
      console.error(`Error during reinitialization: ${err.message}`);
      this.stop(outputId);
    }
  }

  static startPlayback(outputId: string) {
    if (!this.playbackData[outputId]) return;

    const data = this.playbackData[outputId];

    try {
      console.log(
        `Starting BlackMagic playback with buffer of ${data.playback.bufferedFrames()} frames`
      );
      data.playback.start({ startTime: 0 });
      data.isStarted = true;

      // Capture hardware time offset for drift correction
      const hwTime = data.playback.hardwareTime();
      if (hwTime) {
        data.hardwareTimeOffset =
          hwTime.hardwareTime - data.scheduledFrames * 1000;
        console.log(
          `Captured hardware time offset: ${data.hardwareTimeOffset}`
        );
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

  static convertVideoFrameOptimized(frame: Buffer, format: string, size: Size, outputId: string) {
    // Use the new cached conversion method
    return this.convertVideoFrameFormatCached(frame, format, size, outputId);
  }

  static checkPerformance(outputId: string) {
    if (!this.playbackData[outputId]) return;

    const data = this.playbackData[outputId];
    const now = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    // Only check periodically to reduce overhead
    if (now - data.lastPerformanceCheck < checkInterval) return;

    try {
      const bufferedFrames = data.playback.bufferedFrames();
      const framesPerSecond =
        data.framesSinceLastCheck / ((now - data.lastPerformanceCheck) / 1000);

      // Log performance metrics
      console.log(
        `Performance: ${framesPerSecond.toFixed(
          1
        )} fps, buffer: ${bufferedFrames}/${data.targetBufferSize} frames`
      );

      // Reset counters
      data.framesSinceLastCheck = 0;
      data.lastPerformanceCheck = now;

      // Check for buffer health using BufferManager
      BufferManager.monitorBufferHealth(outputId, this.playbackData);

      if (bufferedFrames < data.targetBufferSize / 4) {
        console.warn(
          `Buffer running low (${bufferedFrames} frames), may need recovery`
        );

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

    // Monitor every 10 seconds for overall performance
    const monitoringInterval = setInterval(() => {
      if (!this.playbackData[outputId]) {
        clearInterval(monitoringInterval);
        return;
      }

      try {
        // Use BufferManager for buffer health monitoring
        BufferManager.monitorBufferHealth(outputId, this.playbackData);
        
      } catch (err) {
        console.error("Error in performance monitoring:", err);
      }
    }, 10000);

    // Add more frequent buffer health checks (every 2 seconds)
    const bufferCheckInterval = setInterval(() => {
      if (!this.playbackData[outputId]) {
        clearInterval(bufferCheckInterval);
        return;
      }
      
      BufferManager.monitorBufferHealth(outputId, this.playbackData);
    }, 2000);

    this.playbackData[outputId].monitoringInterval = monitoringInterval;
    this.playbackData[outputId].bufferCheckInterval = bufferCheckInterval;
  }

  static async recoverPlayback(outputId: string, currentHwTime: number) {
    if (!this.playbackData[outputId]) return;

    // Don't attempt multiple recoveries simultaneously
    if (this.isPaused[outputId]) return;

    console.log(`Starting recovery for output ${outputId}`);
    this.isPaused[outputId] = true;

    try {
      const data = this.playbackData[outputId];

      // Analyze what type of recovery is needed
      const health = this.monitorOutputHealth(outputId);

      if (health.issues.some((i) => i.includes("timing drift"))) {
        try {
          // Calculate a new time base that's ahead of current hardware time
          const newBaseTime = Math.floor(currentHwTime / 1000) + 10; // 10 frame buffer
          data.scheduledFrames = newBaseTime;

          console.log("Recovery: Adjusting timing only");

          // Resume scheduling with new time base
          setTimeout(() => {
            this.isPaused[outputId] = false;
          }, 100);

          return; // Skip full reinitialization
        } catch (err) {
          console.log(
            "Timing adjustment failed, proceeding with full recovery"
          );
        }
      }

      // If we get here, we need a full recovery
      console.log("Recovery: Performing full reinitialization");

      // Proceed with full reinitialization
      this.reinitializePlayback(
        outputId,
        data.deviceIndex,
        data.displayMode,
        data.pixelFormat,
        data.enableKeying || false,
        data.audioChannels || 2
      );
    } catch (err) {
      console.error(`Recovery failed: ${err.message}`);

      // Ensure we don't leave in paused state
      setTimeout(() => {
        if (this.playbackData[outputId]) {
          this.isPaused[outputId] = false;
        }
      }, 500);
    }
  }

  static checkDeviceConnection(outputId: string): boolean {
    if (!this.playbackData[outputId]) return false;

    try {
      const bufferedFrames = this.playbackData[outputId].playback.bufferedFrames();

      if (bufferedFrames >= 0) {
        return true;
      }
      return false;
    } catch (err) {
      if (
        err.message.includes("disconnected") ||
        err.message.includes("not found") ||
        err.message.includes("Already stopped")
      ) {
        console.error(
          `Device for ${outputId} appears disconnected: ${err.message}`
        );
        return false;
      }

      console.warn(`Device check error: ${err.message}`);
      return true;
    }
  }

  static async reinitializePlayback(
    outputId: string,
    deviceIndex: number,
    displayMode: string,
    pixelFormat: string,
    enableKeying: boolean,
    audioChannels: number = 2
  ) {
    console.log(`Reinitializing playback for ${outputId}`);

    this.isPaused[outputId] = true;

    if (this.playbackData[outputId]) {
      const current = this.playbackData[outputId];
      current.recoveryAttempts = (current.recoveryAttempts || 0) + 1;
      
      if (current.recoveryAttempts > 5) {
        console.warn(`Warning: Multiple recovery attempts (${current.recoveryAttempts}) for ${outputId}`);
      }
    }

    // Clean up old playback data with defensive error handling
    if (this.playbackData[outputId]) {
      try {
        // Clean up intervals
        if (this.playbackData[outputId].monitoringInterval) {
          clearInterval(this.playbackData[outputId].monitoringInterval);
        }
        
        if (this.playbackData[outputId].bufferCheckInterval) {
          clearInterval(this.playbackData[outputId].bufferCheckInterval);
        }
        
        // Try to stop the playback, but ignore any errors
        try {
          this.playbackData[outputId].playback.stop();
        } catch (err) {
          // Ignore errors during stop
        }
      } catch (err) {
        console.error(`Error cleaning up old playback: ${err.message}`);
      }
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      delete this.playbackData[outputId];
      
      if (USE_FRAME_PROMISES) {
        delete this.framePromises[outputId];
      }
      
      const success = await this.initializeDevice(
        outputId,
        deviceIndex,
        displayMode,
        pixelFormat,
        enableKeying,
        audioChannels
      );

      if (success) {
        console.log(`Successfully reinitialized playback for ${outputId}`);
        this.isPaused[outputId] = false;
      } else {
        console.error(`Failed to reinitialize playback for ${outputId}`);
      }
    } catch (err) {
      console.error(`Error during reinitialization: ${err.message}`);
      
      setTimeout(() => {
        this.initializeDevice(
          outputId,
          deviceIndex,
          displayMode,
          pixelFormat,
          enableKeying,
          audioChannels
        ).then(success => {
          if (success) {
            this.isPaused[outputId] = false;
          }
        });
      }, 3000);
    }
  }

  static ensureSilentAudioBuffer(channels: number) {
    if (!this.silentAudioBuffers[channels]) {
      const sampleCount = 1920;
      const bufferSize = sampleCount * 2 * channels;
      this.silentAudioBuffers[channels] = Buffer.alloc(bufferSize);
    }
  }

  static getSilentAudio(channels: number = 2): Buffer {
    this.ensureSilentAudioBuffer(channels);
    return this.silentAudioBuffers[channels];
  }

  static getTargetDimensions(displayMode: string): {
    width: number;
    height: number;
  } {
    if (displayMode.includes("1080")) {
      return { width: 1920, height: 1080 };
    } else if (displayMode.includes("720")) {
      return { width: 1280, height: 720 };
    } else if (displayMode.includes("2k")) {
      return { width: 2048, height: 1080 };
    } else if (displayMode.includes("4K") || displayMode.includes("4k")) {
      return { width: 3840, height: 2160 };
    } else if (displayMode.includes("525i") || displayMode.includes("NTSC")) {
      return { width: 720, height: 486 };
    } else if (displayMode.includes("625i") || displayMode.includes("PAL")) {
      return { width: 720, height: 576 };
    }

    return { width: 1920, height: 1080 };
  }

  static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, outputId: string) {
    const currentMode = this.playbackData[outputId];
    const targetDims = currentMode?.targetDimensions;

    if (format.includes("ARGB")) {
      if (this.devicePixelMode === "BGRA") {
        const result = Buffer.from(frame);
        ImageBufferConverter.BGRAtoARGB(result);
        return result;
      }
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
        else return ImageBufferConverter.ARGBtoYUV(frame, size, targetDims);
      }
    } else if (format.includes("BGRA")) {
      if (this.devicePixelMode === "ARGB") {
        const result = Buffer.from(frame);
        util.ImageBufferAdjustment.ARGBtoBGRA(result);
        return result;
      }
      return frame;
    } else if (format.includes("RGBXLE")) {
      const result = Buffer.from(frame);
      if (this.devicePixelMode === "BGRA")
        ImageBufferConverter.BGRAtoRGBXLE(result);
      else ImageBufferConverter.ARGBtoRGBXLE(result);
      return result;
    } else if (format.includes("RGBLE")) {
      if (this.devicePixelMode === "BGRA")
        return ImageBufferConverter.BGRAtoRGBLE(frame);
      else return ImageBufferConverter.ARGBtoRGBLE(frame);
    } else if (format.includes("RGBX")) {
      const result = Buffer.from(frame);
      if (this.devicePixelMode === "BGRA")
        util.ImageBufferAdjustment.BGRAtoBGRX(result);
      else ImageBufferConverter.ARGBtoRGBX(result);
      return result;
    } else if (format.includes("RGB")) {
      if (this.devicePixelMode === "BGRA")
        return ImageBufferConverter.BGRAtoRGB(frame);
      else return ImageBufferConverter.ARGBtoRGB(frame);
    }

    return frame;
  }

  static stop(outputId: string): boolean {
    console.log(`Stopping Blackmagic output: ${outputId}`);
    
    const data = this.playbackData[outputId];
    if (!data) return false;

    try {
      // Stop all timers immediately
      if (data.monitoringInterval) {
        clearInterval(data.monitoringInterval);
        data.monitoringInterval = undefined;
      }
      
      if (data.bufferCheckInterval) {
        clearInterval(data.bufferCheckInterval);
        data.bufferCheckInterval = undefined;
      }
      
      if (data.frameCallbackInterval) {
        clearInterval(data.frameCallbackInterval);
        data.frameCallbackInterval = undefined;
      }

      // Clean up all pending frame promises immediately
      if (this.framePromises[outputId]) {
        Object.values(this.framePromises[outputId]).forEach(promise => {
          promise.resolve({ status: 'stopped' });
        });
        delete this.framePromises[outputId];
      }

      // Clear conversion cache
      if (data.conversionCache) {
        delete data.conversionCache;
      }

      // Stop the actual playback
      if (data.playback) {
        data.playback.stop();
      }

      // Set paused flag
      this.isPaused[outputId] = true;

      // Remove from tracking
      delete this.playbackData[outputId];
      delete this.frameSkipCounter[outputId];
      
      console.log(`Successfully stopped output ${outputId}`);
      return true;
      
    } catch (err) {
      console.error(`Error stopping output ${outputId}: ${err.message}`);
      
      // Force cleanup even if there was an error
      delete this.playbackData[outputId];
      delete this.framePromises[outputId];
      delete this.frameSkipCounter[outputId];
      
      return false;
    }
  }

  static stopAll(): void {
    console.log("Stopping all Blackmagic outputs...");
    
    // Stop global cleanup timer
    if (this.globalCleanupTimer) {
      clearInterval(this.globalCleanupTimer);
      this.globalCleanupTimer = undefined;
    }
    
    // Stop all outputs
    const outputIds = Object.keys(this.playbackData);
    outputIds.forEach(outputId => {
      this.stop(outputId);
    });
    
    // Force clear all tracking data
    this.playbackData = {};
    this.framePromises = {};
    this.isPaused = {};
    this.frameSkipCounter = {};
    this.silentAudioBuffers = {};
    this.safetyCircuitBreaker = {};
    
    console.log(`Stopped ${outputIds.length} outputs`);
  }

  // Replace the old calculateOptimalBufferSize and monitorBufferHealth methods
  static calculateOptimalBufferSize(displayMode: string, pixelFormat: string): number {
    return BufferManager.calculateOptimalBufferSize(displayMode, pixelFormat);
  }

  static monitorBufferHealth(outputId: string) {
    BufferManager.monitorBufferHealth(outputId, this.playbackData);
  }

  // Memory usage monitoring
  static getMemoryUsage(): {
    totalOutputs: number;
    totalFramePromises: number;
    conversionCaches: number;
    audioBuffers: number;
  } {
    const totalFramePromises = Object.values(this.framePromises)
      .reduce((sum, promises) => sum + Object.keys(promises).length, 0);
    
    const conversionCaches = Object.values(this.playbackData)
      .filter(data => data.conversionCache).length;
    
    return {
      totalOutputs: Object.keys(this.playbackData).length,
      totalFramePromises,
      conversionCaches,
      audioBuffers: Object.keys(this.silentAudioBuffers).length
    };
  }

  // Shutdown method for application exit
  static shutdown(): void {
    console.log("Shutting down BlackmagicSender...");
    this.stopAll();
    
    // Additional cleanup
    setTimeout(() => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }, 1000);
  }
}