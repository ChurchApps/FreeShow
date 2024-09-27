import express from "express"
import http from "http"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { Server } from "socket.io"
import { ipcMain } from "electron"

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

    socket.on("data", (data: any) => {
        let parsedData
        try {
            parsedData = JSON.parse(data || "{}")
        } catch (err) {
            console.log("Could not parse socket data.")
            return
        }

        receivedData(parsedData, log)
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
    app.post("/", (req) => {
        // {action: ACTION_ID, ...{}}
        let data = req.body
        // ?action=ACTION_ID&data={}
        if (!data.action && req.query.action) data = { action: req.query.action, ...JSON.parse((req.query.data || "{}") as string) }

        receivedData(data, (msg: string) => console.log(`REST: ${msg}`))
    })
}

// DATA

function receivedData(data: any = {}, log: any) {
    if (!data?.action) return log("Received message from client, but missing 'action' key.", true)

    log(`Received action ${data.action}`)
    toApp(MAIN, { channel: "API_TRIGGER", data })
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
