import { BrowserWindow } from "electron"
import { BLACKMAGIC } from "../../types/Channels"
import { Output } from "../../types/Output"
import { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { OutputBounds } from "../output/helpers/OutputBounds"
import { OutputValues } from "../output/helpers/OutputValues"
import { OutputHelper } from "../output/OutputHelper"
import { BlackmagicManager } from "./BlackmagicManager"
import { BlackmagicSender } from "./BlackmagicSender"
import { BlackmagicReceiver } from "./BlackmagicReceiver"

export async function receiveBM(e: any, msg: Message) {
    let data: any = {}
    if (bmResponses[msg.channel]) data = await bmResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(BLACKMAGIC, { channel: msg.channel, data: JSON.stringify(data) })
}

// let activeCapture: BlackmagicSender
export const bmResponses: any = {
    GET_DEVICES: () => BlackmagicManager.getDevices(),

    STOP_SENDER: (data: any) => BlackmagicSender.stop(data.id),

    RECEIVE_FRAME: (data: any) => BlackmagicReceiver.captureFrame(data),
    RECEIVE_STREAM: (data: any) => BlackmagicReceiver.startCapture(data),
    STOP_RECEIVER: (data: any) => BlackmagicReceiver.stopReceiver(data),
    RESET_DEVICE: (data: any) => BlackmagicManager.resetDevice(data.deviceId)
}

export async function initializeSender(data: Output, window: BrowserWindow, id: string) {
    if (!data.forcedResolution?.width) return // could not get proper size

    // set blackmagic device resolution
    let windowBounds = { ...window.getBounds(), ...data.forcedResolution }
    OutputBounds.updateBounds({ id, bounds: windowBounds })

    let bmdData = data.blackmagicData || {}
    let deviceId = bmdData.deviceId
    let deviceIndex = BlackmagicManager.getIndexById(deviceId)
    if (deviceIndex < 0) return

    // console.log(bmdData, deviceIndex)
    if (data.blackmagic) await BlackmagicSender.initialize(id, deviceIndex, bmdData.displayMode, bmdData.pixelFormat, bmdData.alphaKey)
    else BlackmagicSender.stop(id)

    // get & set custom frame rate
    const output = OutputHelper.getOutput(id)
    if (!output.captureOptions) output.captureOptions = CaptureHelper.getDefaultCapture(window, id)
    if (!bmdData.framerate[1] || !bmdData.framerate[0]) return
    let bmdFramerate = bmdData.framerate[1] / bmdData.framerate[0] // [ 1001, 30000 ]
    if (bmdFramerate < 10) return
    output.captureOptions.framerates.blackmagic = bmdFramerate
    OutputHelper.setOutput(id, output)

    OutputValues.updateValue({ key: "capture", value: { key: "blackmagic", value: data.blackmagic }, id })
}
