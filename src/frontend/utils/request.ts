import { get } from "svelte/store"
import { uid } from "uid"
import { OPEN_FILE, OPEN_FOLDER, type ValidChannels } from "../../types/Channels"
import { activePopup, alertMessage } from "../stores"

export function send(ID: ValidChannels, channels: string[], data: any = null) {
    channels.forEach((channel: string) => window.api.send(ID, { channel, data }))
}

export function receive(ID: ValidChannels, channels: any, id = "") {
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

const currentlyAwaiting: string[] = []
export async function awaitRequest(ID: ValidChannels, channel: string, data: any = null) {
    let listenerId = ID + "_" + channel
    listenerId += uid(5)
    currentlyAwaiting.push(listenerId)

    send(ID, [channel], { ...data, listenerId })

    // LISTENER
    const waitingTimeout = 8000
    let timeout: any = null
    const returnData: any = await new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), waitingTimeout)

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

    const waitIndex = currentlyAwaiting.indexOf(listenerId)
    if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)
    destroy(ID, listenerId)

    return returnData
}

export function destroy(ID: ValidChannels, id: string) {
    window.api.removeListener(ID, id)
}
