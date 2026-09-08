import { OMT } from "../../types/Channels"
import type { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { OmtReceiver } from "./OmtReceiver"
import { OmtSender } from "./OmtSender"

export async function receiveOMT(e: Electron.IpcMainEvent, msg: Message) {
    let data
    if (msg.channel in omtResponses) data = await omtResponses[msg.channel as keyof typeof omtResponses](msg.data)

    if (data !== undefined) e.reply(OMT, { channel: msg.channel, data: JSON.stringify(data) })
}

export const omtResponses = {
    RECEIVE_LIST: async () => await OmtReceiver.findStreamsOMT(),
    RECEIVE_STREAM: (data: { source: { name: string; urlAddress?: string; id: string } }) => OmtReceiver.receiveStreamFrameOMT(data),
    CAPTURE_STREAM: (data: { source: { name: string; urlAddress?: string; id: string }; outputId: string }) => OmtReceiver.captureStreamOMT(data),
    CAPTURE_DESTROY: (data: { id: string; outputId?: string }) => OmtReceiver.stopReceiversOMT(data),

    OMT_DATA: (data: { id: string; framerate?: number; name?: string; quality?: number | string }) => setDataOMT(data)
}

export function setDataOMT(data: { id: string; framerate?: number | string; name?: string; quality?: number | string }) {
    if (!data?.id) return

    if (data.framerate) {
        if (!CaptureHelper.customFramerates[data.id]) CaptureHelper.customFramerates[data.id] = {}
        CaptureHelper.customFramerates[data.id].omt = Number(data.framerate)

        CaptureHelper.updateFramerate(data.id)
    }

    // name and quality are fixed at sender creation, so apply a change by recreating it; receivers reconnect on their own
    const current = OmtSender.OMT[data.id]
    if (!current?.sender) return

    const name = data.name || current.name
    const quality = data.quality ?? current.quality
    if (name === current.name && String(quality ?? "") === String(current.quality ?? "")) return

    void OmtSender.createSenderOMT(data.id, name, quality)
}
