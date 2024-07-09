import { BrowserWindow } from "electron"
import { OutputBounds } from "./OutputBounds"
import { OutputIdentify } from "./OutputIdentify"
import { OutputSend } from "./OutputSend"
import { OutputValues } from "./OutputValues"
import { OutputVisibility } from "./OutputVisibility"
import { OutputLifecycle } from "./OutputLifecycle"
import { Message } from "../../../types/Socket"
import { toApp } from "../.."
import { CaptureTransmitter } from "../CaptureTransmitter"
import { updatePreviewResolution } from "../capture"
import { OUTPUT } from "../../../types/Channels"

export class OutputHelper {
    static receiveOutput(_e: any, msg: Message) {
        const outputResponses: any = {
            CREATE: (data: any) => OutputHelper.Lifecycle.createOutput(data),
            REMOVE: (data: any) => OutputHelper.Lifecycle.removeOutput(data.id),
            DISPLAY: (data: any) => OutputHelper.Visibility.displayOutput(data),
            ALIGN_WITH_SCREEN: () => OutputHelper.Bounds.alignWithScreens(),

            MOVE: (data: any) => (OutputHelper.Bounds.moveEnabled = data.enabled),

            UPDATE_BOUNDS: (data: any) => OutputHelper.Bounds.updateBounds(data),
            SET_VALUE: (data: any) => OutputHelper.Values.updateValue(data),
            TO_FRONT: (data: any) => OutputHelper.Bounds.moveToFront(data),

            PREVIEW_RESOLUTION: (data: any) => updatePreviewResolution(data),
            REQUEST_PREVIEW: (data: any) => CaptureTransmitter.requestPreview(data),

            IDENTIFY_SCREENS: (data: any) => OutputHelper.Identify.identifyScreens(data),
        }

        if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
        if (outputResponses[msg.channel]) return outputResponses[msg.channel](msg.data)

        OutputHelper.Send.sendToOutputWindow(msg)
    }

    static outputWindows: { [key: string]: BrowserWindow } = {}

    static Bounds = OutputBounds
    static Identify = OutputIdentify
    static Lifecycle = OutputLifecycle
    static Send = OutputSend
    static Values = OutputValues
    static Visibility = OutputVisibility
}
