// ----- FreeShow -----
// Yjs relay: bridges client "YJS" socket messages to the authoritative server
// docs. Uses Socket.IO rooms (one per show) so updates fan out only to clients
// viewing that show.

import type { Server, Socket } from "socket.io"
import * as Y from "yjs"
import { getDoc, schedulePersist } from "./docRegistry"

interface YjsMessage {
    action: "open" | "update"
    showId: string
    name?: string
    update?: ArrayBuffer | Uint8Array
}

const room = (showId: string) => "show:" + showId

export function handleYjsMessage(io: Server, socket: Socket, payload: { data?: YjsMessage }) {
    const msg = payload?.data
    if (!msg?.showId) return

    if (msg.action === "open") {
        const doc = getDoc(msg.showId, msg.name || "")
        socket.join(room(msg.showId))
        // send the full authoritative state to the newly-opened client
        const state = Y.encodeStateAsUpdate(doc)
        socket.emit("YJS", { data: { action: "sync", showId: msg.showId, update: state } })
        return
    }

    if (msg.action === "update" && msg.update) {
        const doc = getDoc(msg.showId, msg.name || "")
        const update = new Uint8Array(msg.update as ArrayBuffer)
        Y.applyUpdate(doc, update, "client")
        // fan out to other clients viewing this show
        socket.to(room(msg.showId)).emit("YJS", { data: { action: "update", showId: msg.showId, update } })
        schedulePersist(msg.showId)
    }
}
