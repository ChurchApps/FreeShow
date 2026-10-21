import { createServer } from "net"
import { io as connect, type Socket } from "socket.io-client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { closeServers, startServers } from "./servers"

// servers.ts only needs these for features this test doesn't touch
vi.mock("electron", () => ({ ipcMain: { on: vi.fn() } }))
vi.mock("./index", () => ({ toApp: vi.fn() }))
vi.mock("./audio/nowPlaying", () => ({ getNowPlayingMediaPath: vi.fn() }))
vi.mock("./capture/CaptureHelper", () => ({ CaptureHelper: {} }))
vi.mock("./output/OutputHelper", () => ({ OutputHelper: {} }))
vi.mock("./data/bonjour", () => ({ publishPort: vi.fn(), unpublishPorts: vi.fn() }))
vi.mock("./utils/files", () => ({ doesPathExist: vi.fn(() => false) }))

function getFreePort(): Promise<number> {
    return new Promise((resolve) => {
        const server = createServer()
        server.listen(0, () => {
            const port = (server.address() as { port: number }).port
            server.close(() => resolve(port))
        })
    })
}

const clients: Socket[] = []
function connectClient(port: number) {
    const socket = connect(`http://localhost:${port}`, { forceNew: true, reconnection: false })
    clients.push(socket)

    const messages: any[] = []
    socket.on("STAGE", (msg) => messages.push(msg))

    return { socket, messages }
}

function waitFor(socket: Socket, event: "connect" | "disconnect") {
    return new Promise<void>((resolve) => socket.once(event, () => resolve()))
}

afterEach(() => {
    clients.splice(0).forEach((socket) => socket.close())
    closeServers()
})

describe("server connection limit", () => {
    it("only sends the overLimit error to the rejected client", async () => {
        const port = await getFreePort()
        startServers({ ports: { stage: port }, max: 1, disabled: { stage: false }, data: {} })

        const first = connectClient(port)
        await waitFor(first.socket, "connect")

        const rejected = connectClient(port)
        await waitFor(rejected.socket, "disconnect")
        // give a broadcast to the first client time to arrive, if one was sent
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(first.messages).toEqual([])
        expect(first.socket.connected).toBe(true)
        expect(rejected.messages).toEqual([{ channel: "ERROR", data: "overLimit" }])
    })
})
