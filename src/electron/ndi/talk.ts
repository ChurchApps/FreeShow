import { NDI } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { customFramerates, updateFramerate } from "../output/capture"
import { captureStreamNDI, findStreamsNDI, receiveStreamFrameNDI, stopReceiversNDI } from "./ndi"

export async function receiveNDI(e: any, msg: Message) {
    let data: any = {}
    if (ndiResponses[msg.channel]) data = await ndiResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(NDI, { channel: msg.channel, data: JSON.stringify(data) })
}

export const ndiResponses: any = {
    RECEIVE_LIST: async () => await findStreamsNDI(),
    RECEIVE_STREAM: (data: any) => receiveStreamFrameNDI(data),
    CAPTURE_STREAM: (data: any) => captureStreamNDI(data),
    CAPTURE_DESTROY: (data: any) => stopReceiversNDI(data),

    NDI_DATA: (data: any) => setDataNDI(data),

    // SEND_CREATE: (outputId: string) => createSenderNDI(outputId),
    // SEND_DESTORY: (data: any) => stopSenderNDI(data.outputId),
    // SEND_CAPTURE: (data: any) => startCapture(data.outputId),
}

export function setDataNDI(data: any) {
    if (!data?.id) return

    if (data.framerate) {
        if (!customFramerates[data.id]) customFramerates[data.id] = {}
        customFramerates[data.id].ndi = data.framerate

        updateFramerate(data.id)
    }
}
