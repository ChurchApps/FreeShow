import { NDI } from "../../types/Channels"
import type { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { NdiReceiver } from "./NdiReceiver"

export async function receiveNDI(e: any, msg: Message) {
    let data: any = {}
    if (ndiResponses[msg.channel]) data = await ndiResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(NDI, { channel: msg.channel, data: JSON.stringify(data) })
}

export const ndiResponses: any = {
    RECEIVE_LIST: async () => await NdiReceiver.findStreamsNDI(),
    RECEIVE_STREAM: (data: any) => NdiReceiver.receiveStreamFrameNDI(data),
    CAPTURE_STREAM: (data: any) => NdiReceiver.captureStreamNDI(data),
    CAPTURE_DESTROY: (data: any) => NdiReceiver.stopReceiversNDI(data),

    NDI_DATA: (data: any) => setDataNDI(data),

    // SEND_CREATE: (outputId: string) => createSenderNDI(outputId),
    // SEND_DESTORY: (data: any) => stopSenderNDI(data.outputId),
    // SEND_CAPTURE: (data: any) => startCapture(data.outputId),
}

export function setDataNDI(data: any) {
    if (!data?.id) return

    if (data.framerate) {
        if (!CaptureHelper.customFramerates[data.id]) CaptureHelper.customFramerates[data.id] = {}
        CaptureHelper.customFramerates[data.id].ndi = data.framerate

        CaptureHelper.updateFramerate(data.id)
    }
}
