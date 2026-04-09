import { io } from "socket.io-client"
import { uid } from "uid"
import { receiver, type ReceiverKey } from "./receiver"

const socket = io()
let id: string = ""

export function initSocket() {
    socket.on("connect", () => {
        id = socket.id || ""
        console.log("Connected with id:", id)
        send("LAYOUTS")
    })

    socket.on("STAGE", (msg) => {
        let key = msg.channel as ReceiverKey
        if (!receiver[key]) {
            if (!requestChannels.find((a) => msg.channel.includes(a))) console.log("Unhandled message:", msg)
            return
        }

        receiver[key](msg.data)
    })
}

export const send = (channel: string, data: any = null) => socket.emit("STAGE", { id, channel, data })

const requestChannels = ["get_dynamic_value"]

const pendingRequests = new Map<string, { resolve: (value: any) => void; timeout: NodeJS.Timeout }>()

let requestListenerInitialized = false
function initRequestListener() {
    if (requestListenerInitialized) return
    requestListenerInitialized = true

    socket.on("STAGE", (msg: any) => {
        if (!msg.listenerId) return
        const pending = pendingRequests.get(msg.listenerId)
        if (!pending) return

        clearTimeout(pending.timeout)
        pendingRequests.delete(msg.listenerId)
        pending.resolve(msg.data)
    })
}

export async function awaitRequest(channel: string, data: any = null) {
    initRequestListener()

    const listenerId = channel + uid(5)
    socket.emit("STAGE", { id, channel, data, listenerId })

    const waitingTimeout = 3000
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(listenerId)
            resolve(null)
        }, waitingTimeout)

        pendingRequests.set(listenerId, { resolve, timeout })
    })
}
