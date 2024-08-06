import macadam from "macadam"
import { CaptureChannel, CaptureFrame } from "macadam"
import { BlackmagicManager } from "./BlackmagicManager"
import { BLACKMAGIC } from "../../types/Channels"
import { toApp } from ".."
import { OutputHelper } from "../output/OutputHelper"
import util from "../ndi/vingester-util"

export class BlackmagicReceiver {
    static BMD_RECEIVERS: { [key: string]: { receiver?: CaptureChannel; interval?: any } } = {}
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
        let displayMode = BlackmagicManager.getDisplayMode(device.inputDisplayModes[0].videoModes[0]) // selecting first
        let pixelFormat = macadam.bmdFormat8BitBGRA

        if (!this.BMD_RECEIVERS[deviceId]) this.BMD_RECEIVERS[deviceId] = {}
        return (this.BMD_RECEIVERS[deviceId].receiver = await macadam.capture({
            deviceIndex,
            displayMode,
            pixelFormat,
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
                this.sendFrame(source.id, frame)
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
            this.sendFrame(source.id, frame)
        } catch (err) {
            console.error(err)
            this.stopReceiver({ id: source.id })
        }
    }

    static sendFrame(id: string, frame: CaptureFrame) {
        if (!frame) return

        /*  convert from BGRA (Current mode: bmdFormat8BitBGRA) to RGBA (Web canvas)  */
        util.ImageBufferAdjustment.BGRAtoRGBA(frame.video.data)

        let msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(BLACKMAGIC, msg)

        this.sendToOutputs.forEach((outputId) => {
            OutputHelper.Send.sendToWindow(outputId, msg, BLACKMAGIC)
        })
    }

    static stopReceiver(data: any) {
        if (data?.id) {
            if (data.outputId) this.sendToOutputs.splice(this.sendToOutputs.indexOf(data.outputId), 1)
            else this.sendToOutputs = [] // error

            if (!this.sendToOutputs.length) {
                clearInterval(this.BMD_RECEIVERS[data.id].interval)
                this.BMD_RECEIVERS[data.id].receiver?.stop()
                delete this.BMD_RECEIVERS[data.id]
            }
            return
        }

        Object.values(this.BMD_RECEIVERS).forEach(({ receiver, interval }) => {
            clearInterval(interval)
            receiver?.stop()
        })
        this.BMD_RECEIVERS = {}
    }
}
