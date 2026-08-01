// ----- FreeShow -----
// Socket.IO <-> handler bridge for the headless server. This is the headless
// mirror of src/electron/IPC/main.ts:receiveMain — it dispatches each MAIN
// envelope to the portable handler table and replies over the same channel,
// preserving the listenerId so the client's requestMain() correlation works.

import type { Server, Socket } from "socket.io"
import { createPortableResponses } from "../../shared/ipc/createPortableResponses"
import { HEADLESS_CAPABILITIES } from "../../shared/platform/capabilities"
import { handleYjsMessage } from "./crdt/relay"
import { headlessPlatform } from "./platform/headlessPlatform"

const responses = createPortableResponses(headlessPlatform)

interface MainEnvelope {
    data: { channel: string; data: any }
    listenerId?: string
}

// mirrors the STARTUP {channel:"TYPE"} message the desktop main sends on did-finish-load
function startupPayload() {
    return { data: { channel: "TYPE", data: null, autoProfile: "", capabilities: HEADLESS_CAPABILITIES } }
}

export function registerClient(io: Server, socket: Socket) {
    const sendStartup = () => socket.emit("STARTUP", startupPayload())

    // client asks for STARTUP on every (re)connect; also push once immediately
    socket.on("STARTUP_REQUEST", sendStartup)
    sendStartup()

    // real-time co-editing (Yjs)
    socket.on("YJS", (payload) => handleYjsMessage(io, socket, payload))

    socket.on("MAIN", async (payload: MainEnvelope) => {
        const inner = payload?.data
        if (!inner?.channel) return

        const handler = (responses as Record<string, (d?: any) => any>)[inner.channel]
        if (!handler) return // unhandled channel (e.g. Electron-only) -> ignored on headless

        try {
            const response = await handler(inner.data)

            // SAVE: reply completion to the saver, and push changed library stores to
            // OTHER clients so new shows/projects/overlays appear live in every session.
            if (inner.channel === "SAVE") {
                const result = response || {}
                socket.emit("MAIN", { data: { channel: "SAVE2", data: result.complete || {} } })
                for (const [channel, value] of Object.entries(result.changed || {})) {
                    socket.broadcast.emit("MAIN", { data: { channel, data: value } })
                }
                return
            }

            if (response === undefined) return
            socket.emit("MAIN", { data: { channel: inner.channel, data: response }, listenerId: payload.listenerId })
        } catch (err) {
            console.error(`Headless handler error for ${inner.channel}:`, err)
        }
    })
}
