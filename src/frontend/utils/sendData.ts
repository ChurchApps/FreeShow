import { get } from "svelte/store"
import { CONTROLLER, REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage, Clients } from "../../types/Socket"
import { getResolution } from "../components/helpers/output"
import { clearAll, nextSlide, previousSlide } from "../components/helpers/showActions"
import { connections } from "../stores"
import { draw, drawSettings, drawTool } from "./../stores"
import { receiveREMOTE } from "./remoteTalk"
import { receiveSTAGE } from "./stageTalk"

const receiveCONTROLLER = {
    ACTION: ({ data }) => {
        const actions = {
            next: () => nextSlide({ key: "ArrowRight" }),
            previous: () => previousSlide({ key: "ArrowLeft" }),
            clear: () => clearAll(),
        }
        if (actions[data.id]) actions[data.id]()
    },
    FOCUS: ({ data }) => {
        if (!data.offset) {
            console.log(data)
            draw.set(null)
            return
        }
        let resolution = getResolution()
        data.offset.x *= resolution.width
        data.offset.y *= resolution.height
        let tool = data.tool || "focus"
        let settings = get(drawSettings)[tool]
        if (settings) {
            data.offset.x -= settings.size / 2
            data.offset.y -= settings.size / 2
        }
        draw.set(data.offset)
        drawTool.set(tool)
    },
}

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
export function client(id: Clients, msg: ClientMessage) {
    if (msg.channel === "CONNECTION") {
        connections.update((c: any) => {
            if (!c[id]) c[id] = {}
            c[id][msg.id!] = { entered: false, ...msg.data }
            return c
        })
        console.log(msg.id + " connected")
    } else if (msg.channel === "DISCONNECT") {
        connections.update((c: any) => {
            if (c[id]) delete c[id][msg.id!]
            return c
        })
        console.log(msg.id + " disconnected")
    } else sendData(id, msg)
}

// send data to client
export async function sendData(id: Clients, msg: ClientMessage, check: boolean = false) {
    if (id === REMOTE) {
        if (!receiveREMOTE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
        msg = await receiveREMOTE[msg.channel](msg)
    } else if (id === STAGE) {
        if (!receiveSTAGE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
        msg = receiveSTAGE[msg.channel](msg)
    } else if (id === CONTROLLER) {
        if (!receiveCONTROLLER[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
        msg = receiveCONTROLLER[msg.channel](msg)
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
let timeouts: any = {}
let time: number = 1000
export function timedout(id: Clients, msg: ClientMessage, run: Function) {
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
function checkSent(id: Clients, msg: any): boolean {
    let match: boolean = true
    if (sent[id][msg.channel] !== JSON.stringify(msg.data)) {
        sent[id][msg.channel] = JSON.stringify(msg.data)
        match = false
    }
    return match
}

// send data per connection to all
export function eachConnection(id: Clients, channel: any, callback: any) {
    Object.entries(get(connections)[id] || {}).forEach(([clientID, value]: any) => {
        let data = callback(value)
        if (data) window.api.send(id, { id: clientID, channel, data })
    })
}
