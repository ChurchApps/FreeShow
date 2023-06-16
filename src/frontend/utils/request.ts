import { get } from "svelte/store"
import { OPEN_FILE, OPEN_FOLDER, type ValidChannels } from "../../types/Channels"
import { activePopup, alertMessage } from "../stores"

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => window.api.send(ID, { channel, data }))
}

export function receive(ID: ValidChannels, channels: any) {
    window.api.receive(ID, (msg: any) => {
        // linux dialog behind window message
        if ((ID === OPEN_FOLDER || ID === OPEN_FILE) && get(activePopup) === "alert") {
            activePopup.set(null)
            alertMessage.set("")
        }

        if (channels[msg.channel]) channels[msg.channel](msg.data)
    })
}
