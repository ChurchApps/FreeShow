import { BrowserWindow } from "electron"
import { BLACKMAGIC } from "../../types/Channels"
import { Output } from "../../types/Output"
import { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { CaptureTransmitter } from "../capture/helpers/CaptureTransmitter"
import { OutputBounds } from "../output/helpers/OutputBounds"
import { OutputValues } from "../output/helpers/OutputValues"
import { OutputHelper } from "../output/OutputHelper"
import { wait } from "../utils/helpers"
import { BlackmagicManager } from "./BlackmagicManager"
import { BlackmagicReceiver } from "./BlackmagicReceiver"
import { BlackmagicSender } from "./BlackmagicSender"

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
    let bmdData = data.blackmagicData || {}

    // Get target resolution from display mode
    const displayMode = bmdData.displayMode || "1080p30"
    let blackmagicWidth = 1920
    let blackmagicHeight = 1080

    if (displayMode.includes("1080")) {
        blackmagicWidth = 1920
        blackmagicHeight = 1080
    } else if (displayMode.includes("720")) {
        blackmagicWidth = 1280
        blackmagicHeight = 720
    } else if (displayMode.includes("2k")) {
        blackmagicWidth = 2048
        blackmagicHeight = 1080
    } else if (displayMode.includes("4K") || displayMode.includes("4k")) {
        blackmagicWidth = 3840
        blackmagicHeight = 2160
    } else if (displayMode.includes("525i") || displayMode.includes("NTSC")) {
        blackmagicWidth = 720
        blackmagicHeight = 486
    } else if (displayMode.includes("625i") || displayMode.includes("PAL")) {
        blackmagicWidth = 720
        blackmagicHeight = 576
    }

    const windowBounds = window.getBounds()
    const adjustedBounds = {
        x: windowBounds.x,
        y: windowBounds.y,
        width: blackmagicWidth,
        height: blackmagicHeight
    }

    OutputBounds.updateBounds({ id, bounds: adjustedBounds })

    // Wait for window to resize
    await wait(100)

    let deviceId = bmdData.deviceId
    let deviceIndex = BlackmagicManager.getIndexById(deviceId)
    if (deviceIndex < 0) return

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

    OutputValues.updateValue({ key: "capture", value: { key: "blackmagic", value: !!data.blackmagic }, id })

    // Force next frame to be sent with new resolution
    // Use a small delay to ensure sender is fully initialized with new display mode
    if (data.blackmagic) {
        setTimeout(() => {
            CaptureTransmitter.forceNextBlackmagicSend(id)
        }, 150)
    }
}
