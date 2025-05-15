import macadam, { CaptureChannel, CaptureFrame } from "macadam"
import { toApp } from ".."
import { BLACKMAGIC } from "../../types/Channels"
import util from "../ndi/vingester-util"
import { OutputHelper } from "../output/OutputHelper"
import { BlackmagicManager } from "./BlackmagicManager"
import { InputImageBufferConverter } from "./ImageBufferConverter"
import { Size } from "electron"

export class BlackmagicReceiver {
    static BMD_RECEIVERS: { [key: string]: { receiver?: CaptureChannel; interval?: any; displayMode: string; pixelFormat: string } } = {}
    static allActiveReceivers: any = {}
    static sendToOutputs: string[] = []

    // set audioChannels to 0 to disable audio
    static async initialize(deviceId: string, audioChannels: number = 2) {
        if (this.BMD_RECEIVERS[deviceId]?.receiver) return this.BMD_RECEIVERS[deviceId].receiver

        let deviceIndex = BlackmagicManager.getIndexById(deviceId)
        if (deviceIndex < 0) return

        let device = BlackmagicManager.getDeviceById(deviceId)
        if (!device) return

        // WIP change mode
        let displayMode = device.inputDisplayModes[0].name // selecting first
        let pixelFormat = device.inputDisplayModes[0].videoModes[0] // selecting first
        // let pixelFormat = macadam.bmdFormat8BitBGRA

        if (!this.BMD_RECEIVERS[deviceId]) this.BMD_RECEIVERS[deviceId] = { displayMode, pixelFormat }
        return (this.BMD_RECEIVERS[deviceId].receiver = await macadam.capture({
            deviceIndex,
            displayMode: BlackmagicManager.getDisplayMode(displayMode),
            pixelFormat: BlackmagicManager.getPixelFormat(pixelFormat),
            channels: audioChannels,
            sampleRate: macadam.bmdAudioSampleRate48kHz,
            sampleType: macadam.bmdAudioSampleType16bitInteger,
        }))
    }

    static async startCapture({ source, outputId }: any) {
        if (!this.sendToOutputs.includes(outputId)) this.sendToOutputs.push(outputId)

        let deviceId: string = source.id
        if (this.BMD_RECEIVERS[deviceId]?.interval) return

        let receiver = await this.initialize(deviceId)
        if (!receiver) return

        let frameRate = (receiver.frameRate[1] || 30000) / (receiver.frameRate[0] || 1001)

        let gettingFrame: boolean = false
        this.BMD_RECEIVERS[deviceId].interval = setInterval(async () => {
            if (gettingFrame) return
            gettingFrame = true

            try {
                if (!receiver) return this.stopReceiver({ id: source.id, outputId })
                let frame = await receiver.frame()
                this.sendFrame(source.id, frame, { width: receiver.width, height: receiver.height })
            } catch (err) {
                console.error(err)
                this.stopReceiver({ id: source.id, outputId })
            }

            gettingFrame = false
        }, Math.round(1000 / frameRate))
    }

    static async captureFrame({ source }: any) {
        let deviceId: string = source.id
        let receiver = await this.initialize(deviceId)
        if (!receiver) return

        try {
            let frame = await receiver.frame()
            this.sendFrame(source.id, frame, { width: receiver.width, height: receiver.height })
        } catch (err) {
            console.error(err)
            this.stopReceiver({ id: source.id })
        }
    }

    static lastFrameTime: number = 0
    static sendFrame(id: string, frame: CaptureFrame, size: Size) {
        if (!frame) return

        // lagging if less than 10 fps
        let timeSinceLastFrame = Date.now() - this.lastFrameTime
        if (timeSinceLastFrame > 100 && timeSinceLastFrame < 200) return // skip frames if overloaded

        // mode
        // let displayMode = this.BMD_RECEIVERS[id].displayMode
        let pixelFormat = this.BMD_RECEIVERS[id].pixelFormat

        frame.video.data = this.convertVideoFrameFormat(frame.video.data, pixelFormat, size)

        let msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(BLACKMAGIC, msg)

        this.sendToOutputs.forEach((outputId) => {
            OutputHelper.Send.sendToWindow(outputId, msg, BLACKMAGIC)
        })

        this.lastFrameTime = Date.now()
    }

    static convertVideoFrameFormat(frame: Buffer, format: string, size: Size) {
        // bmdPixelFormats: YUV, ARGB, BGRA, RGB, RGBLE, RGBXLE, RGBX

        /*  convert from current input pixel format to RGBA (Web canvas)  */

        // WIP 10/12 bit

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

    static stopReceiver(data: any) {
    if (data?.id) {
        try {
            if (data.outputId) {
                const index = this.sendToOutputs.indexOf(data.outputId);
                if (index >= 0) {
                    this.sendToOutputs.splice(index, 1);
                }
            } else {
                this.sendToOutputs = []; // error
            }

            if (!this.sendToOutputs.length) {
                try {
                    clearInterval(this.BMD_RECEIVERS[data.id].interval);
                    const receiver = this.BMD_RECEIVERS[data.id].receiver;
                    if (receiver) {
                        receiver.stop();
                    }
                } catch (err) {
                    console.error(`Error stopping receiver: ${err.message}`);
                }
                delete this.BMD_RECEIVERS[data.id];
            }
        } catch (err) {
            console.error(`Error in stopReceiver for ID ${data.id}: ${err.message}`);
        }
        return;
    }

    // Stop all receivers
    try {
        Object.entries(this.BMD_RECEIVERS).forEach(([id, { receiver, interval }]) => {
            try {
                clearInterval(interval);
                if (receiver) {
                    receiver.stop();
                }
            } catch (err) {
                console.error(`Error stopping receiver ${id}: ${err.message}`);
            }
        });
        this.BMD_RECEIVERS = {};
    } catch (err) {
        console.error(`Error stopping all receivers: ${err.message}`);
    }
}
}
