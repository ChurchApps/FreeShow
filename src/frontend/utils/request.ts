import { get } from "svelte/store"
import { OPEN_FILE, OPEN_FOLDER, type ValidChannels } from "../../types/Channels"
import { activePopup, alertMessage } from "../stores"

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => window.api.send(ID, { channel, data }))
}

export function receive(ID: ValidChannels, channels: any, id: string = "") {
    window.api.receive(
        ID,
        (msg: any) => {
            // linux dialog behind window message
            if ((ID === OPEN_FOLDER || ID === OPEN_FILE) && get(activePopup) === "alert") {
                activePopup.set(null)
                alertMessage.set("")
            }

            if (channels[msg.channel]) channels[msg.channel](msg.data)
        },
        id
    )
}

let currentlyAwaiting: string[] = []
export async function awaitRequest(ID: ValidChannels, channel: string, data: any = null) {
    let listenerId = ID + "_" + channel
    if (channel === "GET_SYSTEM_FONTS" && currentlyAwaiting.includes(listenerId)) return
    currentlyAwaiting.push(listenerId)

    send(ID, [channel], { ...data, listenerId })

    // LISTENER
    const waitingTimeout = 8000
    let timeout: any = null
    const returnData: any = await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject("error"), waitingTimeout)

        receive(
            ID,
            {
                [channel]: (data) => {
                    if (!data.listenerId || data.listenerId !== listenerId) return

                    clearTimeout(timeout)
                    delete data.listenerId
                    resolve(data)
                },
            },
            listenerId
        )
    })

    currentlyAwaiting.splice(currentlyAwaiting.indexOf(listenerId), 1)
    destroy(ID, listenerId)

    if (returnData === "error") return null
    return returnData
}

export function destroy(ID: ValidChannels, id: string) {
    window.api.removeListener(ID, id)
}
