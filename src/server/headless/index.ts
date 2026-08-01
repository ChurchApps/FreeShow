// ----- FreeShow -----
// Headless FreeShow server entrypoint.
//
// Usage:
//   node build/headless/server/headless/index.js --data <dir> --port 5540 --token <token>
//   (or via env: FREESHOW_DATA, PORT/FREESHOW_PORT, FREESHOW_TOKEN, FREESHOW_WEB_DIR)
//
// Serves the web build over HTTP and bridges the frontend's IPC envelopes over
// Socket.IO to the portable handler table (headless platform).

import express from "express"
import http from "http"
import { Server } from "socket.io"
import { setAuthToken, socketAuth } from "./auth"
import { setDataRoot, getDataFolderRoot } from "./data/dataPaths"
import { registerHttpRoutes } from "./httpRoutes"
import { registerClient } from "./socketServer"

interface Args {
    data?: string
    port?: number
    token?: string
}

function parseArgs(argv: string[]): Args {
    const args: Args = {}
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--data") args.data = argv[++i]
        else if (arg === "--port") args.port = Number(argv[++i])
        else if (arg === "--token") args.token = argv[++i]
    }
    return args
}

// keep the server alive on transient/non-fatal errors (e.g. a file that vanished mid-request)
// instead of crashing the whole process the way an unhandled ENOENT would.
function installProcessGuards() {
    process.on("uncaughtException", (err) => console.error("[headless] uncaughtException:", err?.message || err))
    process.on("unhandledRejection", (reason) => console.error("[headless] unhandledRejection:", reason))
}

export function startHeadlessServer(args: Args = {}) {
    installProcessGuards()

    const dataRoot = args.data || process.env.FREESHOW_DATA
    if (dataRoot) setDataRoot(dataRoot)

    const token = args.token || process.env.FREESHOW_TOKEN || ""
    setAuthToken(token)

    const port = args.port || Number(process.env.FREESHOW_PORT || process.env.PORT) || 5540

    const app = express()
    const server = http.createServer(app)
    // cors origin "*" allows remote desktop clients (different origin) to connect;
    // access is still gated by the auth token. Tighten origin for production if needed.
    const io = new Server(server, { maxHttpBufferSize: 1e8, cors: { origin: "*" } }) // 100MB for larger payloads

    registerHttpRoutes(app)

    io.use(socketAuth)
    io.on("connection", (socket) => registerClient(io, socket))

    server.listen(port, () => {
        console.info(`FreeShow headless server on http://localhost:${port}`)
        console.info(`Data folder: ${getDataFolderRoot()}`)
        console.info(token ? "Auth: token required" : "Auth: OPEN (no token set)")
    })

    return { app, server, io }
}

// run when invoked directly
if (require.main === module) {
    startHeadlessServer(parseArgs(process.argv.slice(2)))
}
