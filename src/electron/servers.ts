import { ipcMain, type IpcMainEvent } from "electron"
import type { Response } from "express"
import express from "express"
import http from "http"
import { join } from "path"
import { Server, type Socket } from "socket.io"
import type { Main, MainSendPayloads } from "../types/IPC/Main"
import type { Message, ServerData } from "../types/Socket"
import { CaptureHelper } from "./capture/CaptureHelper"
import { publishPort, unpublishPorts } from "./data/bonjour"
import { toApp } from "./index"
import { OutputHelper } from "./output/OutputHelper"

type ServerName = "REMOTE" | "STAGE" | "CONTROLLER" | "OUTPUT_STREAM"
interface ServerValues {
    port: number
    server: http.Server
    io: Server
    max: number
    connections: { [key: string]: { name: string } }
    data: ServerData
}

const serverPorts: { [key in ServerName]: number } = {
    REMOTE: 5510,
    STAGE: 5511,
    CONTROLLER: 5512,
    OUTPUT_STREAM: 5513
    // CAM: 5513,
}

const servers: { [key in ServerName]?: ServerValues } = {}
const ioServers: { [key in ServerName]?: Server } = {}

createServers()
function createServers() {
    const serverList = Object.keys(serverPorts) as ServerName[]
    serverList.forEach((id) => {
        createServerInstance(id)
        // the app -> client IPC bridge is registered once and always emits via the current io instance
        registerIpcBridge(id)
    })
}

// (re)create a fresh express app + http server + socket.io instance.
// a closed http.Server cannot be re-listened, so this is called again on every (re)start.
function createServerInstance(id: ServerName) {
    const app = express()
    const server = http.createServer(app)

    if (id === "STAGE") {
        // app.get('/show/:showId/:slideId', handleShowSlideHtmlRequest);
        // Serve media files
        // app.get('/media/:token', handleMediaRequest);
    }

    // The join import from 'path' is still needed for this part
    app.get("/", (_req, res: Response) => res.sendFile(join(__dirname, id.toLowerCase(), "index.html")))
    // The join import from 'path' is still needed for this part
    app.use(express.static(join(__dirname, id.toLowerCase())))

    const io = new Server(server)

    servers[id] = {
        ...servers[id],
        port: serverPorts[id],
        server,
        io,
        max: servers[id]?.max ?? 10,
        connections: {}, // always start with a clean connection map
        data: servers[id]?.data ?? {}
    }
    ioServers[id] = io

    // RECEIVE CONNECTION FROM CLIENT
    io.on("connection", (socket) => {
        if (Object.keys(servers[id]!.connections).length >= servers[id]!.max) {
            io.emit(id, { channel: "ERROR", id: "overLimit", data: servers[id]!.max })
            socket.disconnect()
            return
        }

        initialize(id, socket)
    })
}

function registerIpcBridge(id: ServerName) {
    // SEND DATA FROM APP TO CLIENT (uses the current io instance via ioServers, so it survives server recreation)
    ipcMain.on(id, (_e: IpcMainEvent, msg: Message) => {
        const io = ioServers[id]
        if (!io) return
        if (msg?.id) io.to(msg.id).emit(id, msg)
        else io.emit(id, msg)
    })
}

let hasStarted = false
export function startServers({ ports, max, disabled, data }: MainSendPayloads[Main.SERVER_DATA]) {
    if (hasStarted) closeServers()
    hasStarted = true

    const serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        if (!servers[id] || disabled[id.toLowerCase()] !== false) return

        // recreate a fresh, listenable instance (the previous http.Server may have been closed)
        createServerInstance(id)

        servers[id]!.max = max
        if (ports[id.toLowerCase()]) servers[id]!.port = ports[id.toLowerCase()]

        servers[id]!.data = data[id.toLowerCase()] || {}

        servers[id]!.server.listen(servers[id]!.port, onStarted)
        servers[id]!.server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") {
                servers[id]!.server.close()
                console.error(`${id} server port ${servers[id]!.port} already in use`)
            }
        })

        function onStarted() {
            console.info(id + " on: " + servers[id]!.port.toString())
            publishPort(id, servers[id]!.port)
        }
    })
}

export function updateServerData(data: { [key: string]: ServerData }) {
    const serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        servers[id]!.data = data[id.toLowerCase()] || {}
    })
}

export function getServerData(id: ServerName) {
    return servers[id]?.data || {}
}

export function closeServers() {
    unpublishPorts()

    hasStarted = false
    const serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        if (!servers[id]?.server) return
        // close socket.io (disconnects clients and closes the underlying http server)
        servers[id]!.io.close()
        // clear connection state so reconnect counts / max limit don't drift across restarts
        servers[id]!.connections = {}
    })
}

let responded: { [key: string]: boolean } = {}
export function toServer(id: ServerName, msg: any) {
    if (msg.channel === "STREAM") {
        // only send if responded
        if (responded[msg.data.id] === false) return
        responded[msg.data.id] = false
    }

    ioServers[id]?.emit(id, msg)
}

export function getConnections(id: ServerName) {
    return Object.keys(servers[id]?.connections || {}).length
}

// FUNCTIONS

function initialize(id: ServerName, socket: Socket) {
    const name: string = getOS(socket.handshake.headers["user-agent"] || "")
    toApp(id, { channel: "CONNECTION", id: socket.id, data: { name } })
    servers[id]!.connections[socket.id] = { name }

    // reset with new connection
    if (id === "OUTPUT_STREAM") responded = {}

    // SEND DATA FROM CLIENT TO APP
    socket.on(id, async (msg: Message) => {
        if (msg.channel === "STREAM_DONE") {
            responded[msg.data.id] = true
        } else if (msg.channel === "OUTPUT_FRAME") {
            const window = OutputHelper.getOutput(msg.data.outputId)?.window
            if (!window || window.isDestroyed()) return

            const frame = await CaptureHelper.captureBase64Frame(window)
            if (window.isDestroyed()) return

            const bounds = window.getBounds()
            toServer(id, { channel: "OUTPUT_FRAME", data: { frame, width: bounds.width, height: bounds.height } })
        } else if (msg) {
            toApp(id, msg)
        }
    })

    // DISCONNECT
    socket.on("disconnect", () => disconnect(id, socket))
}

function disconnect(id: ServerName, socket: Socket) {
    toApp(id, { channel: "DISCONNECT", id: socket.id })
    delete servers[id]!.connections[socket.id]
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
    Zebra: /TC70|TC55/i
}
export function getOS(ua: string) {
    return Object.keys(device).find((v) => ua.match(device[v])) || "Unknown"
}
