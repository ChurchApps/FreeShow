import { NDI } from "../../types/Channels"
import type { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { NdiReceiver } from "./NdiReceiver"
import { NdiSender } from "./NdiSender"

export async function receiveNDI(e: Electron.IpcMainEvent, msg: Message) {
    let data
    if (msg.channel in ndiResponses) data = await ndiResponses[msg.channel as keyof typeof ndiResponses](msg.data)

    if (data !== undefined) e.reply(NDI, { channel: msg.channel, data: JSON.stringify(data) })
}

export const ndiResponses = {
    RECEIVE_LIST: async () => await NdiReceiver.findStreamsNDI(),
    RECEIVE_STREAM: (data: { source: { name: string; urlAddress: string; id: string } }) => NdiReceiver.receiveStreamFrameNDI(data),
    CAPTURE_STREAM: (data: { source: { name: string; urlAddress: string; id: string }; outputId: string }) => NdiReceiver.captureStreamNDI(data),
    CAPTURE_DESTROY: (data: { id: string; outputId?: string }) => NdiReceiver.stopReceiversNDI(data),

    NDI_DATA: (data: { id: string; framerate?: number; audio?: boolean }) => setDataNDI(data)

    // SEND_CREATE: (outputId: string) => createSenderNDI(outputId),
    // SEND_DESTORY: (data) => stopSenderNDI(data.outputId),
    // SEND_CAPTURE: (data) => startCapture(data.outputId),
}

export function setDataNDI(data: { id: string; framerate?: number | string; audio?: boolean }) {
    if (!data?.id) return

    if (data.framerate) {
        if (!CaptureHelper.customFramerates[data.id]) CaptureHelper.customFramerates[data.id] = {}
        CaptureHelper.customFramerates[data.id].ndi = Number(data.framerate)

        CaptureHelper.updateFramerate(data.id)
    }

    if (data.audio) NdiSender.enableAudio(data.id)
    else NdiSender.disableAudio(data.id)
}
