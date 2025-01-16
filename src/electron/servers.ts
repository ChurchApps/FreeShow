import { ipcMain } from "electron"
import express, { Response } from "express"
import http from "http"
import { join } from "path"
import { Server } from "socket.io"
import { CaptureHelper } from "./capture/CaptureHelper"
import { toApp } from "./index"
import { OutputHelper } from "./output/OutputHelper"

type ServerName = "REMOTE" | "STAGE" | "CONTROLLER" | "OUTPUT_STREAM"
let servers: { [key in ServerName]: any } = {
    REMOTE: { port: 5510 },
    STAGE: { port: 5511 },
    CONTROLLER: { port: 5512 },
    OUTPUT_STREAM: { port: 5513 },
    // CAM: { port: 5513 },
}
let ioServers: { [key in ServerName]?: any } = {}

createServers()
function createServers() {
    let serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        let app = express()
        let server = http.createServer(app)

        app.get("/", (_req: any, res: Response) => res.sendFile(join(__dirname, id.toLowerCase(), "index.html")))
        app.use(express.static(join(__dirname, id.toLowerCase())))

        servers[id] = {
            ...servers[id],
            server,
            io: new Server(server),
            max: 10,
            connections: {},
        }

        createBridge({ id, ...servers[id] })
    })
}

var started: boolean = false
export function startServers({ ports, max, disabled }: any) {
    if (started) closeServers()
    started = true

    let serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        if (disabled[id.toLowerCase()] !== false) return

        servers[id].max = max
        if (ports[id.toLowerCase()]) servers[id].port = ports[id.toLowerCase()]

        servers[id].server.listen(servers[id].port, () => console.log(id + " on: " + servers[id].port))
        servers[id].server.once("error", (err: any) => {
            if (err.code === "EADDRINUSE") servers[id].server.close()
        })
    })
}

export function closeServers() {
    started = false
    let serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        if (!servers[id]?.server) return
        servers[id].server.close()
    })
}

function createBridge(server: any) {
    // RECEIVE CONNECTION FROM CLIENT
    server.io.on("connection", (socket: any) => {
        if (Object.keys(server.connections).length >= server.max) {
            server.io.emit(server.id, { channel: "ERROR", id: "overLimit", data: server.max })
            socket.disconnect()
            return
        }

        initialize(server.id, socket)
    })

    // SEND DATA FROM APP TO CLIENT
    ioServers[server.id as ServerName] = server.io
    ipcMain.on(server.id, (_e, msg) => {
        if (msg.id) server.io.to(msg.id).emit(server.id, msg)
        else server.io.emit(server.id, msg)
    })
}

export function toServer(id: ServerName, msg: any) {
    ioServers[id].emit(id, msg)
}

export function getConnections(id: ServerName) {
    return Object.keys(servers[id]?.connections || {}).length
}

// FUNCTIONS

function initialize(id: ServerName, socket: any) {
    let name: string = getOS(socket.handshake.headers["user-agent"] || "")
    toApp(id, { channel: "CONNECTION", id: socket.id, data: { name } })
    servers[id].connections[socket.id] = { name }

    // SEND DATA FROM CLIENT TO APP
    socket.on(id, async (msg: any) => {
        if (msg.channel === "OUTPUT_FRAME") {
            const window = OutputHelper.getOutput(msg.data.outputId).window
            const frame = await CaptureHelper.captureBase64Frame(window)
            toServer(id, { channel: "OUTPUT_FRAME", data: { frame } })
        } else if (msg) {
            toApp(id, msg)
        }
    })

    // DISCONNECT
    socket.on("disconnect", () => disconnect(id, socket))
}

function disconnect(id: ServerName, socket: any) {
    toApp(id, { channel: "DISCONNECT", id: socket.id })
    delete servers[id].connections[socket.id]
}

// https://stackoverflow.com/a/59706252
const device: { [key: string]: RegExp } = {
    "Generic Linux": /Linux/i,
    Android: /Android/i,
    BlackBerry: /BlackBerry/i,
    Bluebird: /EF500/i,
    "Chrome OS": /CrOS/i,
    Datalogic: /DL-AXIS/i,
    Honeywell: /CT50/i,
    iPad: /iPad/i,
    iPhone: /iPhone/i,
    iPod: /iPod/i,
    macOS: /Macintosh/i,
    Windows: /IEMobile|Windows/i,
    Zebra: /TC70|TC55/i,
}
export function getOS(ua: string) {
    return Object.keys(device).find((v) => ua.match(device[v])) || "Unknown"
}
