import { get } from "svelte/store"
import { CONTROLLER, REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage, Clients } from "../../types/Socket"
import { connections, currentWindow } from "../stores"
import { receiveCONTROLLER } from "./controllerTalk"
import { receiveREMOTE } from "./remoteTalk"
import { receiveSTAGE } from "./stageTalk"

export function filterObjectArray(object: any, keys: string[], filter: null | string = null) {
    return Object.entries(object)
        .map(([id, a]: any) => ({
            id,
            ...keys.reduce((o, key) => ({ ...o, [key]: a[key] }), {}),
        }))
        .filter((a: any) => (filter ? a[filter] : true))
}
export function arrayToObject(array: any[], key = "id") {
    return array.reduce((o, a) => ({ ...o, [a[key]]: a }), {})
}

// FUNCTIONS

// get data from client
export function client(id: Clients, msg: ClientMessage) {
    if (msg.channel === "CONNECTION") {
        connections.update((c: any) => {
            if (!c[id]) c[id] = {}
            c[id][msg.id!] = { entered: false, ...msg.data }
            return c
        })
        console.info("SERVER: " + msg.id + " connected")
    } else if (msg.channel === "DISCONNECT") {
        connections.update((c: any) => {
            if (c[id]) delete c[id][msg.id!]
            return c
        })
        console.info("SERVER: " + msg.id + " disconnected")
    } else sendData(id, msg)
}

// send data to client
export async function sendData(id: Clients, msg: ClientMessage, check = false) {
    if (get(currentWindow) !== null) return

    let channel = msg.channel
    if (channel.includes("API:")) {
        msg.api = channel.split(":")[1]
        channel = "API"
    }

    if (id === REMOTE) {
        if (!receiveREMOTE[channel]) return console.log("UNKNOWN CHANNEL:", channel)
        msg = await receiveREMOTE[channel](msg)
    } else if (id === STAGE) {
        if (!receiveSTAGE[channel]) return console.log("UNKNOWN CHANNEL:", channel)
        msg = receiveSTAGE[channel](msg)
    } else if (id === CONTROLLER) {
        if (!receiveCONTROLLER[channel]) return console.log("UNKNOWN CHANNEL:", channel)
        msg = receiveCONTROLLER[channel](msg)
    }

    // let ids: string[] = []
    // if (msg.id) ids = [msg.id]
    // else ids = Object.keys(get(connections).REMOTE || {})
    if (msg && msg.data !== null && (!check || !checkSent(id, msg))) {
        window.api.send(id, msg)
        // ids.forEach((id) => {
        // window.api.send(id, { id, ...msg })
        // })
    }
}

// limit data sent per second
const timeouts: any = {}
const time = 1000
export function timedout(id: Clients, msg: ClientMessage, run: Function) {
    const timeID = id + msg.id || "" + msg.channel
    if (!timeouts[timeID]) {
        timeouts[timeID] = true
        const first: string = JSON.stringify(msg.data)
        run()
        // TODO: msg does not change!!!
        setTimeout(() => {
            if (JSON.stringify(msg.data) !== first) run()
            delete timeouts[timeID]
        }, time)
    }
}

// check previous
var sent: any = { REMOTE: {}, STAGE: {} }
function checkSent(id: Clients, msg: any): boolean {
    let match = true
    if (sent[id][msg.channel] !== JSON.stringify(msg.data)) {
        sent[id][msg.channel] = JSON.stringify(msg.data)
        match = false
    }
    return match
}

// send data per connection to all
export function eachConnection(id: Clients, channel: any, callback: any) {
    Object.entries(get(connections)[id] || {}).forEach(async ([clientID, value]: any) => {
        const data = await callback(value)
        if (data) window.api.send(id, { id: clientID, channel, data })
    })
}
