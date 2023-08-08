import { NDI } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { startCapture } from "./capture"
import { createSenderNDI, findStreamsNDI, receiveStreamNDI, stopReceiversNDI, stopSenderNDI } from "./ndi"

export async function receiveNDI(e: any, msg: Message) {
    let data: any = msg
    if (ndiResponses[msg.channel]) data = await ndiResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(NDI, { channel: msg.channel, data: JSON.stringify(data) })
}

export const ndiResponses: any = {
    RECEIVE_LIST: async () => await findStreamsNDI(),
    RECEIVE_STREAM: (data: any) => receiveStreamNDI(data),
    RECEIVE_DESTROY: () => stopReceiversNDI(),

    SEND_CREATE: (outputId: string) => createSenderNDI(outputId),
    SEND_DESTORY: (data: any) => stopSenderNDI(data.outputId),
    SEND_CAPTURE: (data: any) => startCapture(data.outputId),
}
