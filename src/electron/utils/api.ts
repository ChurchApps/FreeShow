import { ipcMain } from "electron"
import express from "express"
import http from "http"
import OSC from "osc-js"
import { Server, type Socket } from "socket.io"
import { uid } from "uid"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { waitUntilValueIsDefined } from "./helpers"

const app = express()
let servers: { [key: string]: http.Server | OSC } = {}
const DEFAULT_PORTS = { WebSocket: 5505, REST: 5506 }

// WebSocket on 5506, REST on +1 (5506), but works with 5505 as well!
export function startWebSocketAndRest(port: number | undefined) {
    startRestListener(port ? port + 1 : 0)
    startWebSocket(port)
    startOSC(port)
}

// WEBSOCKET

export function startWebSocket(PORT: number | undefined) {
    let server = (servers.WebSocket = http.createServer(app))

    if (!PORT) PORT = DEFAULT_PORTS.WebSocket
    server.listen(PORT, () => {
        console.log(`WebSocket: Starting server at port ${PORT}`)
    })

    server.once("error", (err) => {
        if ((err as any).code === "EADDRINUSE") server.close()
    })

    const io = new Server(server)
    io.on("connection", connected)
}

function connected(socket: Socket) {
    log("Client connected.")
    sendToMain(ToMain.API, "connected") // TODO: respond with API_DATA

    socket.on("disconnect", () => log("Client disconnected."))

    socket.on("data", async (data: any) => {
        let parsedData
        try {
            parsedData = JSON.parse(data || "{}")
        } catch (err) {
            console.log("Could not parse socket data.")
            return
        }

        const returnData = await receivedData(parsedData, log)
        if (!returnData) return

        socket.emit("data", returnData)
    })

    ipcMain.on("API_DATA", (_e, msg) => {
        socket.emit("data", msg)
    })

    function log(msg: string, isError: boolean = false) {
        console.log(`WebSocket: ${msg}`)
        if (isError) socket.emit("error", msg)
    }
}

// REST

export function startRestListener(PORT: number | undefined) {
    if (!PORT) PORT = DEFAULT_PORTS.REST
    let server = (servers.REST = app.listen(PORT, () => {
        console.log(`REST: Listening for data at port ${PORT}`)
    }))

    server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") server.close()
    })

    app.use(express.json())
    // app.use(cors()) // if a browser should send body data (https://stackoverflow.com/a/63547498/10803046)
    app.post("/", async (req, res) => {
        // {action: ACTION_ID, ...{}}
        let data = req.body
        // ?action=ACTION_ID&data={}
        if (!data.action && req.query.action) data = { action: req.query.action, ...JSON.parse((req.query.data || "{}") as string) }

        const returnData = await receivedData(data, (msg: string) => console.log(`REST: ${msg}`))
        // WIP send error if action does not exist
        if (!returnData) {
            res.status(204).send()
            return
        }

        res.json(returnData)
    })
}

// Open Sound Control

function startOSC(PORT: number | undefined) {
    if (!PORT) PORT = DEFAULT_PORTS.WebSocket

    // const osc = new OSC({ plugin: new OSC.WebsocketServerPlugin() }) // ws://ip:port
    const osc = (servers.OSC = new OSC({ plugin: new OSC.DatagramPlugin() })) // UDP

    osc.on("/freeshow/*", async (msg: any) => {
        // const active = msg.args[1] || 0
        let args: any = {}
        try {
            args = JSON.parse(msg.args[0] || "{}")
        } catch (err) {
            console.log("OSC: Could not parse JSON!\n", err)
        }

        const action = msg.address.replace("/freeshow", "")
        const returnData = await receivedData({ action, ...args }, (msg: string) => console.log(`OSC: ${msg}`))
        if (!returnData) return

        var message = new OSC.Message(msg.address, returnData)
        osc.send(message)
    })

    osc.on("open", () => {
        console.log(`OSC: Listening for data at port ${PORT}`)
    })
    osc.on("error", (err: any) => {
        console.log(`OSC: Error. ${JSON.stringify(err)}`)
    })

    osc.open({ port: PORT, host: "0.0.0.0" })
}

// let OSC_SENDER: null | OSC = null // must work with different ip:port
export function emitOSC(msg: any) {
    if (typeof msg.data !== "string") return

    const port = msg.signal?.port || 8080
    const host = msg.signal?.host || "0.0.0.0"

    // @ts-ignore
    const OSC_SENDER = new OSC({ plugin: new OSC.DatagramPlugin({ send: { host, port } }) })

    OSC_SENDER.on("open", sendMessage)
    OSC_SENDER.open()

    // const IS_OPEN = 1
    // if (OSC_SENDER?.status() === IS_OPEN) {
    //     sendMessage()
    // }

    OSC_SENDER.on("error", (err: any) => {
        console.error("OSC EMIT ERROR:", err)
        OSC_SENDER.close()
    })

    function sendMessage() {
        if (!OSC_SENDER) return

        const message = new OSC.Message(msg.data)
        console.log(`Emitting OSC at ${host}:${port}:`, message.address)

        OSC_SENDER.send(message)
        // ensure message is sent
        setTimeout(() => OSC_SENDER.close(), 100)
    }
}

// DATA

async function receivedData(data: any = {}, log: (...msg: any[]) => void): Promise<any> {
    if (!data?.action) return log("Received message from client, but missing 'action' key.", true)
    log(`Received action ${data.action}`)

    const get = data.action.startsWith("get_")
    if (get) data.returnId = uid(5)

    sendToMain(ToMain.API_TRIGGER2, data)

    if (!data.returnId) return

    const returnData = await waitUntilValueIsDefined(() => returnDataObj[data.returnId], 50, 1000)
    delete returnDataObj[data.returnId]
    log(`Sending data ${data.action}`)
    return returnData
}

let returnDataObj: { [key: string]: any } = {}
export function apiReturnData(data: any) {
    let id = data.returnId
    if (!id) return

    delete data.returnId
    returnDataObj[id] = data
}

// CLOSE

export function stopApiListener(id: string = "") {
    if (id) stop(id)
    else Object.keys(servers).forEach(stop)

    function stop(id: string) {
        console.log(`${id}: Stopping server.`)
        servers[id].close()
    }
}
