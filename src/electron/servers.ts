import { ipcMain } from "electron"
import express, { Response } from "express"
import http from "http"
import { join } from "path"
import { Server } from "socket.io"
import { REMOTE, STAGE } from "../types/Channels"
import { toApp } from "./index"

var REMOTE_MAX: number = 10
var STAGE_MAX: number = 10
var connections: { [key: string]: any } = {
  REMOTE: {},
  STAGE: {},
}

const remoteExpressApp = express()
const stageExpressApp = express()
const remoteServer = http.createServer(remoteExpressApp)
const stageServer = http.createServer(stageExpressApp)
const ioRemote = new Server(remoteServer)
const ioStage = new Server(stageServer)

remoteExpressApp.get("/", (_req: any, res: Response) => res.sendFile(join(__dirname, "remote", "index.html")))
stageExpressApp.get("/", (_req: any, res: Response) => res.sendFile(join(__dirname, "stage", "index.html")))

remoteExpressApp.use(express.static(join(__dirname, "remote")))
stageExpressApp.use(express.static(join(__dirname, "stage")))

var started: boolean = false
export function startServers({ ports, max }: any) {
  if (started) closeServers()
  started = true
  remoteServer.listen(ports.remote, () => console.log("Remote on: " + ports.remote))
  stageServer.listen(ports.stage, () => console.log("Stage on: " + ports.stage))
  REMOTE_MAX = max
  STAGE_MAX = max

  remoteServer.once("error", (err: any) => {
    if (err.code === "EADDRINUSE") remoteServer.close()
  })
  stageServer.once("error", (err: any) => {
    if (err.code === "EADDRINUSE") stageServer.close()
  })
}

export function closeServers() {
  started = false
  remoteServer.close()
  stageServer.close()
}

// REMOTE

// let clients = await ioRemote.sockets.allSockets();
// ioRemote.sockets.socket.forEach(socket, s => console.log(s.id));
ioRemote.on("connection", (socket) => {
  if (Object.keys(connections.REMOTE).length >= REMOTE_MAX) {
    ioStage.emit(REMOTE, { channel: "ERROR", id: "overLimit", data: REMOTE_MAX })
    socket.disconnect()
  } else {
    initialize(REMOTE, socket)
  }
})

// SEND DATA FROM APP TO CLIENT
ipcMain.on(REMOTE, (_e, msg) => {
  if (msg.id) ioRemote.to(msg.id).emit(REMOTE, msg)
  else ioRemote.emit(REMOTE, msg)
})

// STAGE

ioStage.on("connection", (socket) => {
  if (Object.keys(connections.STAGE).length >= STAGE_MAX) {
    ioStage.emit(STAGE, { channel: "ERROR", id: "overLimit", data: STAGE_MAX })
    socket.disconnect()
  } else {
    initialize(STAGE, socket)
  }
})

// SEND DATA FROM APP TO CLIENT
ipcMain.on(STAGE, (_e, msg) => {
  if (msg.id) ioStage.to(msg.id).emit(STAGE, msg)
  else ioStage.emit(STAGE, msg)
})

// FUNCTIONS

function initialize(id: "REMOTE" | "STAGE", socket: any) {
  // INITIALIZE
  let name: string = getOS(socket.handshake.headers["user-agent"] || "")
  toApp(id, { channel: "CONNECTION", id: socket.id, data: { name } })
  connections[id][socket.id] = { name }

  // SEND DATA FROM CLIENT TO APP
  socket.on(id, (msg: any) => toApp(id, msg))

  // DISCONNECT
  socket.on("disconnect", () => {
    toApp(id, { channel: "DISCONNECT", id: socket.id })
    delete connections[id][socket.id]
  })
}

export function getOS(ua: string) {
  // https://stackoverflow.com/a/59706252
  let os: string = "Unknown"
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
  Object.keys(device).map((v) => ua.match(device[v]) && (os = v))
  return os
}
