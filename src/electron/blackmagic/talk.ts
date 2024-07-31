import { BLACKMAGIC } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { BlackmagicCapture } from "./BlackmagicCapture"
import { BlackmagicManager } from "./BlackmagicManager"

export async function receiveBM(e: any, msg: Message) {
    let data: any = {}
    if (bmResponses[msg.channel]) data = await bmResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(BLACKMAGIC, { channel: msg.channel, data: JSON.stringify(data) })
}

// WIP for SENDING frames the output window should be transparent!!

let activeCapture: BlackmagicCapture
export const bmResponses: any = {
    GET_DEVICES: () => BlackmagicManager.getDevices(),

    START_CAPTURE: () => {
        if (activeCapture instanceof BlackmagicCapture) activeCapture.stopCapture()

        activeCapture = new BlackmagicCapture(0)
        activeCapture.captureFrame()
    },
    STOP_CAPTURE: () => {
        if (activeCapture instanceof BlackmagicCapture) activeCapture.stopCapture()
    },
}
