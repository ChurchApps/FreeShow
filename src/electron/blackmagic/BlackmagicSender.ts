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
  };
  monitoringInterval?: NodeJS.Timeout;
  bufferCheckInterval?: NodeJS.Timeout;
  lastLogTime: number;
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
  recoveryAttempts?: number; // Add this property
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

export class BlackmagicSender {
  static playbackData: {
    [key: string]: PlaybackData;
  } = {};

  static devicePixelMode: "BGRA" | "ARGB" =
    os.endianness() === "BE" ? "ARGB" : "BGRA";
  static framePromises: { [key: string]: { [time: number]: Promise<any> } } =
    {};
  static isPaused: { [key: string]: boolean } = {};
  static frameSkipCounter: { [key: string]: number } = {};

  // Buffer for silent audio to avoid recreating it for each frame
  static silentAudioBuffers: { [channels: number]: Buffer } = {};

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

        // Calculate appropriate buffer size based on display mode using our new method
        const targetBufferSize = this.calculateOptimalBufferSize(displayModeName, pixelFormat);

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
            recoveryAttempts: 0
        };

        this.framePromises[outputId] = {};
        
        console.log(`Sender initialized with target dimensions: ${targetDimensions.width}x${targetDimensions.height}, buffer size: ${targetBufferSize}`);
        return true;
    } catch (err) {
        console.error(`Failed to initialize playback: ${err.message}`);
        return false;
    }
}

  static performanceLog: PerformanceMetrics[] = [];

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
    // First, check if we need to reinitialize
    if (this.playbackData[outputId]?.needsReinit) {
      return; // Skip frame scheduling while waiting for reinit
    }

    if (!this.playbackData[outputId] || this.isPaused[outputId]) return;

    const data = this.playbackData[outputId];

    // Skip empty frames
    if (
      !videoFrame ||
      videoFrame.length === 0 ||
      size.width === 0 ||
      size.height === 0
    ) {
      return;
    }

    try {
      // Check buffer status
      let bufferedFrames = 0;

      try {
        bufferedFrames = data.playback.bufferedFrames();

        // Check if we're overloaded and implement smart frame dropping
        if (bufferedFrames > data.targetBufferSize * 1.2) {
          // Implement frame dropping with pattern (e.g., keep every other frame)
          if (this.frameSkipCounter[outputId] % 2 !== 0) {
            this.frameSkipCounter[outputId]++;
            return; // Skip this frame
          }
          this.frameSkipCounter[outputId]++;
        } else {
          // Reset counter when not overloaded
          this.frameSkipCounter[outputId] = 0;
        }
      } catch (err) {
        // Handle "Already stopped" error specifically
        if (err.message === "Already stopped") {
          console.log(
            `Output ${outputId} playback stopped, attempting to reinitialize`
          );
          data.needsReinit = true;

          // Schedule reinitialization
          setTimeout(() => {
            this.reinitializePlayback(
              outputId,
              data.deviceIndex,
              data.displayMode,
              data.pixelFormat,
              data.enableKeying || false,
              data.audioChannels || 2
            );
          }, 500);
          return;
        }

        console.error(`Error checking buffer: ${err.message}`);
        return;
      }

      // If we get here, the device is working, so continue with normal flow
      try {
        // Convert frame
        const convertedFrame = this.convertVideoFrameFormat(
          videoFrame,
          data.pixelFormat,
          size,
          outputId
        );

        // Get audio
        const audioData =
          audioFrame || this.getSilentAudio(data.audioChannels || 2);

        // Schedule frame
        const currentTime = data.scheduledFrames * framerate;
        data.playback.schedule({
          video: convertedFrame,
          audio: audioData,
          sampleFrameCount: 1920,
          time: currentTime,
        });

        // Increment frame counter
        data.scheduledFrames++;
        data.framesSinceLastCheck++;

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
            this.reinitializePlayback(
              outputId,
              data.deviceIndex,
              data.displayMode,
              data.pixelFormat,
              data.enableKeying || false,
              data.audioChannels || 2
            );
          }, 500);
        }
      }
    } catch (err) {
      console.error(`Error in scheduleFrame: ${err.message}`);
    }
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
        // If you have access to BlackmagicManager and the original parameters:
        this.playbackData[outputId].playback = await macadam.playback({
          deviceIndex: currentState.deviceIndex,
          displayMode: BlackmagicManager.getDisplayMode(
            currentState.displayMode
          ),
          pixelFormat: BlackmagicManager.getPixelFormat(
            currentState.pixelFormat
          ),
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

  // Optimized conversion with caching
  static convertVideoFrameOptimized(
    frame: Buffer,
    format: string,
    size: Size,
    outputId: string
  ) {
    const data = this.playbackData[outputId];

    // Use conversion cache if dimensions and format match
    if (
      data.conversionCache &&
      data.conversionCache.sourceWidth === size.width &&
      data.conversionCache.sourceHeight === size.height &&
      data.conversionCache.lastFormat === format
    ) {
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
            return ImageBufferConverter10Bit.BGRAtoYUV(
              inputFrame,
              size,
              targetDims
            );
          } else {
            return ImageBufferConverter10Bit.ARGBtoYUV(
              inputFrame,
              size,
              targetDims
            );
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
        converter,
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

      // Check for buffer health
      if (bufferedFrames < data.targetBufferSize / 4) {
        // Buffer is getting low, we might need to adjust timing
        console.warn(
          `Buffer running low (${bufferedFrames} frames), may need recovery`
        );

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

    // Monitor every 10 seconds for overall performance
    const monitoringInterval = setInterval(() => {
        if (!this.playbackData[outputId]) {
            clearInterval(monitoringInterval);
            return;
        }

        try {
            // Existing performance monitoring code...
            
            // Add buffer health monitoring
            this.monitorBufferHealth(outputId);
            
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
        
        this.monitorBufferHealth(outputId);
    }, 2000);

    this.playbackData[outputId].monitoringInterval = monitoringInterval;
    // Store this additional interval too
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
        // For timing drift, sometimes we can adjust without full restart
        try {
          // Calculate a new time base that's ahead of current hardware time
          const newBaseTime = Math.floor(currentHwTime / 1000) + 10; // 10 frame buffer
          data.scheduledFrames = newBaseTime;

          // Flush existing frames but don't stop playback
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
      // Try a simple operation that requires device connection
      const bufferedFrames =
        this.playbackData[outputId].playback.bufferedFrames();

      // Actually use the value to avoid the linting error
      if (bufferedFrames >= 0) {
        return true; // If we get here and have a valid value, device is connected
      }
      return false; // Should never reach here if buffer check succeeds
    } catch (err) {
      // Check if error suggests device disconnection
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

      // Other errors might not indicate disconnection
      console.warn(`Device check error: ${err.message}`);
      return true; // Assume still connected for other errors
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
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Initialize with same parameters as before
      const success = await this.initialize(
        outputId,
        deviceIndex,
        displayMode,
        pixelFormat,
        enableKeying,
        audioChannels
      );

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
    width: number;
    height: number;
  } {
    if (displayMode.includes("1080")) {
      return {
        width: 1920,
        height: 1080,
      };
    } else if (displayMode.includes("720")) {
      return {
        width: 1280,
        height: 720,
      };
    } else if (displayMode.includes("2k")) {
      return {
        width: 2048,
        height: 1080,
      };
    } else if (displayMode.includes("4K") || displayMode.includes("4k")) {
      return {
        width: 3840,
        height: 2160,
      };
    } else if (displayMode.includes("525i") || displayMode.includes("NTSC")) {
      return {
        width: 720,
        height: 486,
      };
    } else if (displayMode.includes("625i") || displayMode.includes("PAL")) {
      return {
        width: 720,
        height: 576,
      };
    }

    // Default to 1080p if mode is not recognized
    return {
      width: 1920,
      height: 1080,
    };
  }

  // Legacy method for compatibility - now calls the optimized version
  static convertVideoFrameFormat(
    frame: Buffer,
    format: string,
    size: Size,
    outputId: string
  ) {
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
        else return ImageBufferConverter.ARGBtoYUV(frame, size, targetDims);
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

  static stop(outputId: string) {
    if (!this.playbackData[outputId]) return;

    console.log(`Stopping Blackmagic sender: ${outputId}`);

    // Set paused flag first to prevent new frames
    this.isPaused[outputId] = true;

     // Clear monitoring intervals
    if (this.playbackData[outputId].monitoringInterval) {
        clearInterval(this.playbackData[outputId].monitoringInterval);
    }
    
    // Clear buffer check interval
    if (this.playbackData[outputId].bufferCheckInterval) {
        clearInterval(this.playbackData[outputId].bufferCheckInterval);
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
    Object.keys(this.playbackData).forEach((id) => this.stop(id));
    console.log("All Blackmagic senders stopped");
  }
    
  static calculateOptimalBufferSize(displayMode: string, pixelFormat: string): number {
    // Base buffer size
    let baseSize = 15;
    
    // Adjust for frame rate
    if (displayMode.includes("50") || displayMode.includes("60") || displayMode.includes("59.94")) {
        baseSize += 10; // Higher for high frame rates
    } else if (displayMode.includes("25") || displayMode.includes("30") || displayMode.includes("29.97")) {
        baseSize += 5;  // Medium for standard frame rates
    }
    
    // Adjust for resolution
    if (displayMode.includes("4K") || displayMode.includes("4k") || displayMode.includes("2160")) {
        baseSize += 10; // Higher for 4K content
    } else if (displayMode.includes("2k") || displayMode.includes("1080")) {
        baseSize += 5;  // Medium for HD/2K content
    }
    
    // Adjust for format complexity
    if (pixelFormat.includes("10-bit")) {
        baseSize += 5;  // Higher for 10-bit content
    } else if (pixelFormat.includes("RGB") || pixelFormat.includes("ARGB") || pixelFormat.includes("BGRA")) {
        baseSize += 3;  // Medium for RGB formats
    }
    
    // Consider interlaced content
    if (displayMode.includes("i")) {
        baseSize += 3;  // Add buffer for interlaced content
    }
    
    return baseSize;
}

// Add adaptive buffer adjustment to the monitoring function
static monitorBufferHealth(outputId: string) {
    if (!this.playbackData[outputId]) return;
    
    const data = this.playbackData[outputId];
    
    try {
        const bufferedFrames = data.playback.bufferedFrames();
        const now = Date.now();
        
        // Calculate current performance metrics
        if (now - data.lastPerformanceCheck > 1000) { // Check every second
            const timeDiff = (now - data.lastPerformanceCheck) / 1000;
            const currentFPS = data.framesSinceLastCheck / timeDiff;
            const expectedFps = this.getExpectedFrameRate(data.displayMode);
            
            // If FPS is consistently lower than expected, increase buffer
            if (currentFPS < expectedFps * 0.85 && bufferedFrames < 5) {
                // Buffer is too small, increase it
                data.targetBufferSize = Math.min(60, data.targetBufferSize + 2);
                console.log(`Increasing buffer size to ${data.targetBufferSize} due to low FPS`);
            }
            
            // If buffer is consistently full, we might need to adjust
            if (bufferedFrames > data.targetBufferSize * 0.9 && 
                data.targetBufferSize > this.calculateOptimalBufferSize(data.displayMode, data.pixelFormat)) {
                // Gradually reduce buffer if it's unnecessarily large
                data.targetBufferSize = Math.max(10, data.targetBufferSize - 1);
            }
            
            // Reset counters
            data.framesSinceLastCheck = 0;
            data.lastPerformanceCheck = now;
        }
        
        // Dynamic buffer adjustment based on jumpiness
        if (bufferedFrames < 3) {
            // Emergency increase if buffer is critically low
            data.targetBufferSize = Math.min(60, data.targetBufferSize + 5);
            console.log(`Emergency buffer increase to ${data.targetBufferSize}`);
        }
        
    } catch (err) {
        console.error(`Error monitoring buffer: ${err.message}`);
    }
}
}
