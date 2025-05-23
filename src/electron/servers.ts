import { app as electronApp, ipcMain } from "electron"
import type { Request, Response } from "express"
import express from "express"
import http from "http"
import path, { join } from "path"
import { Server, type Socket } from "socket.io"
import type { Main, MainSendPayloads } from "../types/IPC/Main"
import type { Message, ServerData } from "../types/Socket"
import { CaptureHelper } from "./capture/CaptureHelper"
import { publishPort, unpublishPorts } from "./data/bonjour"
import { stores } from "./data/store"
import { toApp } from "./index"
import { OutputHelper } from "./output/OutputHelper"
import { readFile } from "./utils/files"

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

function generateSlideHtmlResponse(showData: any, slideData: any, showId: string, slideId: string): string {
    const showName = showData.name || showId;
    let html = `<!DOCTYPE html><html><head><title>Show - ${showName} - Slide ${slideId}</title>`;
    let styles = `body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; font-family: sans-serif; } .slide-item { box-sizing: border-box; border: 1px solid #eee; /* Light border for visibility */ } `;
    let bodyContent = "";

    const slideSettings = slideData.settings || {};
    let slideContainerStyle = "position: relative; width: 100%; height: 100%;";
    if (slideSettings.backgroundImage) {
        slideContainerStyle += `background-image: url('${slideSettings.backgroundImage}'); background-size: cover; background-position: center;`;
    } else if (slideSettings.color) {
        slideContainerStyle += `background-color: ${slideSettings.color};`;
    } else {
        slideContainerStyle += `background-color: #000000;`; // Default black background
    }
    styles += ` .slide-container { ${slideContainerStyle} }`;

    if (slideData.items && typeof slideData.items === 'object') {
        for (const itemId in slideData.items) {
            const item = slideData.items[itemId];
            if (!item) continue; // Skip if item is null or undefined

            let itemStyle = `position: absolute; top: ${item.yPos || 0}%; left: ${item.xPos || 0}%; width: ${item.width || 20}%; height: ${item.height || 10}%;`;
            
            const font = item.font || {};
            const textProps = item.text || {};
            const mediaProps = item.media || {};

            if (font.color) itemStyle += `color: ${font.color};`;
            if (font.size) itemStyle += `font-size: ${font.size}pt;`;
            if (font.families && font.families[0]) itemStyle += `font-family: ${font.families[0]};`;
            if (textProps.align) itemStyle += `text-align: ${textProps.align};`;
            if (item.rotation) itemStyle += `transform: rotate(${item.rotation}deg);`;
            if (typeof item.opacity === 'number') itemStyle += `opacity: ${item.opacity / 100};`;

            if (item.itemType === "TEXT" || textProps.value || (textProps.lines && Array.isArray(textProps.lines))) {
                bodyContent += `<div class="slide-item text-item" style="${itemStyle}">`;
                let currentText = "";
                if (textProps.lines && Array.isArray(textProps.lines)) {
                  currentText = textProps.lines.map(line => line.text || "").join("<br>");
                } else if (textProps.value) {
                  currentText = String(textProps.value).replace(/\r\n|\n|\r/g, "<br>");
                }
                bodyContent += `<div>${currentText}</div>`;
                bodyContent += `</div>`;
            } else if (item.itemType === "IMAGE" || mediaProps.type === 'image') {
                bodyContent += `<div class="slide-item media-item" style="${itemStyle}">`;
                bodyContent += `<img src="${mediaProps.path || mediaProps.url}" alt="Slide Image" style="width: 100%; height: 100%; object-fit: ${mediaProps.scaleMode || 'contain'};">`;
                bodyContent += `</div>`;
            } else if (item.itemType === "VIDEO" || mediaProps.type === 'video') {
                bodyContent += `<div class="slide-item media-item" style="${itemStyle}">`;
                bodyContent += `<video src="${mediaProps.path || mediaProps.url}" controls style="width: 100%; height: 100%; object-fit: ${mediaProps.scaleMode || 'contain'};"></video>`;
                bodyContent += `</div>`;
            }
        }
    }

    html += `<style>${styles}</style></head><body><div class="slide-container">${bodyContent}</div></body></html>`;
    return html;
}

createServers()
function createServers() {
    const serverList = Object.keys(serverPorts) as ServerName[]
    serverList.forEach((id) => {
        const app = express()
        const server = http.createServer(app)

        if (id === "STAGE") {
            app.get("/show/:showId/:slideId", (req: Request, res: Response) => {
                const { showId, slideId } = req.params

                try {
                    const trimmedShow = stores.SHOWS.get(showId) as { name: string } | undefined; 

                    if (!trimmedShow) {
                        return res.status(404).send(`Show metadata not found for ID: ${showId}`);
                    }

                    const showNameFromStore = trimmedShow.name;
                    if (!showNameFromStore || showNameFromStore.trim() === "") {
                        console.error(`Show name for ID ${showId} is empty.`);
                        return res.status(404).send(`Show name is empty for ID: ${showId}`);
                    }
                    
                    const showFileName = showNameFromStore + ".show";

                    let showsPath = stores.SETTINGS.get("showsPath") as string | undefined
                    if (!showsPath) {
                        showsPath = path.join(electronApp.getPath("userData"), "Shows")
                    }
                    const showFilePath = path.join(showsPath, showFileName);

                    const fileContent = readFile(showFilePath)
                    if (!fileContent) {
                        return res.status(404).send("Show file not found or is empty")
                    }

                    const showData = JSON.parse(fileContent)
                    const slideData = showData.slides[slideId]

                    if (!slideData) {
                        return res.status(404).send("Slide not found in show")
                    }

                    const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId);
                    res.send(htmlResponse);
                } catch (error) {
                    console.error("Error processing show/slide for HTML generation:", error)
                    return res.status(500).send("Error generating slide HTML")
                }
            })
        }

        app.get("/", (_req, res: Response) => res.sendFile(join(__dirname, id.toLowerCase(), "index.html")))
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
    ipcMain.on(id, (_e, msg: Message) => {
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
