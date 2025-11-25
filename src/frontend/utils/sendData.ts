import { get } from "svelte/store"
import { CONTROLLER, REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage, Clients } from "../../types/Socket"
import { API_ACTIONS } from "../components/actions/api"
import { checkWindowCapture } from "../components/helpers/output"
import { connections, shows } from "../stores"
import { isMainWindow } from "./common"
import { receiveCONTROLLER } from "./controllerTalk"
import { receiveREMOTE } from "./remoteTalk"
import { receiveSTAGE } from "./stageTalk"

export function filterObjectArray(object: any, keys: string[], filter: null | string = null) {
    return Object.entries(object)
        .map(([id, a]: any) => ({ id, ...keys.reduce((o, key) => ({ ...o, [key]: a[key] }), {}) }))
        .filter((a: any) => (filter ? a[filter] : true))
}
export function arrayToObject(array: any[], key = "id") {
    return array.reduce((o, a) => ({ ...o, [a[key]]: a }), {})
}

// FUNCTIONS

// get data from client
export function client(id: Clients, msg: ClientMessage) {
    const msgId = msg.id || ""
    if (msg.channel === "CONNECTION") {
        connections.update((c: any) => {
            if (!c[id]) c[id] = {}
            c[id][msgId] = { entered: false, ...msg.data }
            return c
        })
        console.info("SERVER: " + msgId + " connected")

        if (id === "STAGE") checkWindowCapture()
    } else if (msg.channel === "DISCONNECT") {
        connections.update((c: any) => {
            if (c[id]) delete c[id][msgId]
            return c
        })
        console.info("SERVER: " + msgId + " disconnected")
    } else sendData(id, msg)
}

export function setConnectedState(type: string, connectionId: string, key = "active", value: string | boolean) {
    connections.update((a) => {
        if (!a[type]) a[type] = {}
        if (!a[type][connectionId]) a[type][connectionId] = {}
        a[type][connectionId][key] = value
        return a
    })
}

// send data to client
export async function sendData(id: Clients, msg: ClientMessage, check = false) {
    // console.log(id, msg)
    if (!isMainWindow()) return

    let channel = msg.channel
    if (channel.includes("API:")) {
        msg.api = channel.split(":")[1]
        channel = "API"
    }

    let connectionId = msg.id
    if (!connectionId) connectionId = Object.keys(get(connections)[id] || {})[0]

    if (channel === "API") {
        if (!msg.data) msg.data = {}
        const apiId = msg.api || ""
        const data = await API_ACTIONS[apiId]?.(msg.data)

        if (apiId === "get_thumbnail") msg.data.thumbnail = data
        else msg.data = data

        if (id === "REMOTE" && apiId === "create_show") {
            // update remote shows data, so the new show is properly added
            setTimeout(() => window.api.send(id, { channel: "SHOWS", data: get(shows) }))
        }

        msg.send = true
        if (data === undefined) msg.data = null
    } else if (id === REMOTE) {
        if (!receiveREMOTE[channel]) return console.info("UNKNOWN CHANNEL:", channel)
        msg = await receiveREMOTE[channel](msg)
    } else if (id === STAGE) {
        if (!receiveSTAGE[channel]) return console.info("UNKNOWN CHANNEL:", channel)
        msg.data = receiveSTAGE[channel](msg.data, connectionId)

        if (msg.data === undefined) msg.data = null
        if (msg.data?.channel === "ERROR") msg = { ...msg, channel: "ERROR", data: msg.data?.data }
    } else if (id === CONTROLLER) {
        if (!receiveCONTROLLER[channel]) return console.info("UNKNOWN CHANNEL:", channel)
        msg = receiveCONTROLLER[channel](msg)
    }

    // let ids: string[] = []
    // if (msg.id) ids = [msg.id]
    // else ids = Object.keys(get(connections).REMOTE || {})
    if (msg && (msg.data !== null || msg.send) && (!check || !checkSent(id, msg))) {
        window.api.send(id, msg)
        // ids.forEach((id) => {
        // window.api.send(id, { id, ...msg })
        // })
    }
}

// limit data sent per second
const timeouts: any = {}
const time = 1000
export function timedout(id: Clients, msg: ClientMessage, run: () => void) {
    const timeID = id + (msg.id || "") + msg.channel
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
const sent: any = { REMOTE: {}, STAGE: {} }
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
