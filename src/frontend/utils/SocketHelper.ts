import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { wait } from "./common"

const SOCKET_URL = "wss://socket.churchapps.org"

interface Connection {
    churchId: string
    teamId: string
    displayName: string
    conversationId?: string
}

// https://github.com/ChurchApps/Helpers/blob/main/src/interfaces/Messaging.ts
type SocketPayloadAction = "message" | "deleteMessage" | "callout" | "socketId"
interface SocketPayloadInterface {
    action: SocketPayloadAction
    data: any
}

// https://github.com/ChurchApps/AppHelper/blob/main/packages/apphelper/src/helpers/SocketHelper.ts
export class SocketHelper {
    private connection: Connection
    private socket: WebSocket | null = null
    private socketId: string | null = null

    constructor(connection: Connection) {
        if (!connection.churchId || !connection.teamId) throw new Error("Invalid connection data")
        if (!connection.displayName) connection.displayName = "Unnamed Device"

        this.connection = connection
        this.init()
    }

    private async init() {
        // already connected
        if (this.isConnected()) return

        // connection exists, but not open
        if (this.socket) this.disconnect()

        try {
            this.socket = new WebSocket(SOCKET_URL)

            this.socket.onmessage = (e) => {
                console.log("[Socket] Message received:", e.data)
                if (!isValidJSON(e.data)) return

                const payload: SocketPayloadInterface = JSON.parse(e.data)
                if (payload.action === "socketId") {
                    this.socketId = payload.data
                    this.connect()
                    return
                }

                this.handleMessage(payload)
            }

            this.socket.onopen = async () => {
                console.log("[Socket] Connected to server")
                this.socket!.send("getId")
            }

            this.socket.onclose = async () => {}
            this.socket.onerror = (err) => console.error("[Socket] Socket error:", err)
        } catch (err) {
            console.error("[Socket] Socket connection error:", err)
        }
    }

    private isConnected() {
        return !!(this.socketId && this.socket && this.socket.readyState === this.socket.OPEN)
    }

    private connect() {
        console.info("Connected to socket as", this.connection.displayName)
        const conversationId = this.connection.conversationId

        const connection = {
            socketId: this.socketId,
            churchId: this.connection.churchId,
            teamId: this.connection.teamId,
            conversationId,
            displayName: this.connection.displayName
        }

        console.log("[Socket] Joining room:", conversationId)
        this.postConnectionsAnonymous([connection])
    }

    disconnect = () => {
        if (this.socket && this.socket.readyState !== this.socket.CLOSED) {
            try {
                this.socket.close()
            } catch {
                /* ignore */
            }
        }

        this.socket = null
        this.socketId = null
        this.actionHandlers = []
    }

    // wait until socket is connected (max 5 seconds)
    async waitUntilConnected() {
        if (!this.socket) return false
        if (this.isConnected()) return true

        // 50 * 100ms = 5 seconds
        for (let i = 0; i < 50; i++) {
            if (this.socketId) return true
            await wait(100)
        }

        return false
    }

    getSocketId = () => {
        return this.socketId
    }

    // MESSAGING

    sendMessage(topic: string, data: { [key: string]: any } = {}) {
        if (!this.isConnected()) return

        const body = { topic, ...data, teamId: this.connection.teamId }
        const messageData = {
            churchId: this.connection.churchId,
            teamId: this.connection.teamId,
            content: JSON.stringify(body),
            displayName: this.connection.displayName
        }

        console.log("[Socket] Sending message:", topic)
        requestMain(Main.SEND_SOCKET_MESSAGE, messageData).catch((err) => {
            console.error("[Socket] Error sending message:", err)
        })
    }

    private async postConnectionsAnonymous(data: any[]) {
        const MESSAGING_API = "https://api.churchapps.org/messaging"
        const requestOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }

        try {
            const response = await fetch(MESSAGING_API + "/connections", requestOptions)
            if (!response.ok) {
                const json = await response.json()
                console.error("[Socket] Connection error:", response.status, json.errors?.[0])
                return
            }
            if (response.status === 204) return
            return await response.json()
        } catch (err) {
            console.error("[Socket] Fetch error:", err)
        }
    }

    // HANDLERS

    private actionHandlers: { id: string; handleMessage: (data: any) => void }[] = []

    addHandler = (id: string, handleMessage: (data: any) => void) => {
        const existing = this.actionHandlers.find((handler) => handler.id === id)
        if (existing) {
            existing.handleMessage = handleMessage
        } else {
            this.actionHandlers.push({ id, handleMessage })
        }
    }

    removeHandler = (id: string) => {
        this.actionHandlers = this.actionHandlers.filter((handler) => handler.id !== id)
    }

    private handleMessage(payload: SocketPayloadInterface) {
        if (payload.action === "message" && payload.data?.content) {
            try {
                const content = JSON.parse(payload.data.content)
                const topic = content.topic
                if (topic) {
                    const topicHandler = this.actionHandlers.find((handler) => handler.id === topic)
                    console.log("[Socket] Handling topic message:", topic, topicHandler ? "found handler" : "no handler")
                    if (topicHandler) {
                        const handlerData = { ...content, socketId: payload.data.socketId, displayName: payload.data.displayName }
                        topicHandler.handleMessage(handlerData)
                        return
                    }
                }
            } catch (err) {
                console.error("[Socket] Failed to parse message content:", err)
            }
        }
/*
        const matchingHandler = this.actionHandlers.find((handler) => handler.id === payload.action)
        if (!matchingHandler) return

        try {
            matchingHandler.handleMessage(payload.data)
        } catch (err) {
            console.error(`[Socket] Error in handler ${matchingHandler.id}:`, err)
        }
            */
    }
}

function isValidJSON(data: string) {
    try {
        JSON.parse(data)
        return true
    } catch {
        return false
    }
}
