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
import { handleShowSlideHtmlRequest, getMediaFileFromToken } from "./utils/HtmlSlideHelper";
import fs from "fs"
import path from "path"

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
    OUTPUT_STREAM: 5513,
    // CAM: 5513,
}

const servers: { [key in ServerName]?: ServerValues } = {}
const ioServers: { [key in ServerName]?: Server } = {}

createServers()
function createServers() {
    const serverList = Object.keys(serverPorts) as ServerName[]
    serverList.forEach((id) => {
        const app = express()
        const server = http.createServer(app)

        if (id === "STAGE") {
            app.get('/show/:showId/:slideId', handleShowSlideHtmlRequest);

            // Serve media files
            app.get('/media/:token', (req, res) => {
                const token = req.params.token;

                console.log("SERVING MEDIA TOKEN:", token);

                // Get the actual file path from the secure token
                const filePath = getMediaFileFromToken(token);

                if (!filePath) {
                    console.error("Invalid or expired media token:", token);
                    res.status(404).send('Media not found');
                    return;
                }

                console.log("RESOLVED TO FILE:", filePath);

                // SECURITY: Validate file extension
                const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.ogv', '.mov', '.avi', '.bmp', '.tiff', '.svg'];
                const ext = path.extname(filePath).toLowerCase();

                if (!allowedExtensions.includes(ext)) {
                    console.error("Unauthorized file type:", ext);
                    res.status(403).send('File type not allowed');
                    return;
                }

                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    console.error("Media file not found:", filePath);
                    res.status(404).send('Media file not found');
                    return;
                }

                // Get file extension to set proper content type
                const mimeTypes: { [key: string]: string } = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp',
                    '.tiff': 'image/tiff',
                    '.svg': 'image/svg+xml',
                    '.mp4': 'video/mp4',
                    '.webm': 'video/webm',
                    '.ogv': 'video/ogg',
                    '.mov': 'video/quicktime',
                    '.avi': 'video/x-msvideo'
                };

                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', contentType);

                // Stream the file
                const fileStream = fs.createReadStream(filePath);
                fileStream.pipe(res);

                fileStream.on('error', (error) => {
                    console.error("Error streaming media file:", error);
                    if (!res.headersSent) {
                        res.status(500).send('Error streaming media file');
                    }
                });
            });
        }

        // The join import from 'path' is still needed for this part
        app.get("/", (_req, res: Response) => res.sendFile(join(__dirname, id.toLowerCase(), "index.html")))
        // The join import from 'path' is still needed for this part
        app.use(express.static(join(__dirname, id.toLowerCase())))

        servers[id] = {
            ...servers[id],
            port: serverPorts[id],
            server,
            io: new Server(server),
            max: 10,
            connections: {},
            data: {},
        }

        createBridge(id, servers[id]!)
    })
}

let hasStarted = false
export function startServers({ ports, max, disabled, data }: MainSendPayloads[Main.SERVER_DATA]) {
    if (hasStarted) closeServers()
    hasStarted = true

    const serverList = Object.keys(servers) as ServerName[]
    serverList.forEach((id: ServerName) => {
        if (!servers[id] || disabled[id.toLowerCase()] !== false) return

        servers[id]!.max = max
        if (ports[id.toLowerCase()]) servers[id]!.port = ports[id.toLowerCase()]

        servers[id]!.data = data[id.toLowerCase()] || {}

        servers[id]!.server.listen(servers[id]!.port, onStarted)
        servers[id]!.server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") servers[id]!.server.close()
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
        servers[id]!.server.close()
    })
}

function createBridge(id: ServerName, server: ServerValues) {
    // RECEIVE CONNECTION FROM CLIENT
    server.io.on("connection", (socket) => {
        if (Object.keys(server.connections).length >= server.max) {
            server.io.emit(id, { channel: "ERROR", id: "overLimit", data: server.max })
            socket.disconnect()
            return
        }

        initialize(id, socket)
    })

    // SEND DATA FROM APP TO CLIENT
    ioServers[id] = server.io
    ipcMain.on(id, (_e: IpcMainEvent, msg: Message) => {
        if (msg.id) server.io.to(msg.id).emit(id, msg)
        else server.io.emit(id, msg)
    })
}

export function toServer(id: ServerName, msg: any) {
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

    // SEND DATA FROM CLIENT TO APP
    socket.on(id, async (msg: Message) => {
        if (msg.channel === "OUTPUT_FRAME") {
            const window = OutputHelper.getOutput(msg.data.outputId)?.window
            if (!window || window.isDestroyed()) return
            const frame = await CaptureHelper.captureBase64Frame(window)
            toServer(id, { channel: "OUTPUT_FRAME", data: { frame } })
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
    Zebra: /TC70|TC55/i,
}
export function getOS(ua: string) {
    return Object.keys(device).find((v) => ua.match(device[v])) || "Unknown"
}
