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
            playback: PlaybackChannel;scheduledFrames: number;pixelFormat: string;displayMode: string;forcedResolution ? : {
                width: number;height: number;
            }
        }
    } = {}
    static devicePixelMode: "BGRA" | "ARGB" = "BGRA"

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

    // static alerted = false
    static scheduleFrame(outputId: string, videoFrame: Buffer, _audioFrame: Buffer | null, framerate: number = 1000, size: Size) {

        if (!this.playbackData[outputId]) return



        // if (!this.alerted) {
        //     // DEBUG ALERT
        //     dialog.showMessageBox(mainWindow!, {
        //         message:
        //             this.devicePixelMode + // "BGRA"
        //             " - " +
        //             this.playbackData[outputId].pixelFormat + // "8-bit YUV"
        //             " - " +
        //             OutputHelper.getOutput(outputId).window.getBounds().width + // 1920
        //             "x" +
        //             OutputHelper.getOutput(outputId).window.getBounds().height + // 1080
        //             " - " +
        //             this.playbackData[outputId].displayMode, // 1080p29.97
        //     })
        //     this.alerted = true
        // }

        if (videoFrame.length === 0 || size.width === 0 || size.height === 0) {
            console.warn("Skipping empty frame");
            return;
        }

        console.log(`Scheduling frame: Input buffer size: ${videoFrame.length}, Format: ${this.playbackData[outputId].pixelFormat}, Size: ${size.width}x${size.height}`);

        videoFrame = this.convertVideoFrameFormat(videoFrame, this.playbackData[outputId].pixelFormat, size, outputId);

        this.playbackData[outputId].playback.schedule({
            video: videoFrame, // Video frame data. Decklink SDK docs have byte packing
            // audio: audioFrame, // Frames-worth of interleaved audio data
            sampleFrameCount: 1920, // Optional - otherwise based on buffer length
            time: this.playbackData[outputId].scheduledFrames * framerate, // Relative to timescale in playback object
            // Hint: Use 1001 for fractional framerates like 59.94
        })

        this.playbackData[outputId].scheduledFrames++
        this.sendFrame(outputId)
    }

    static async sendFrame(outputId: string) {
        if (!this.playbackData[outputId]) return

        if (this.playbackData[outputId].scheduledFrames === 3)
            // Need to queue up a few frames - number depends on hardware
            this.playbackData[outputId].playback.start({
                startTime: 0
            })
        if (this.playbackData[outputId].scheduledFrames > 2) {
            // Regulate playback based on played time - latency depends on hw.
            await this.playbackData[outputId].playback.played(this.playbackData[outputId].scheduledFrames * 1000 - 3000)
            // Don't allow the data be garbage collected until after playback
        }
    }

    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size, outputId: string) {
        // Get target dimensions from display mode
        const currentMode = this.playbackData[outputId];
        const targetDims = currentMode?.displayMode ?
            this.getTargetDimensions(currentMode.displayMode) : undefined;

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

    static stop(outputId: string) {
        if (!this.playbackData[outputId]) return

        console.log("Blackmagic - stopping sender: " + outputId)
        this.playbackData[outputId].playback.stop()
        delete this.playbackData[outputId]
    }

    static stopAll() {
        Object.keys(this.playbackData).forEach(stop)
    }
}