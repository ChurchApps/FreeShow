import { OUTPUT, type ValidChannels } from "../../types/Channels"

// sees every message to the output windows first and may return one to send before it
let beforeOutputSend: ((channel: string, data: any) => { channel: string; data: any } | null) | null = null
export function setBeforeOutputSend(fn: typeof beforeOutputSend) {
    beforeOutputSend = fn
}

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => {
        if (ID === OUTPUT && beforeOutputSend) {
            const first = beforeOutputSend(channel, data)
            if (first) window.api.send(ID, first)
        }
        window.api.send(ID, { channel, data })
    })
}

export function receive(ID: ValidChannels, channels: any, id = "") {
    window.api.receive(
        ID,
        (msg: any) => {
            // linux dialog behind window message
            // if ((ID === OPEN_FOLDER || ID === OPEN_FILE) && get(activePopup) === "alert") {
            //     activePopup.set(null)
            //     alertMessage.set("")
            // }

            if (channels[msg.channel]) channels[msg.channel](msg.data)
        },
        id
    )
}

export function destroy(ID: ValidChannels, id: string) {
    window.api.removeListener(ID, id)
}
