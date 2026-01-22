import { wait } from "./common"

const MESSAGING_API = "https://api.churchapps.org/messaging" // "https://messaging.churchapps.org"
const SOCKET_URL = "wss://socket.churchapps.org"

interface Connection {
    churchId: string
    teamId: string
    displayName: string
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
                this.socket!.send("getId")
            }

            // this.socket.onclose = async () => {}
            this.socket.onerror = (err) => console.error("Socket error:", err)
        } catch (err) {
            console.error("Socket connection error:", err)
        }
    }

    private isConnected() {
        return !!(this.socketId && this.socket && this.socket.readyState === this.socket.OPEN)
    }

    private connect() {
        console.info("Connected to socket as", this.connection.displayName)

        const connection = {
            socketId: this.socketId,
            churchId: this.connection.churchId,
            teamId: this.connection.teamId,
            conversationId: "alerts",
            displayName: this.connection.displayName
        }

        this.postAnonymous("/connections", [connection])

        // this.sendMessage("alerts", { action: "connect" });
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

    // MESSAGING

    sendMessage(conversationId: string, data: { [key: string]: any } = {}) {
        if (!this.isConnected()) return

        const message = {
            socketId: this.socketId,
            churchId: this.connection.churchId,
            teamId: this.connection.teamId,
            conversationId,
            displayName: this.connection.displayName,
            ...data
        }

        console.log(`Sending message to ${conversationId}:`, data)
        this.postAnonymous("/messages", message)
    }

    private async postAnonymous(path: string, data: any[] | {}) {
        const requestOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }

        return await this.fetchWithErrorHandling(MESSAGING_API + path, requestOptions)
    }

    private async fetchWithErrorHandling(url: string, requestOptions: any) {
        try {
            const response = await fetch(url, requestOptions)

            if (!response.ok) {
                const json = await response.json()
                console.error(response.status.toString(), response.url, json.errors[0])
                return
            }

            if (response.status === 204) return
            return response.json()
        } catch (err) {
            console.error("Fetch error:", err)
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
        const matchingHandler = this.actionHandlers.find((handler) => handler.id === payload.action)
        if (!matchingHandler) {
            console.error("Received message with no matching handler:", payload)
            return
        }

        try {
            console.info("Received message:", payload)
            matchingHandler.handleMessage(payload.data)
        } catch (err) {
            console.error(`Error in handler ${matchingHandler.id}:`, err)
        }
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
