import { io } from "socket.io-client"
import { _get, _update } from "./stores"
import { receiver, type ReceiverKey } from "./receiver"

const socket = io()
let id: string = ""

export function initSocket() {
    socket.on("connect", () => {
        id = socket.id || ""
        console.log("Connected with id:", id)

        // try accessing with saved password
        const SAVED_PASSWORD = localStorage.password
        if (SAVED_PASSWORD) {
            _update("password", "remember", true)
            _update("password", "stored", SAVED_PASSWORD)
            send("ACCESS", SAVED_PASSWORD)
            return
        }

        // check if there is a password!
        send("PASSWORD")
    })

    socket.on("REMOTE", (msg) => {
        let key = msg.channel as ReceiverKey
        if (!receiver[key]) {
            if (msg.data !== null) console.log("Unhandled message:", msg)
            return
        }

        if (!_get("isConnected")) {
            const UNCONNECTED_ALLOWED_KEYS = ["PASSWORD", "ERROR", "ACCESS", "LANGUAGE"]
            if (!UNCONNECTED_ALLOWED_KEYS.includes(key)) return
        }

        receiver[key](msg.data)
    })
}

export const send = (channel: string, data: any = null) => socket.emit("REMOTE", { id, channel, data })
