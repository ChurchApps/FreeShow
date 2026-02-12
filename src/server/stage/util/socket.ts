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
// let currentlyAwaiting: string[] = []
export async function awaitRequest(channel: string, data: any = null) {
    let listenerId = channel + uid(5)
    // currentlyAwaiting.push(listenerId)

    socket.emit("STAGE", { id, channel, data, listenerId })

    // LISTENER
    const waitingTimeout = 3000
    let timeout: NodeJS.Timeout | null = null
    const returnData: any = await new Promise((resolve) => {
        timeout = setTimeout(() => done(null), waitingTimeout)

        socket.on("STAGE", receiver)
        function receiver(msg: any) {
            if (!msg.listenerId || msg.listenerId !== listenerId) return

            if (timeout) clearTimeout(timeout)
            delete msg.listenerId

            done(msg.data)
        }

        function done(data: any) {
            socket.removeListener("STAGE", receiver)
            resolve(data)
        }
    })

    // let waitIndex = currentlyAwaiting.indexOf(listenerId)
    // if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)

    return returnData
}
