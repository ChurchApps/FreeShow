import type { Size } from "electron"
import type { CaptureChannel, CaptureFrame } from "macadam"
import { toApp } from ".."
import { BLACKMAGIC } from "../../types/Channels"
import util from "../ndi/vingester-util"
import { OutputHelper } from "../output/OutputHelper"
import { BlackmagicManager } from "./BlackmagicManager"
import { InputImageBufferConverter } from "./ImageBufferConverter"

// Dynamically require macadam to handle missing dependency gracefully
let macadam: any = null
try {
    macadam = require("macadam")
} catch (err) {
    console.warn("Blackmagic macadam module not available:", err instanceof Error ? err.message : String(err))
}

interface ReceiverData {
    receiver?: CaptureChannel
    interval?: NodeJS.Timeout
    displayMode: string
    pixelFormat: string
}

/**
 * Manages Blackmagic Design video capture (input) devices
 */
export class BlackmagicReceiver {
    static BMD_RECEIVERS: { [key: string]: ReceiverData } = {}
    static allActiveReceivers: { [key: string]: any } = {}
    static sendToOutputs: string[] = []
    static lastFrameTime = 0

    /**
     * Initialize a Blackmagic capture device
     *
     * @param deviceId Device handle/ID
     * @param audioChannels Number of audio channels (0 to disable audio)
     */
    static async initialize(deviceId: string, audioChannels = 2) {
        // Check if macadam is available
        if (!macadam) {
            console.error("Cannot initialize Blackmagic receiver: macadam module not available")
            return
        }

        if (this.BMD_RECEIVERS[deviceId]?.receiver) return this.BMD_RECEIVERS[deviceId].receiver

        const deviceIndex = BlackmagicManager.getIndexById(deviceId)
        if (deviceIndex < 0) return

        const device = BlackmagicManager.getDeviceById(deviceId)
        if (!device || !device.inputDisplayModes?.[0]) return

        const displayMode = device.inputDisplayModes[0].name // Select first available
        const pixelFormat = device.inputDisplayModes[0].videoModes[0] // Select first available

        if (!this.BMD_RECEIVERS[deviceId]) this.BMD_RECEIVERS[deviceId] = { displayMode, pixelFormat }
        return (this.BMD_RECEIVERS[deviceId].receiver = await macadam.capture({
            deviceIndex,
            displayMode: BlackmagicManager.getDisplayMode(displayMode),
            pixelFormat: BlackmagicManager.getPixelFormat(pixelFormat),
            channels: audioChannels,
            sampleRate: macadam.bmdAudioSampleRate48kHz,
            sampleType: macadam.bmdAudioSampleType16bitInteger
        }))
    }

    /**
     * Start capturing video from a Blackmagic device
     */
    static async startCapture({ source, outputId }: any) {
        if (!this.sendToOutputs.includes(outputId)) this.sendToOutputs.push(outputId)

        const deviceId: string = source.id
        if (this.BMD_RECEIVERS[deviceId]?.interval) return

        const receiver = await this.initialize(deviceId)
        if (!receiver) return

        const frameRate = (receiver.frameRate[1] || 30000) / (receiver.frameRate[0] || 1001)

        let gettingFrame = false
        this.BMD_RECEIVERS[deviceId].interval = setInterval(
            async () => {
                if (gettingFrame) return
                gettingFrame = true

                try {
                    if (!receiver) return this.stopReceiver({ id: source.id, outputId })
                    const frame = await receiver.frame()
                    this.sendFrame(source.id, frame, { width: receiver.width, height: receiver.height })
                } catch (err) {
                    console.error(err)
                    this.stopReceiver({ id: source.id, outputId })
                }

                gettingFrame = false
            },
            Math.round(1000 / frameRate)
        )
    }

    /**
     * Capture a single frame from a Blackmagic device
     */
    static async captureFrame({ source }: any) {
        const deviceId: string = source.id
        const receiver = await this.initialize(deviceId)
        if (!receiver) return

        try {
            const frame = await receiver.frame()
            this.sendFrame(source.id, frame, { width: receiver.width, height: receiver.height })
        } catch (err) {
            console.error(err)
            this.stopReceiver({ id: source.id })
        }
    }

    /**
     * Send a captured frame to all registered outputs
     */
    static sendFrame(id: string, frame: CaptureFrame, size: Size) {
        if (!frame) return

        // Skip frames if system is overloaded (lagging below 10 fps)
        const timeSinceLastFrame = Date.now() - this.lastFrameTime
        if (timeSinceLastFrame > 100 && timeSinceLastFrame < 200) return

        const pixelFormat = this.BMD_RECEIVERS[id].pixelFormat
        frame.video.data = this.convertVideoFrameFormat(frame.video.data, pixelFormat, size)

        const msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(BLACKMAGIC, msg)

        this.sendToOutputs.forEach((outputId) => {
            OutputHelper.Send.sendToWindow(outputId, msg, BLACKMAGIC)
        })

        this.lastFrameTime = Date.now()
    }

    /**
     * Convert video frame format from Blackmagic to RGBA
     */
    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size): Buffer {
        if (format.includes("ARGB")) {
            util.ImageBufferAdjustment.ARGBtoRGBA(frame)
        } else if (format.includes("YUV")) {
            frame = InputImageBufferConverter.YUVtoRGBA(frame, size)
        } else if (format.includes("BGRA")) {
            util.ImageBufferAdjustment.BGRAtoRGBA(frame)
        } else if (format.includes("RGBXLE")) {
            InputImageBufferConverter.RGBXLEtoRGBA(frame)
        } else if (format.includes("RGBLE")) {
            InputImageBufferConverter.RGBLEtoRGBA(frame)
        } else if (format.includes("RGBX")) {
            InputImageBufferConverter.RGBXtoRGBA(frame)
        } else if (format.includes("RGB")) {
            InputImageBufferConverter.RGBtoRGBA(frame)
        }

        return frame
    }

    /**
     * Stop capturing from a Blackmagic device
     */
    static stopReceiver(data: any) {
        if (data?.id) {
            if (data.outputId) {
                const index = this.sendToOutputs.indexOf(data.outputId)
                if (index > -1) this.sendToOutputs.splice(index, 1)
            } else this.sendToOutputs = [] // error

            if (!this.sendToOutputs.length) {
                clearInterval(this.BMD_RECEIVERS[data.id].interval)
                try {
                    this.BMD_RECEIVERS[data.id].receiver?.stop()
                } catch (err) {
                    console.error("Error stopping Blackmagic receiver: ", err)
                }
                delete this.BMD_RECEIVERS[data.id]
            }
            return
        }

        Object.values(this.BMD_RECEIVERS).forEach(({ receiver, interval }) => {
            clearInterval(interval)
            try {
                receiver?.stop()
            } catch (err) {
                console.error("Error stopping Blackmagic receiver: ", err)
            }
        })
        this.BMD_RECEIVERS = {}
    }
}
