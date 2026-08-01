// ----- FreeShow -----
// Socket.IO transport: a browser / remote implementation of the `window.api`
// contract used by src/electron/preload.ts. It speaks the exact same envelopes
// the frontend already sends, just over a WebSocket instead of Electron IPC.
//
// Wire format (mirrors ipcRenderer.send(channel, data, id)):
//   client -> server:  socket.emit(channel, { data, listenerId })
//   server -> client:  socket.emit(channel, { data, listenerId })
// where `channel` is a ValidChannels transport name (MAIN, OUTPUT, STARTUP, ...),
// `data` is the inner `{ channel, data }` envelope built by sendMain/send, and
// `listenerId` is the correlation token requestMain uses to match replies.

import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client"
import { io } from "socket.io-client"
import type { FreeShowApi } from "./types"

type Receiver = (args: any, listenerId?: string) => void
interface Envelope {
    data: any
    listenerId?: string
}

export interface SocketTransportOptions {
    /** Server URL. Empty/undefined connects to the page origin (web build served by the backend). */
    url?: string
    /** Auth handshake payload (e.g. { token }); validated server-side before STARTUP is emitted. */
    auth?: Record<string, unknown>
    /** Called whenever the underlying socket connects / disconnects, for connection-status UI. */
    onStatus?: (status: "connected" | "disconnected" | "reconnecting") => void
}

export function createSocketApi(options: SocketTransportOptions = {}): FreeShowApi {
    const { url, auth, onStatus } = options

    const connectOptions: Partial<ManagerOptions & SocketOptions> = { transports: ["websocket", "polling"] }
    if (auth) connectOptions.auth = auth
    const socket: Socket = url ? io(url, connectOptions) : io(connectOptions)

    // Active receivers per transport channel. Mirrors ipcRenderer.on allowing
    // multiple listeners on the same channel (e.g. receiveMainGlobal + each requestMain).
    const channelReceivers: { [channel: string]: Set<Receiver> } = {}
    // id -> { channel, receiver } so removeListener()/id-dedup work like preload's storedReceivers.
    const storedReceivers: { [id: string]: { channel: string; receiver: Receiver } } = {}

    function ensureChannel(channel: string) {
        if (channelReceivers[channel]) return
        channelReceivers[channel] = new Set()
        socket.on(channel, (payload: Envelope) => {
            // iterate over a copy so a receiver removing itself mid-dispatch is safe
            for (const receiver of [...channelReceivers[channel]]) receiver(payload?.data, payload?.listenerId)
        })
    }

    // ask the server for the STARTUP payload on every (re)connect, so we never miss the
    // connection-time emit due to listener-registration timing.
    socket.on("connect", () => {
        socket.emit("STARTUP_REQUEST")
        onStatus?.("connected")
    })
    if (onStatus) {
        socket.on("disconnect", () => onStatus("disconnected"))
        socket.io.on("reconnect_attempt", () => onStatus("reconnecting"))
    }

    return {
        send(channel: string, data?: any, id?: string) {
            socket.emit(channel, { data, listenerId: id } as Envelope)
        },
        receive(channel: string, func: any, id?: string) {
            ensureChannel(channel)
            const receiver: Receiver = (args, listenerId) => func(args, listenerId)

            // de-dup by id: drop the previous receiver registered under the same id (preload behavior)
            if (id && storedReceivers[id]) {
                const prev = storedReceivers[id]
                channelReceivers[prev.channel]?.delete(prev.receiver)
            }

            channelReceivers[channel].add(receiver)
            if (id) storedReceivers[id] = { channel, receiver }
        },
        removeListener(_channel: string, id: string) {
            const stored = storedReceivers[id]
            if (!stored) return
            channelReceivers[stored.channel]?.delete(stored.receiver)
            delete storedReceivers[id]
        },
        getListeners() {
            return Object.entries(channelReceivers).map(([channel, set]) => [channel, set.size] as [string, number])
        },
        showFilePath() {
            // no local filesystem paths in a browser; disk-based drag/drop import is capability-gated
            return ""
        }
    }
}
