import { get } from "svelte/store"
import { REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { connections } from "../stores"
import { receiveREMOTE } from "./remoteTalk"
import { receiveSTAGE } from "./stageTalk"

export function filterObjectArray(object: any, keys: string[], filter: null | string = null) {
    return Object.entries(object)
        .map(([id, a]: any) => ({ id, ...keys.reduce((o, key) => ({ ...o, [key]: a[key] }), {}) }))
        .filter((a: any) => (filter ? a[filter] : true))
}
export function arrayToObject(array: any[], key: string = "id") {
    return array.reduce((o, a) => ({ ...o, [a[key]]: a }), {})
}

// FUNCTIONS

// get data from client
export function client(id: "REMOTE" | "STAGE", msg: ClientMessage) {
    if (msg.channel === "CONNECTION") {
        connections.update((c: any) => {
            c[id][msg.id!] = { entered: false, ...msg.data }
            return c
        })
        console.log(msg.id + " connected")
    } else if (msg.channel === "DISCONNECT") {
        connections.update((c: any) => {
            delete c[id][msg.id!]
            return c
        })
        console.log(msg.id + " disconnected")
    } else sendData(id, msg)
}

// send data to client
export async function sendData(id: "REMOTE" | "STAGE", msg: ClientMessage, check: boolean = false) {
    if (id === REMOTE) {
        if (!receiveREMOTE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
        msg = await receiveREMOTE[msg.channel](msg)
    } else if (id === STAGE) {
        if (!receiveSTAGE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
        msg = receiveSTAGE[msg.channel](msg)
    }

    // let ids: string[] = []
    // if (msg.id) ids = [msg.id]
    // else ids = Object.keys(get(connections).REMOTE)
    if (msg && msg.data !== null && (!check || !checkSent(id, msg))) {
        window.api.send(id, msg)
        // ids.forEach((id) => {
        // window.api.send(id, { id, ...msg })
        // })
    }
}

// limit data sent per second
let timeouts: any = {}
let time: number = 1000
export function timedout(id: "REMOTE" | "STAGE", msg: ClientMessage, run: Function) {
    let timeID = id + msg.id || "" + msg.channel
    if (!timeouts[timeID]) {
        timeouts[timeID] = true
        let first: string = JSON.stringify(msg.data)
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
function checkSent(id: "REMOTE" | "STAGE", msg: any): boolean {
    let match: boolean = true
    if (sent[id][msg.channel] !== JSON.stringify(msg.data)) {
        sent[id][msg.channel] = JSON.stringify(msg.data)
        match = false
    }
    return match
}

// send data per connection to all
export function eachConnection(id: "REMOTE" | "STAGE", channel: any, callback: any) {
    Object.entries(get(connections)[id]).forEach(([clientID, value]: any) => {
        let data = callback(value)
        if (data) window.api.send(id, { id: clientID, channel, data })
    })
}
