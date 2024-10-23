import { ipcMain } from "electron"
import express from "express"
import http from "http"
import { Server } from "socket.io"
import { uid } from "uid"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { waitUntilValueIsDefined } from "./helpers"

const app = express()
let servers: any = {}
const DEFAULT_PORTS = { WebSocket: 5505, REST: 5506 }

// WebSocket on 5506, REST on +1 (5506), but works with 5505 as well!
export function startWebSocketAndRest(port: number | undefined) {
    startRestListener(port ? port + 1 : 0)
    startWebSocket(port)
}

// WEBSOCKET

export function startWebSocket(PORT: number | undefined) {
    let server = (servers.WebSocket = http.createServer(app))

    if (!PORT) PORT = DEFAULT_PORTS.WebSocket
    server.listen(PORT, () => {
        console.log(`WebSocket: Starting server at port ${PORT}.`)
    })

    server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") server.close()
    })

    const io = new Server(server)
    io.on("connection", connected)
}

function connected(socket: any) {
    log("Client connected.")
    toApp(MAIN, { channel: "API", data: "connected" }) // TODO: respond with API_DATA

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
    app.post("/", async (req) => {
        // {action: ACTION_ID, ...{}}
        let data = req.body
        // ?action=ACTION_ID&data={}
        if (!data.action && req.query.action) data = { action: req.query.action, ...JSON.parse((req.query.data || "{}") as string) }

        const returnData = await receivedData(data, (msg: string) => console.log(`REST: ${msg}`))
        if (!returnData) return

        req.emit("data", returnData)
    })
}

// DATA

async function receivedData(data: any = {}, log: any) {
    if (!data?.action) return log("Received message from client, but missing 'action' key.", true)
    log(`Received action ${data.action}`)

    const get = data.action.startsWith("get_")
    if (get) data.returnId = uid(5)

    toApp(MAIN, { channel: "API_TRIGGER", data })

    if (!data.returnId) return

    const returnData = await waitUntilValueIsDefined(() => returnDataObj[data.returnId], 50, 1000)
    delete returnDataObj[data.returnId]
    log(`Sending data ${data.action}`)
    return returnData
}

let returnDataObj: any = {}
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
