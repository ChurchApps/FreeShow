import type { ValidChannels } from "../../types/Channels"

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => window.api.send(ID, { channel, data }))
}

export function receive(ID: ValidChannels, channels: any, id: string = "") {
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
